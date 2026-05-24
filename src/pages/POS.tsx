"use client"

import { useEffect, useRef, useState } from "react"
import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Minus, Trash2, CreditCard, Search, ChefHat } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { formatItemCode } from "@/lib/itemCode"
import { getAllProducts, type ProductResponseDto, type PortionSize } from "@/lib/productsApi"
import { getAllCategories, type CategoryResponseDto } from "@/lib/categoriesApi"
import { apiFetchBlob } from "@/lib/apiClient"
import { applyInventoryUsageDeductions } from "@/lib/inventoryApi"
import {
  createOrder,
  type Kitchen,
  type OrderResponseDto,
  type OrderStatus,
  type OrderType,
} from "@/lib/ordersApi"
import { createOrderItem, deleteOrderItem, getAllOrderItems } from "@/lib/orderItemsApi"
import { SinhalaReceiptDialog } from "@/components/POS/SinhalaReceiptDialog"
import {
  printKitchenTicketsForStationsSequentially,
  type KitchenTicketPayload,
  type OrderBillsPayload,
} from "@/components/POS/receiptPrint"

const orderTypeLabels: Record<OrderType, string> = {
  DINE_IN: "Dine in",
  TAKE_AWAY: "Take away",
  DELIVERY: "Delivery",
}

const orderTypeLabelSi: Record<OrderType, string> = {
  DINE_IN: "ආපන ශාලාව",
  TAKE_AWAY: "නිවසට ගෙන යාම",
  DELIVERY: "ඩිලිවරි",
}

interface CartItem {
  lineKey: string
  productId: number
  name: string
  /** Station from menu item — used to split KOTs */
  kitchen: Kitchen
  nameSinhala: string | null
  unitPrice: number
  quantity: number
  portionSize?: PortionSize
  /** True when menu item has M/L prices; unset portionSize = small (sellingPrice) */
  hasPortionPricing?: boolean
  imageUrl?: string
  description?: string
  /** Drinks/showcase: bill only, omit from printed KOTs */
  skipKitchenTicket?: boolean
  /** KOT only — prints on this item’s kitchen ticket, not customer bill */
  lineNote?: string
}

function kotPortionSi(c: CartItem): string | undefined {
  if (c.portionSize === "MEDIUM") return "මධ්‍යම"
  if (c.portionSize === "LARGE") return "විශාල"
  if (c.hasPortionPricing) return "කුඩා"
  return undefined
}

function buildKitchenTickets(
  cart: CartItem[],
  orderId: number,
  tableLabel: string,
  orderType: OrderType,
): KitchenTicketPayload[] {
  const map = new Map<Kitchen, KitchenTicketPayload["lines"]>()
  for (const c of cart) {
    if (c.skipKitchenTicket) continue
    const list = map.get(c.kitchen) ?? []
    const rawNote = c.lineNote?.trim()
    list.push({
      nameEn: c.name,
      nameSi: c.nameSinhala,
      qty: c.quantity,
      portionSi: kotPortionSi(c),
      lineNote: rawNote && rawNote.length > 0 ? rawNote : null,
    })
    map.set(c.kitchen, list)
  }
  const stationOrder: Kitchen[] = ["KITCHEN_1", "KITCHEN_2"]
  return stationOrder
    .filter((k) => (map.get(k)?.length ?? 0) > 0)
    .map((k) => ({
      kitchen: k,
      kitchenBadgeSi: k === "KITCHEN_1" ? "කුස්සිය 1" : "කුස්සිය 2",
      orderId,
      tableLabel,
      orderTypeLabelSi: orderTypeLabelSi[orderType],
      kitchenNote: null,
      lines: map.get(k)!,
    }))
}

const cartKey = (productId: number, portionSize?: PortionSize, lineNote = "") =>
  `${productId}:${portionSize ?? "DEFAULT"}:${encodeURIComponent(lineNote.trim())}`

const getUnitPriceForPortion = (item: ProductResponseDto, portionSize?: PortionSize) => {
  if (!item.hasPortionPricing) return item.sellingPrice
  if (!portionSize) return item.sellingPrice
  const price = item.portionPrices?.[portionSize]
  return typeof price === "number" && Number.isFinite(price) ? price : item.sellingPrice
}

function buildInventoryUsageFromCart(
  cart: CartItem[],
  productById: Map<number, ProductResponseDto>,
): Array<{ itemId: number; quantity: number }> {
  const usage = new Map<number, number>()
  for (const line of cart) {
    const product = productById.get(line.productId)
    if (!product?.recipe || product.recipe.length === 0) continue
    for (const recipeLine of product.recipe) {
      const qty = Number(recipeLine.quantity) * Number(line.quantity)
      if (!Number.isFinite(qty) || qty <= 0) continue
      usage.set(recipeLine.itemId, (usage.get(recipeLine.itemId) ?? 0) + qty)
    }
  }
  return Array.from(usage, ([itemId, quantity]) => ({ itemId, quantity: Number(quantity.toFixed(3)) }))
}

function billPortionLabelForCart(c: CartItem): string | undefined {
  if (c.portionSize === "MEDIUM") return "Medium"
  if (c.portionSize === "LARGE") return "Large"
  if (c.hasPortionPricing) return "Small"
  return undefined
}

const POS = () => {
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedTable, setSelectedTable] = useState("")
  const [menuItems, setMenuItems] = useState<ProductResponseDto[]>([])
  const [categories, setCategories] = useState<CategoryResponseDto[]>([])
  const [activeTab, setActiveTab] = useState("all")

  const [searchQuery, setSearchQuery] = useState("")

  const [orderType, setOrderType] = useState<OrderType>("TAKE_AWAY")
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [lineNoteDialogOpen, setLineNoteDialogOpen] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<{ product: ProductResponseDto } | null>(null)
  const [draftPortion, setDraftPortion] = useState<PortionSize | null>(null)
  const [draftLineNote, setDraftLineNote] = useState("")
  const [lastReceipt, setLastReceipt] = useState<OrderBillsPayload | null>(null)
  const [imageObjectUrls, setImageObjectUrls] = useState<Record<number, { imageUrl: string; objectUrl: string }>>({})
  const imageObjectUrlsRef = useRef(imageObjectUrls)

  useEffect(() => {
    imageObjectUrlsRef.current = imageObjectUrls
  }, [imageObjectUrls])

  const handleCategoryDragStart = (event: React.DragEvent<HTMLButtonElement>, categoryId: number) => {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(categoryId))
  }

  const handleCategoryDrop = (event: React.DragEvent<HTMLButtonElement>, targetCategoryId: number) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData("text/plain")
    const draggedId = Number(raw)
    if (!Number.isFinite(draggedId) || draggedId === targetCategoryId) return

    setCategories((prev) => {
      const srcIndex = prev.findIndex((c) => Number(c.categoryId) === draggedId)
      const dstIndex = prev.findIndex((c) => Number(c.categoryId) === targetCategoryId)
      if (srcIndex < 0 || dstIndex < 0 || srcIndex === dstIndex) return prev
      const next = [...prev]
      const [moved] = next.splice(srcIndex, 1)
      next.splice(dstIndex, 0, moved)
      return next
    })
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [cats, prods] = await Promise.all([getAllCategories(), getAllProducts()])
        if (cancelled) return

        const activeCats = cats.filter((c) => c.isActive !== false)

        const unique = new Map<number, CategoryResponseDto>()
        for (const c of activeCats) unique.set(Number(c.categoryId), c)

        setCategories(Array.from(unique.values()))
        setMenuItems(prods.filter((p) => p.isAvailable !== false))
      } catch (e) {
        console.error(e)
        toast.error("Failed to load categories/products")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const currentIds = new Set(menuItems.map((i) => i.productId))

    setImageObjectUrls((prev) => {
      let changed = false
      const next: typeof prev = {}
      for (const [k, v] of Object.entries(prev)) {
        const id = Number(k)
        const item = menuItems.find((i) => i.productId === id)
        if (!currentIds.has(id) || !item?.imageUrl || item.imageUrl !== v.imageUrl) {
          changed = true
          URL.revokeObjectURL(v.objectUrl)
          continue
        }
        next[id] = v
      }
      return changed ? next : prev
    })

    const toFetch = menuItems.filter((i) => i.imageUrl && !i.imageUrl.startsWith("http"))
    if (toFetch.length === 0) return

    ;(async () => {
      for (const item of toFetch) {
        if (cancelled) return
        const existing = imageObjectUrlsRef.current[item.productId]
        if (existing?.imageUrl === item.imageUrl) continue
        try {
          let blob: Blob
          try {
            blob = await apiFetchBlob(item.imageUrl!)
          } catch {
            blob = await apiFetchBlob(`/api/products/${item.productId}/image`)
          }
          const objectUrl = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(objectUrl)
            return
          }
          setImageObjectUrls((prev) => {
            const prevEntry = prev[item.productId]
            if (prevEntry) URL.revokeObjectURL(prevEntry.objectUrl)
            return {
              ...prev,
              [item.productId]: { imageUrl: item.imageUrl!, objectUrl },
            }
          })
        } catch (e) {
          console.warn("Failed to load POS product image", item.productId, e)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [menuItems])

  useEffect(() => {
    return () => {
      for (const v of Object.values(imageObjectUrlsRef.current)) {
        URL.revokeObjectURL(v.objectUrl)
      }
    }
  }, [])

  /**
   * Opens one dialog: portion (Medium/Large) when needed, then kitchen note. Card tap only — no separate row buttons.
   * Showcase items skip the dialog.
   */
  const beginAddToCart = (item: ProductResponseDto) => {
    if (item.skipKitchenTicket === true) {
      addToCartWithNote(item, undefined, "")
      return
    }
    setPendingAdd({ product: item })
    setDraftLineNote("")
    setDraftPortion(null)
    setLineNoteDialogOpen(true)
  }

  const addToCartWithNote = (item: ProductResponseDto, portionSize: PortionSize | undefined, lineNote: string) => {
    const unitPrice = getUnitPriceForPortion(item, portionSize)
    if (!Number.isFinite(unitPrice)) {
      toast.error("Invalid portion price")
      return
    }

    const trimmed = lineNote.trim().slice(0, 500)
    const lineKey = cartKey(item.productId, portionSize, trimmed)
    const skipKitchenTicket = item.skipKitchenTicket === true
    const newLine: CartItem = {
      lineKey,
      productId: item.productId,
      name: item.name,
      kitchen: item.kitchen === "KITCHEN_2" ? "KITCHEN_2" : "KITCHEN_1",
      nameSinhala: item.nameSinhala ?? null,
      unitPrice,
      quantity: 1,
      portionSize,
      hasPortionPricing: item.hasPortionPricing ? true : undefined,
      imageUrl: item.imageUrl,
      description: item.description,
      skipKitchenTicket,
      lineNote: trimmed.length > 0 ? trimmed : undefined,
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.lineKey === lineKey)
      if (existing) {
        return prev.map((c) => (c.lineKey === lineKey ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [...prev, newLine]
    })
  }

  const confirmLineNoteAndAdd = () => {
    if (!pendingAdd) return
    const portion =
      pendingAdd.product.hasPortionPricing && draftPortion ? draftPortion : undefined
    addToCartWithNote(pendingAdd.product, portion, draftLineNote)
    setLineNoteDialogOpen(false)
    setPendingAdd(null)
    setDraftPortion(null)
    setDraftLineNote("")
  }

  const cancelLineNoteDialog = () => {
    setLineNoteDialogOpen(false)
    setPendingAdd(null)
    setDraftPortion(null)
    setDraftLineNote("")
  }

  const skipLineNoteAndAdd = () => {
    if (!pendingAdd) return
    const portion =
      pendingAdd.product.hasPortionPricing && draftPortion ? draftPortion : undefined
    addToCartWithNote(pendingAdd.product, portion, "")
    setLineNoteDialogOpen(false)
    setPendingAdd(null)
    setDraftPortion(null)
    setDraftLineNote("")
  }

  const updateQuantity = (lineKey: string, change: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.lineKey !== lineKey) return item
          const newQuantity = item.quantity + change
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
        })
        .filter((item) => item.quantity > 0),
    )
  }

  const removeItem = (lineKey: string) => {
    setCart((prev) => prev.filter((item) => item.lineKey !== lineKey))
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredMenuItems = normalizedSearch
    ? menuItems.filter((item) => {
        const name = item.name.toLowerCase()
        const code = formatItemCode(item.productId).toLowerCase()
        return name.includes(normalizedSearch) || code.includes(normalizedSearch)
      })
    : menuItems

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const taxAmount = 0
  const discountAmount = 0
  const totalAmount = Number((subtotal - discountAmount).toFixed(2))

  /** Create order + line items; does not clear cart or open dialogs. */
  const submitCartAsOrder = async (status: OrderStatus): Promise<OrderResponseDto | null> => {
    if (cart.length === 0) {
      toast.error("Cart is empty")
      return null
    }

    const items = cart.map((c) => ({
      productId: c.productId,
      quantity: c.quantity,
      portionType: c.portionSize ?? null,
    }))

    let tableNumber: number | null = null
    if (orderType === "DINE_IN") {
      const parsed = Number(String(selectedTable).replace(/\D/g, "")) || 0
      if (!parsed) {
        toast.error("Table number is required for DINE_IN orders")
        return null
      }
      tableNumber = parsed
    } else {
      tableNumber = null
    }

    const portionProductIds = new Set(cart.filter((c) => !!c.portionSize).map((c) => c.productId))
    const portionLines = cart.filter((c) => !!c.portionSize)
    const nonPortionLines = cart.filter((c) => !c.portionSize)

    try {
      const orderKitchen: Kitchen = cart[0]!.kitchen

      const order = await createOrder({
        tableNumber,
        totalAmount,
        taxAmount,
        discountAmount,
        paymentMethod: "CASH",
        status,
        orderType,
        kitchen: orderKitchen,
        items,
      })

      let existingForOrderCount = 0
      try {
        const all = await getAllOrderItems()
        const existingForOrder = all.filter((i) => i.orderId === order.orderId)
        existingForOrderCount = existingForOrder.length

        const toDelete = existingForOrder.filter(
          (i) => portionProductIds.has(i.productId) && (i.portionType == null || i.portionType === undefined),
        )

        await Promise.all(toDelete.map((i) => deleteOrderItem(i.orderItemId)))
      } catch (e) {
        console.error(e)
      }

      await Promise.all(
        portionLines.map((c) =>
          createOrderItem({
            orderId: order.orderId,
            productId: c.productId,
            quantity: c.quantity,
            portionType: c.portionSize!,
            unitPrice: c.unitPrice,
            subtotal: Number((c.unitPrice * c.quantity).toFixed(2)),
          }),
        ),
      )

      if (existingForOrderCount === 0) {
        await Promise.all(
          nonPortionLines.map((c) =>
            createOrderItem({
              orderId: order.orderId,
              productId: c.productId,
              quantity: c.quantity,
              portionType: null,
              unitPrice: c.unitPrice,
              subtotal: Number((c.unitPrice * c.quantity).toFixed(2)),
            }),
          ),
        )
      }

      if (status === "PAID") {
        const productById = new Map<number, ProductResponseDto>()
        for (const p of menuItems) productById.set(p.productId, p)
        const usageLines = buildInventoryUsageFromCart(cart, productById)
        if (usageLines.length > 0) {
          try {
            await applyInventoryUsageDeductions(usageLines)
          } catch (inventoryError) {
            console.error(inventoryError)
            toast.warning("Order was placed, but inventory update failed.")
          }
        }
      }

      return order
    } catch (e) {
      console.error(e)
      toast.error("Failed to place order")
      return null
    }
  }

  const handleSendToKitchen = async () => {
    if (orderType !== "DINE_IN") return
    const order = await submitCartAsOrder("NEW")
    if (!order) return

    const tableLabel = String(selectedTable)
    const tickets = buildKitchenTickets(cart, order.orderId, tableLabel, orderType)
    printKitchenTicketsForStationsSequentially(tickets, new Date())
    toast.success(
      `Order #${order.orderId} sent to kitchen. One print dialog per station (Kitchen 1 / 2) — choose each kitchen printer. Then Orders → Print customer bill → Mark as Paid.`,
    )
    setCart([])
  }

  const handleCheckout = async () => {
    const order = await submitCartAsOrder("PAID")
    if (!order) return

    const tableLabel = orderType === "DINE_IN" ? String(selectedTable) : "—"

    const lines = cart.map((c) => ({
      name: c.name,
      qty: c.quantity,
      unitPrice: c.unitPrice,
      lineTotal: Number((c.unitPrice * c.quantity).toFixed(2)),
      portion: billPortionLabelForCart(c),
    }))

    const kitchenTickets: KitchenTicketPayload[] =
      orderType === "DINE_IN" ? [] : buildKitchenTickets(cart, order.orderId, tableLabel, orderType)

    setLastReceipt({
      customer: {
        orderId: order.orderId,
        lines,
        subtotal,
        taxAmount,
        total: totalAmount,
        tableLabel,
        paymentLabel: "",
        orderTypeLabel: orderTypeLabels[orderType],
      },
      kitchenTickets,
    })
    setReceiptOpen(true)

    toast.success(`Order ${order.orderId} placed! Total: ${formatCurrency(totalAmount)}`)
    setCart([])
  }

  const renderItemsGrid = (items: ProductResponseDto[]) => (
    <>
      <div className="mb-2 text-sm text-muted-foreground">Showing {items.length} items</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const rawUrl = item.imageUrl
          const resolvedUrl =
            rawUrl && rawUrl.startsWith("http")
              ? rawUrl
              : rawUrl
                ? (imageObjectUrls[item.productId]?.objectUrl ?? rawUrl)
                : undefined
          const hasImage = Boolean(resolvedUrl)

          return (
            <Card
              key={item.productId}
              className="cursor-pointer modern-card group border-0 shadow-modern hover:shadow-modern-lg transition-all duration-300"
              onClick={() => beginAddToCart(item)}
            >
              <CardContent className="p-4">
                <div className="relative aspect-square rounded-xl mb-4 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  <span className="absolute left-2 top-2 z-10 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground shadow-sm border border-border/60">
                    {formatItemCode(item.productId)}
                  </span>
                  <img
                    src={resolvedUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    style={{ display: hasImage ? undefined : "none" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                      if (fallback) fallback.style.display = "flex"
                    }}
                  />
                  <div
                    className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center"
                    style={{ display: hasImage ? "none" : "flex" }}
                  >
                    <span className="text-5xl group-hover:scale-110 transition-transform duration-300">🍽️</span>
                  </div>
                </div>

                <h3 className="font-bold text-base group-hover:text-primary transition-colors duration-200">
                  {item.name}
                </h3>

                {item.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 group-hover:line-clamp-none">
                    {item.description}
                  </p>
                )}

                <p className="mt-2 text-accent font-bold text-lg">{formatCurrency(item.sellingPrice)}</p>

                <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="w-full h-1 bg-gradient-to-r from-primary to-accent rounded-full"></div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )

  return (
    <DashboardLayout>
      <SinhalaReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} payload={lastReceipt} />

      <Dialog
        open={lineNoteDialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelLineNoteDialog()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to cart</DialogTitle>
          </DialogHeader>
          {pendingAdd ? (
            <div className="grid gap-4 py-1">
              <p className="text-sm font-medium">{pendingAdd.product.name}</p>
              <p className="text-xs text-muted-foreground">
                Station:{" "}
                <span className="font-medium text-foreground">
                  {pendingAdd.product.kitchen === "KITCHEN_2" ? "Kitchen 2" : "Kitchen 1"}
                </span>
                . Kitchen note prints only on that station’s KOT.
              </p>

              {pendingAdd.product.hasPortionPricing ? (
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Portion size (optional — default Small)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={draftPortion === "MEDIUM" ? "default" : "outline"}
                      className="h-auto min-h-11 flex-col gap-0.5 py-2"
                      onClick={() => setDraftPortion("MEDIUM")}
                    >
                      <span className="text-sm font-semibold">Medium</span>
                      <span className="text-xs font-mono opacity-90">
                        {formatCurrency(pendingAdd.product.portionPrices?.MEDIUM ?? pendingAdd.product.sellingPrice)}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant={draftPortion === "LARGE" ? "default" : "outline"}
                      className="h-auto min-h-11 flex-col gap-0.5 py-2"
                      onClick={() => setDraftPortion("LARGE")}
                    >
                      <span className="text-sm font-semibold">Large</span>
                      <span className="text-xs font-mono opacity-90">
                        {formatCurrency(pendingAdd.product.portionPrices?.LARGE ?? pendingAdd.product.sellingPrice)}
                      </span>
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    If you skip Medium/Large, this line is added at the Small price (
                    {formatCurrency(pendingAdd.product.sellingPrice)}).
                  </p>
                </div>
              ) : null}

              <div className="grid gap-2">
                <label className="text-sm font-medium text-muted-foreground">Kitchen instructions (optional)</label>
                <Textarea
                  value={draftLineNote}
                  onChange={(e) => setDraftLineNote(e.target.value)}
                  placeholder="e.g. No onions, less oil, extra gravy…"
                  rows={3}
                  className="rounded-xl border-2 text-sm resize-y min-h-[4rem]"
                  maxLength={500}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button type="button" variant="outline" onClick={cancelLineNoteDialog}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={skipLineNoteAndAdd}>
              Skip note
            </Button>
            <Button
              type="button"
              onClick={() => {
                confirmLineNoteAndAdd()
              }}
            >
              Add to cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-screen flex flex-col bg-gradient-to-br from-background to-muted/20">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Point of Sale
              </h1>
              <p className="text-muted-foreground mt-1 text-base">Process orders and payments with ease</p>
            </div>
            <div className="flex items-center gap-4">
              {orderType === "DINE_IN" && selectedTable.trim() !== "" ? (
                <div className="px-4 py-2 bg-accent/10 rounded-full border border-accent/20">
                  <span className="text-accent font-semibold text-sm">Table {selectedTable.trim()}</span>
                </div>
              ) : orderType !== "DINE_IN" ? (
                <div className="px-4 py-2 bg-muted/40 rounded-full border border-border/60">
                  <span className="text-muted-foreground font-semibold text-sm">{orderTypeLabels[orderType]}</span>
                </div>
              ) : null}
              <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 pb-4 min-h-0">
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1">
              <div className="mb-2">
                <div className="pb-2">
                  <div className="text-xl font-bold flex items-center gap-2">
                    <div className="w-6 h-6 gradient-primary rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-bold">🍽️</span>
                    </div>
                    Menu Items
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <TabsList className="w-full flex flex-wrap gap-1 bg-muted/50 p-1 rounded-xl h-auto md:w-auto">
                    <TabsTrigger
                      value="all"
                      className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-modern"
                    >
                      All
                    </TabsTrigger>

                    {categories.map((c) => (
                      <TabsTrigger
                        key={c.categoryId}
                        value={String(c.categoryId)}
                        draggable
                        onDragStart={(e) => handleCategoryDragStart(e, Number(c.categoryId))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleCategoryDrop(e, Number(c.categoryId))}
                        className="cursor-move rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-modern"
                      >
                        {c.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="relative w-full md:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search item or code (ITM-0001)"
                      className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs"
                    />
                  </div>
                </div>

              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth min-h-0 max-h-[calc(100vh-160px)] pr-1">
                <Card className="modern-card shadow-modern-lg border-0">
                  <CardContent className="pt-2">
                    <TabsContent value="all" className="mt-0">
                      {renderItemsGrid(filteredMenuItems)}
                    </TabsContent>

                    {categories.map((c) => (
                      <TabsContent key={c.categoryId} value={String(c.categoryId)} className="mt-0">
                        {renderItemsGrid(
                          filteredMenuItems.filter((p) => p.categoryId === c.categoryId),
                        )}
                      </TabsContent>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </Tabs>
          </div>

          <div className="flex min-h-0 flex-col lg:h-full">
            <div className="flex min-h-0 flex-1 flex-col">
              <Card className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden modern-card shadow-modern-lg border-0 w-full max-w-md lg:w-96">
                <CardHeader className="shrink-0 pb-2">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <div className="w-6 h-6 gradient-accent rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-bold">🛒</span>
                    </div>
                    Current Order
                  </CardTitle>

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1 block">Order Type</label>
                      <select
                        value={orderType}
                        onChange={(e) => {
                          const next = e.target.value as OrderType
                          setOrderType(next)
                          if (next !== "DINE_IN") setSelectedTable("")
                        }}
                        className="flex h-10 w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      >
                        <option value="TAKE_AWAY">Take Away</option>
                        <option value="DINE_IN">Dine In</option>
                        <option value="DELIVERY">Delivery</option>
                      </select>
                    </div>

                    <p className="text-xs text-muted-foreground rounded-lg border border-muted/60 bg-muted/20 px-3 py-2">
                      Each item’s kitchen is set in{" "}
                      <span className="font-medium text-foreground">Menu Items</span>. When you add an item, you can
                      enter an optional <span className="font-medium text-foreground">kitchen note</span> — it prints only
                      on that item’s station KOT (Kitchen 1 or 2), not on the customer bill.
                    </p>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1 block">
                        Table Number {orderType !== "DINE_IN" ? "(Dine In only)" : ""}
                      </label>
                      <Input
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        disabled={orderType !== "DINE_IN"}
                        className="rounded-xl border-2 focus:border-primary transition-colors duration-200"
                        placeholder={orderType === "DINE_IN" ? "Enter table number" : "Not required"}
                      />
                    </div>

                  </div>
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-0">
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                    <div className="space-y-1 pb-2">
                      {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mb-1">
                            <span className="text-sm">🛒</span>
                          </div>
                          <p className="text-sm justify-center font-medium mb-0">No items in cart</p>
                          <p className="text-xs justify-center text-muted-foreground">Add items from menu to start</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {cart.map((item) => (
                            <div
                              key={item.lineKey}
                              className="flex flex-col gap-2 p-3 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-muted/50 hover:shadow-modern transition-all duration-200"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm leading-tight">{item.name}</p>
                                  {item.hasPortionPricing ? (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      {item.portionSize === "MEDIUM"
                                        ? "Medium"
                                        : item.portionSize === "LARGE"
                                          ? "Large"
                                          : "Small"}
                                    </p>
                                  ) : null}
                                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                    {formatItemCode(item.productId)}
                                  </p>
                                  {item.skipKitchenTicket ? (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Showcase — bill only (no KOT)</p>
                                  ) : null}
                                  {item.lineNote ? (
                                    <p className="text-[10px] text-amber-900 dark:text-amber-100 mt-1 rounded border border-amber-200/80 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-2 py-1">
                                      <span className="font-semibold">KOT:</span> {item.lineNote}
                                    </p>
                                  ) : null}
                                  <p className="text-xs text-accent font-medium mt-1">
                                    {formatCurrency(item.unitPrice)} each
                                  </p>
                                </div>
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="h-6 w-6 rounded-md flex-shrink-0"
                                  onClick={() => removeItem(item.lineKey)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1 bg-background rounded-md p-1">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-6 w-6 rounded-md bg-transparent"
                                    onClick={() => updateQuantity(item.lineKey, -1)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-6 w-6 rounded-md bg-transparent"
                                    onClick={() => updateQuantity(item.lineKey, 1)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>

                                <span className="text-sm font-bold text-accent">
                                  {formatCurrency(item.unitPrice * item.quantity)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 space-y-1 border-t border-muted/50 bg-card pt-3 mt-2">
                    <div className="flex justify-between text-lg font-bold pt-1 border-t-2 border-primary/20">
                      <span>Total</span>
                      <span className="text-accent">{formatCurrency(totalAmount)}</span>
                    </div>

                    {orderType === "DINE_IN" ? (
                      <div className="flex flex-col gap-2 mt-2">
                        <p className="text-xs text-muted-foreground leading-snug rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                          <span className="font-medium text-foreground">Flow:</span>{" "}
                          <span className="font-medium text-foreground">Send to kitchen</span> prints{" "}
                          <span className="font-medium text-foreground">KOT only</span>. Then open{" "}
                          <span className="font-medium text-foreground">Orders</span> and use{" "}
                          <span className="font-medium text-foreground">Print customer bill</span> for the guest. After
                          they pay, use <span className="font-medium text-foreground">Mark as Paid</span>.
                        </p>
                        <Button
                          type="button"
                          className="w-full h-10 text-base font-bold rounded-lg modern-button gradient-primary hover:shadow-modern-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          size="lg"
                          disabled={cart.length === 0}
                          onClick={() => void handleSendToKitchen()}
                        >
                          <ChefHat className="mr-3 h-5 w-5" />
                          Send to kitchen (KOT)
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full h-10 text-base font-bold rounded-lg modern-button gradient-primary hover:shadow-modern-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        size="lg"
                        disabled={cart.length === 0}
                        onClick={() => void handleCheckout()}
                      >
                        <CreditCard className="mr-3 h-5 w-5" />
                        Complete order
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default POS
