"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ClipboardList, Search, Pencil, Trash2, Clock, CheckCircle, XCircle, Plus } from "lucide-react"
import { toast } from "sonner"
import { cn, formatCurrency } from "@/lib/utils"
import { ORDER_DELETE_AUTH } from "@/config/orderDeleteCredentials"
import { getAllProducts, type ProductResponseDto } from "@/lib/productsApi"
import { applyInventoryUsageDeductions } from "@/lib/inventoryApi"
import {
  getAllOrders,
  patchOrder,
  deleteOrder,
  type OrderResponseDto,
  type OrderStatus,
  type PaymentMethod,
  type OrderType,
} from "@/lib/ordersApi"
import {
  getAllOrderItems,
  type OrderItemResponseDto,
  createOrderItem,
  deleteOrderItem,
  patchOrderItem,
  type PortionType,
} from "@/lib/orderItemsApi"
import { SinhalaReceiptDialog } from "@/components/POS/SinhalaReceiptDialog"
import { printKitchenTicketsForStationsSequentially, type KitchenTicketPayload, type OrderBillsPayload } from "@/components/POS/receiptPrint"

const statusLabels: Record<OrderStatus, string> = {
  NEW: "Pending",
  PAID: "Paid",
  CANCELLED: "Cancelled",
  UPDATED: "Updated",
}

const statusColors: Record<OrderStatus, string> = {
  NEW: "bg-amber-100 text-amber-800 border-amber-300",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CANCELLED: "bg-red-100 text-red-800 border-red-300",
  UPDATED: "bg-sky-100 text-sky-800 border-sky-300",
}

const statusBorderColors: Record<OrderStatus, string> = {
  NEW: "border-l-4 border-l-amber-500",
  PAID: "border-l-4 border-l-emerald-500",
  CANCELLED: "border-l-4 border-l-red-500",
  UPDATED: "border-l-4 border-l-sky-500",
}

const statusIcons = {
  NEW: Clock,
  PAID: CheckCircle,
  CANCELLED: XCircle,
  UPDATED: Clock,
} as const

type UiOrderItem = OrderItemResponseDto & { name: string }


type UiOrder = Omit<OrderResponseDto, "items"> & {
  items: UiOrderItem[]
}

/** `patchOrder` / order API returns slim `items`; keep enriched `UiOrderItem[]` from state. */
function mergeOrderResponseIntoUi(existing: UiOrder, fromApi: OrderResponseDto): UiOrder {
  const { items: _itemsFromApi, ...rest } = fromApi
  return { ...existing, ...rest }
}

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

function portionLabelForBill(p: PortionType | null | undefined): string | undefined {
  if (p === "MEDIUM") return "Medium"
  if (p === "LARGE") return "Large"
  return undefined
}
function portionLabelSi(p: PortionType | null | undefined): string | undefined {
  if (p === "MEDIUM") return "මධ්‍යම"
  if (p === "LARGE") return "විශාල"
  return undefined
}

function buildOrderBillPayload(order: UiOrder, paymentLabel = ""): OrderBillsPayload {
  const subtotal = order.items.reduce((s, i) => s + i.subtotal, 0)
  const lines = order.items.map((i) => ({
    name: i.name,
    qty: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.subtotal,
    portion: portionLabelForBill(i.portionType),
  }))
  const tableLabel =
    order.orderType === "DINE_IN" && order.tableNumber != null ? String(order.tableNumber) : "—"
  return {
    customer: {
      orderId: order.orderId,
      lines,
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount: order.taxAmount,
      total: order.totalAmount,
      tableLabel,
      paymentLabel,
      orderTypeLabel: orderTypeLabels[order.orderType],
    },
    kitchenTickets: [],
  }
}

function buildKitchenTicketsForNewDraftLines(
  order: UiOrder,
  draftLines: DraftLine[],
  products: ProductResponseDto[],
  tableNumber: number | null,
): KitchenTicketPayload[] {
  const productById = new Map<number, ProductResponseDto>()
  for (const p of products) productById.set(p.productId, p)
  const byKitchen = new Map<"KITCHEN_1" | "KITCHEN_2", KitchenTicketPayload["lines"]>()
  for (const line of draftLines) {
    if (line.kind !== "new" || line.productId === "") continue
    const p = productById.get(line.productId)
    if (!p || p.skipKitchenTicket) continue
    const kitchen = p.kitchen === "KITCHEN_2" ? "KITCHEN_2" : "KITCHEN_1"
    const list = byKitchen.get(kitchen) ?? []
    list.push({
      nameEn: p.name || line.name,
      nameSi: p.nameSinhala ?? null,
      qty: line.quantity,
      portionSi: portionLabelSi(line.portionType),
      lineNote: null,
    })
    byKitchen.set(kitchen, list)
  }
  const tableLabel = order.orderType === "DINE_IN" ? String(tableNumber ?? order.tableNumber ?? "—") : "—"
  return (["KITCHEN_1", "KITCHEN_2"] as const)
    .filter((k) => (byKitchen.get(k)?.length ?? 0) > 0)
    .map((k) => ({
      kitchen: k,
      kitchenBadgeSi: k === "KITCHEN_1" ? "කුස්සිය 1" : "කුස්සිය 2",
      orderId: order.orderId,
      tableLabel,
      orderTypeLabelSi: orderTypeLabelSi[order.orderType],
      kitchenNote: null,
      lines: byKitchen.get(k)!,
    }))
}

function buildInventoryDeductionLines(
  items: UiOrderItem[],
  productById: Map<number, ProductResponseDto>,
): Array<{ itemId: number; quantity: number }> {
  const usage = new Map<number, number>()
  for (const line of items) {
    const product = productById.get(line.productId)
    if (!product || !Array.isArray(product.recipe) || product.recipe.length === 0) continue
    for (const recipeLine of product.recipe) {
      const qty = Number(recipeLine.quantity) * Number(line.quantity)
      if (!Number.isFinite(qty) || qty <= 0) continue
      usage.set(recipeLine.itemId, (usage.get(recipeLine.itemId) ?? 0) + qty)
    }
  }
  return Array.from(usage, ([itemId, quantity]) => ({ itemId, quantity: Number(quantity.toFixed(3)) }))
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} min ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return d.toLocaleDateString()
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  const v = String(value ?? "").trim().toUpperCase()
  if (v === "CANCELED") return "CANCELLED"
  if (v === "NEW" || v === "PAID" || v === "CANCELLED" || v === "UPDATED") return v
  return "NEW"
}

function normalizePaymentMethod(value: unknown): PaymentMethod {
  const v = String(value ?? "").trim().toUpperCase()
  if (v === "PAYPAL") return "CASH"
  if (v === "CASH" || v === "CARD" || v === "BANK_TRANSFER" || v === "CASH_ON_DELIVERY") return v
  return "CASH"
}

export default function Orders() {
  const [orders, setOrders] = useState<UiOrder[]>([])
  const [products, setProducts] = useState<ProductResponseDto[]>([])
  const [search, setSearch] = useState("")
  const [editingOrder, setEditingOrder] = useState<UiOrder | null>(null)
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null)
  const [deleteAuthUsername, setDeleteAuthUsername] = useState("")
  const [deleteAuthPassword, setDeleteAuthPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [paidBillOpen, setPaidBillOpen] = useState(false)
  const [paidBillPayload, setPaidBillPayload] = useState<OrderBillsPayload | null>(null)
  /** Dine-in: Mark as Paid allowed only after modal “Print customer bill” for this order. */
  const [dineInBillPrintedIds, setDineInBillPrintedIds] = useState<Set<number>>(() => new Set())

  const refresh = async () => {
    setIsLoading(true)
    try {
      const [ordersRes, productsRes] = await Promise.all([getAllOrders(), getAllProducts()])
      const orderItemsRes: OrderItemResponseDto[] = await getAllOrderItems()

      const productNameById = new Map<number, string>()
      for (const p of productsRes) productNameById.set(p.productId, p.name)

      const itemsByOrderId = new Map<number, OrderItemResponseDto[]>()
      for (const item of orderItemsRes) {
        const list = itemsByOrderId.get(item.orderId) ?? []
        list.push(item)
        itemsByOrderId.set(item.orderId, list)
      }

      const combined: UiOrder[] = ordersRes
        .slice()
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
        .map((o) => {
          const rawItems = (itemsByOrderId.get(o.orderId) ?? []).map((it) => ({
            ...it,
            name: productNameById.get(it.productId) ?? `Product #${it.productId}`,
          }))

          // If a product has MEDIUM/LARGE lines, hide its auto-created "portionType=null" line
          const portionProductIds = new Set(rawItems.filter((i) => i.portionType != null).map((i) => i.productId))
          const items = rawItems.filter((i) => {
            if (!portionProductIds.has(i.productId)) return true
            return i.portionType != null
          })

          return {
            ...o,
            status: normalizeOrderStatus(o.status),
            paymentMethod: normalizePaymentMethod(o.paymentMethod),
            items,
          }
        })

      setOrders(combined)
      setProducts(productsRes)
    } catch (e) {
      console.error(e)
      toast.error("Failed to load orders")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshClick = () => {
    setSearch("")
    void refresh()
  }

  useEffect(() => {
    refresh()
  }, [])

  const filteredBySearch = useMemo(() => {
    const raw = search.trim()
    if (!raw) return orders
    if (!/^\d+$/.test(raw)) return []
    const id = Number.parseInt(raw, 10)
    return orders.filter((o) => o.orderId === id)
  }, [orders, search])

  const byStatus = (status: OrderStatus) => filteredBySearch.filter((o) => o.status === status)

  const newOrders = byStatus("NEW")
  const paidOrders = byStatus("PAID")
  const cancelledOrders = byStatus("CANCELLED")
  const productById = useMemo(() => {
    const map = new Map<number, ProductResponseDto>()
    for (const p of products) map.set(p.productId, p)
    return map
  }, [products])

  const handleStatusChange = async (order: UiOrder, status: OrderStatus) => {
    try {
      const updated = await patchOrder(order.orderId, { status })
      const merged = mergeOrderResponseIntoUi(order, updated)
      setOrders((prev) =>
        prev.map((o) => (o.orderId === updated.orderId ? mergeOrderResponseIntoUi(o, updated) : o)),
      )
      if (status === "PAID") {
        if (order.status !== "PAID") {
          const usageLines = buildInventoryDeductionLines(merged.items, productById)
          if (usageLines.length > 0) {
            try {
              await applyInventoryUsageDeductions(usageLines)
            } catch (inventoryError) {
              console.error(inventoryError)
              toast.warning("Order paid, but inventory deduction failed. Please check inventory.")
            }
          }
        }
        if (merged.orderType === "DINE_IN") {
          setDineInBillPrintedIds((prev) => {
            const next = new Set(prev)
            next.delete(merged.orderId)
            return next
          })
          toast.success("Marked as paid.")
        } else {
          setPaidBillPayload(buildOrderBillPayload(merged))
          setPaidBillOpen(true)
        }
      }
    } catch (e) {
      console.error(e)
      toast.error("Failed to update order status")
    }
  }

  const handlePrintDineInCustomerBill = (order: UiOrder) => {
    if (order.orderType !== "DINE_IN") return
    if (order.status === "PAID" || order.status === "CANCELLED") return
    const payload = buildOrderBillPayload(order, "Pending payment")
    setPaidBillPayload(payload)
    setPaidBillOpen(true)
  }

  const handleDelete = async (orderId: number) => {
    try {
      await deleteOrder(orderId)
      setDineInBillPrintedIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
      setOrders((prev) => prev.filter((o) => o.orderId !== orderId))
      setDeleteOrderId(null)
      setDeleteAuthUsername("")
      setDeleteAuthPassword("")
      toast.success("Order deleted")
    } catch (e) {
      console.error(e)
      toast.error("Failed to delete order")
    }
  }

  const closeDeleteDialog = () => {
    setDeleteOrderId(null)
    setDeleteAuthUsername("")
    setDeleteAuthPassword("")
  }

  const confirmDeleteWithAuth = async () => {
    if (deleteOrderId == null) return
    const u = deleteAuthUsername.trim()
    const p = deleteAuthPassword
    if (u !== ORDER_DELETE_AUTH.username || p !== ORDER_DELETE_AUTH.password) {
      toast.error("Invalid username or password")
      return
    }
    setIsDeleting(true)
    try {
      await handleDelete(deleteOrderId)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="p-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                Orders
              </h1>
              <p className="text-muted-foreground mt-3 text-xl">Track and manage all orders</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Order ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <Button variant="outline" onClick={handleRefreshClick} disabled={isLoading}>
                {isLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8">
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="bg-muted/50 p-1 rounded-xl gap-1">
              <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-modern">
                All ({filteredBySearch.length})
              </TabsTrigger>
              <TabsTrigger value="new" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-modern">
                Pending ({newOrders.length})
              </TabsTrigger>
              <TabsTrigger value="paid" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-modern">
                Paid ({paidOrders.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-modern">
                Cancelled ({cancelledOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <OrderList
                orders={filteredBySearch}
                onEdit={setEditingOrder}
                onDelete={setDeleteOrderId}
                onStatusChange={handleStatusChange}
                onPrintDineInBill={handlePrintDineInCustomerBill}
                dineInBillPrintedIds={dineInBillPrintedIds}
              />
            </TabsContent>
            <TabsContent value="new" className="mt-0">
              <OrderList
                orders={newOrders}
                onEdit={setEditingOrder}
                onDelete={setDeleteOrderId}
                onStatusChange={handleStatusChange}
                onPrintDineInBill={handlePrintDineInCustomerBill}
                dineInBillPrintedIds={dineInBillPrintedIds}
              />
            </TabsContent>
            <TabsContent value="paid" className="mt-0">
              <OrderList
                orders={paidOrders}
                onEdit={setEditingOrder}
                onDelete={setDeleteOrderId}
                onStatusChange={handleStatusChange}
                onPrintDineInBill={handlePrintDineInCustomerBill}
                dineInBillPrintedIds={dineInBillPrintedIds}
              />
            </TabsContent>
            <TabsContent value="cancelled" className="mt-0">
              <OrderList
                orders={cancelledOrders}
                onEdit={setEditingOrder}
                onDelete={setDeleteOrderId}
                onStatusChange={handleStatusChange}
                onPrintDineInBill={handlePrintDineInCustomerBill}
                dineInBillPrintedIds={dineInBillPrintedIds}
              />
            </TabsContent>
          </Tabs>
        </div>

        <EditOrderDialog
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onRefresh={refresh}
          onShowPaidBill={(payload) => {
            setPaidBillPayload(payload)
            setPaidBillOpen(true)
          }}
        />
        <SinhalaReceiptDialog
          open={paidBillOpen}
          onOpenChange={(v) => {
            setPaidBillOpen(v)
            if (!v) setPaidBillPayload(null)
          }}
          payload={paidBillPayload}
          onPendingDineInBillPrinted={(orderId) => {
            setDineInBillPrintedIds((prev) => new Set(prev).add(orderId))
          }}
        />

        <Dialog
          open={deleteOrderId != null}
          onOpenChange={(open) => {
            if (!open) closeDeleteDialog()
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete order</DialogTitle>
              <DialogDescription>
                Enter the manager username and password to permanently remove order #{deleteOrderId}. This cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label htmlFor="delete-order-username">Username</Label>
                <Input
                  id="delete-order-username"
                  autoComplete="username"
                  value={deleteAuthUsername}
                  onChange={(e) => setDeleteAuthUsername(e.target.value)}
                  placeholder="Username"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="delete-order-password">Password</Label>
                <Input
                  id="delete-order-password"
                  type="password"
                  autoComplete="current-password"
                  value={deleteAuthPassword}
                  onChange={(e) => setDeleteAuthPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeDeleteDialog}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting}
                onClick={() => void confirmDeleteWithAuth()}
              >
                {isDeleting ? "Deleting…" : "Delete order"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

function OrderList({
  orders,
  onStatusChange,
  onEdit,
  onDelete,
  onPrintDineInBill,
  dineInBillPrintedIds,
}: {
  orders: UiOrder[]
  onStatusChange: (order: UiOrder, status: OrderStatus) => void
  onEdit: (order: UiOrder) => void
  onDelete: (orderId: number) => void
  onPrintDineInBill: (order: UiOrder) => void
  dineInBillPrintedIds: ReadonlySet<number>
}) {
  if (orders.length === 0) {
    return (
      <Card className="modern-card shadow-modern border-0">
        <CardContent className="py-16 text-center text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">No orders in this category</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orders.map((order) => (
        <OrderCard
          key={order.orderId}
          order={order}
          onStatusChange={(status) => onStatusChange(order, status)}
          onEdit={() => onEdit(order)}
          onDelete={() => onDelete(order.orderId)}
          onPrintDineInBill={() => onPrintDineInBill(order)}
          dineInBillPrinted={dineInBillPrintedIds.has(order.orderId)}
        />
      ))}
    </div>
  )
}

function OrderCard({
  order,
  onStatusChange,
  onEdit,
  onDelete,
  onPrintDineInBill,
  dineInBillPrinted,
}: {
  order: UiOrder
  onStatusChange: (status: OrderStatus) => void
  onEdit: () => void
  onDelete: () => void
  onPrintDineInBill: () => void
  dineInBillPrinted: boolean
}) {
  const canChangeStatus = order.status !== "PAID" && order.status !== "CANCELLED"
  const showDineInPrintBill = order.orderType === "DINE_IN" && canChangeStatus
  const markPaidDisabled =
    canChangeStatus && order.orderType === "DINE_IN" && !dineInBillPrinted
  const StatusIcon = statusIcons[order.status]

  return (
    <Card className={cn("modern-card shadow-modern border border-border/50 overflow-hidden", statusBorderColors[order.status])}>
      <div className={cn("px-4 py-2 border-b border-border/50 flex items-center justify-between", statusColors[order.status])}>
        <span className="font-semibold text-sm flex items-center gap-2">
          <StatusIcon className="h-4 w-4" />
          {statusLabels[order.status]}
        </span>
        <span className="text-xs opacity-90">{formatTime(order.createdAt || order.orderDate)}</span>
      </div>

      <CardHeader className="pb-2 pt-3 px-4">
        <p className="text-sm font-medium text-muted-foreground mb-2">
          {order.orderType === "DINE_IN" ? `Table ${order.tableNumber ?? "-"}` : String(order.orderType).replace(/_/g, " ")}
        </p>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold">
            <span className="text-primary">Order #{order.orderId}</span>
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {order.items.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">No items</p>
        ) : (
          <ul className="space-y-1 mb-4 text-sm">
            {order.items.map((item) => (
              <li key={item.orderItemId} className="flex justify-between">
                <span>
                  {item.name}
                  {item.portionType ? `(${item.portionType})` : ""}
                  {" x "}
                  {item.quantity}
                </span>
                <span className="text-muted-foreground">{formatCurrency(item.subtotal)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="font-semibold">Total</span>
          <span className="font-bold text-primary">{formatCurrency(order.totalAmount)}</span>
        </div>

        {showDineInPrintBill ? (
          <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={onPrintDineInBill}>
            Print customer bill
          </Button>
        ) : null}

        {canChangeStatus && (
          <div className="mt-3">
            <Button
              size="sm"
              className="w-full"
              disabled={markPaidDisabled}
              title={
                markPaidDisabled
                  ? "Print the customer bill from the preview first, then you can mark as paid."
                  : undefined
              }
              onClick={() => onStatusChange("PAID")}
            >
              Mark as Paid
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type DraftExistingLine = {
  kind: "existing"
  orderItemId: number
  productId: number
  name: string
  portionType: PortionType | null
  unitPrice: number
  quantity: number
}

type DraftNewLine = {
  kind: "new"
  tempId: string
  productId: number | ""
  name: string
  portionType: PortionType | null
  unitPrice: number
  quantity: number
}

type DraftLine = DraftExistingLine | DraftNewLine

function unitPriceForOrderLine(product: ProductResponseDto, portion: PortionType | null): number {
  if (!product.hasPortionPricing) return product.sellingPrice
  if (portion === "MEDIUM" || portion === "LARGE") {
    const v = product.portionPrices?.[portion]
    if (typeof v === "number" && Number.isFinite(v)) return v
  }
  return product.sellingPrice
}

function EditOrderDialog({
  order,
  onClose,
  onRefresh,
  onShowPaidBill,
}: {
  order: UiOrder | null
  onClose: () => void
  onRefresh: () => Promise<void>
  onShowPaidBill?: (payload: OrderBillsPayload) => void
}) {
  const [tableNumber, setTableNumber] = useState<string>("")
  const [status, setStatus] = useState<OrderStatus>("NEW")
  const [saving, setSaving] = useState(false)
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [deletedOrderItemIds, setDeletedOrderItemIds] = useState<number[]>([])
  const [products, setProducts] = useState<ProductResponseDto[]>([])

  useEffect(() => {
    if (!order) return
    setTableNumber(order.tableNumber == null ? "" : String(order.tableNumber))
    setStatus(normalizeOrderStatus(order.status))
    setDeletedOrderItemIds([])
    setDraftLines(
      order.items.map((i) => ({
        kind: "existing" as const,
        orderItemId: i.orderItemId,
        productId: i.productId,
        name: i.name,
        portionType: i.portionType ?? null,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
    )
  }, [order])

  useEffect(() => {
    if (!order) return
    getAllProducts()
      .then(setProducts)
      .catch((e) => console.error(e))
  }, [order])

  const isDineIn: boolean = (order?.orderType as OrderType | undefined) === "DINE_IN"

  const setQtyAt = (index: number, raw: string) => {
    const q = Number.parseInt(raw, 10)
    if (!Number.isFinite(q) || q < 1) return
    setDraftLines((prev) => prev.map((line, i) => (i === index ? { ...line, quantity: q } : line)))
  }

  const removeLineAt = (index: number) => {
    setDraftLines((prev) => {
      const line = prev[index]
      if (line?.kind === "existing") {
        setDeletedOrderItemIds((ids) => [...ids, line.orderItemId])
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const addBlankLine = () => {
    setDraftLines((prev) => [
      ...prev,
      {
        kind: "new",
        tempId: `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        productId: "",
        name: "",
        portionType: null,
        unitPrice: 0,
        quantity: 1,
      },
    ])
  }

  const updateNewLineProduct = (index: number, productIdStr: string) => {
    const pid = productIdStr === "" ? "" : Number(productIdStr)
    const product = typeof pid === "number" && Number.isFinite(pid) ? products.find((p) => p.productId === pid) : undefined
    setDraftLines((prev) =>
      prev.map((line, i) => {
        if (i !== index || line.kind !== "new") return line
        if (!product) {
          return { ...line, productId: "", name: "", portionType: null, unitPrice: 0 }
        }
        const portion = product.hasPortionPricing ? ("MEDIUM" as PortionType) : null
        return {
          ...line,
          productId: product.productId,
          name: product.name,
          portionType: portion,
          unitPrice: unitPriceForOrderLine(product, portion),
        }
      }),
    )
  }

  const updateNewLinePortion = (index: number, portion: PortionType | null) => {
    setDraftLines((prev) =>
      prev.map((line, i) => {
        if (i !== index || line.kind !== "new" || line.productId === "") return line
        const product = products.find((p) => p.productId === line.productId)
        if (!product) return line
        return {
          ...line,
          portionType: portion,
          unitPrice: unitPriceForOrderLine(product, portion),
        }
      }),
    )
  }

  const handleSave = async () => {
    if (!order) return
    const parsedTable = tableNumber.trim() === "" ? null : Number(tableNumber)
    if (isDineIn && (!parsedTable || parsedTable <= 0)) {
      toast.error("Enter a valid table number for dine-in orders.")
      return
    }
    if (!isDineIn && parsedTable != null) {
      toast.error("Table number is only for dine-in.")
      return
    }

    for (const line of draftLines) {
      if (line.quantity < 1) {
        toast.error("Each line needs quantity at least 1.")
        return
      }
      if (line.kind === "new") {
        if (line.productId === "") {
          toast.error("Select a product for each new line.")
          return
        }
        const p = products.find((x) => x.productId === line.productId)
        if (p?.hasPortionPricing && (line.portionType !== "MEDIUM" && line.portionType !== "LARGE")) {
          toast.error("Select Medium or Large for portion-priced products.")
          return
        }
      }
    }

    setSaving(true)
    try {
      for (const id of [...new Set(deletedOrderItemIds)]) {
        await deleteOrderItem(id)
      }

      for (const line of draftLines) {
        const subtotal = Number((line.unitPrice * line.quantity).toFixed(2))
        if (line.kind === "existing") {
          await patchOrderItem(line.orderItemId, {
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            subtotal,
          })
        } else {
          await createOrderItem({
            orderId: order.orderId,
            productId: line.productId as number,
            quantity: line.quantity,
            portionType: line.portionType,
            unitPrice: line.unitPrice,
            subtotal,
          })
        }
      }

      const newSubtotal = draftLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
      const totalAmount = Number(newSubtotal.toFixed(2))

      await patchOrder(order.orderId, {
        tableNumber: isDineIn ? parsedTable : null,
        status,
        totalAmount,
        taxAmount: 0,
        discountAmount: order.discountAmount ?? 0,
      })

      if (status !== "PAID" && status !== "CANCELLED") {
        const newLineTickets = buildKitchenTicketsForNewDraftLines(order, draftLines, products, parsedTable)
        if (newLineTickets.length > 0) {
          printKitchenTicketsForStationsSequentially(newLineTickets, new Date())
          toast.success("New items sent to kitchen printers.")
        }
      }

      if (status === "PAID" && !isDineIn) {
        const billLines = draftLines.map((l) => ({
          name: l.name,
          qty: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: Number((l.unitPrice * l.quantity).toFixed(2)),
          portion: portionLabelForBill(l.portionType),
        }))
        onShowPaidBill?.({
          customer: {
            orderId: order.orderId,
            lines: billLines,
            subtotal: Number(draftTotal.toFixed(2)),
            taxAmount: 0,
            total: totalAmount,
            tableLabel: isDineIn && parsedTable ? String(parsedTable) : "—",
            paymentLabel: "",
            orderTypeLabel: orderTypeLabels[order.orderType],
          },
          kitchenTickets: [],
        })
      }

      await onRefresh()
      toast.success("Order updated")
      onClose()
    } catch (e) {
      console.error(e)
      toast.error("Failed to save order")
    } finally {
      setSaving(false)
    }
  }

  if (!order) return null

  const draftTotal = draftLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit order #{order.orderId}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Table Number</Label>
            <Input
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              min={1}
              disabled={!isDineIn}
              placeholder={isDineIn ? "Enter table number" : "Not applicable"}
            />
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
            >
              <option value="NEW">Pending</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="UPDATED">UPDATED</option>
            </select>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={addBlankLine}>
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-3">
              {draftLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lines. Add a product or cancel.</p>
              ) : (
                draftLines.map((line, idx) => (
                  <div key={line.kind === "existing" ? `e-${line.orderItemId}` : line.tempId} className="grid gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                    {line.kind === "existing" ? (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium leading-tight">
                            {line.name}
                            {line.portionType ? (
                              <span className="text-muted-foreground font-normal"> ({line.portionType})</span>
                            ) : null}
                          </span>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeLineAt(idx)} aria-label="Remove line">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              className="h-9"
                              value={line.quantity}
                              onChange={(e) => setQtyAt(idx, e.target.value)}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground pb-2 whitespace-nowrap">{formatCurrency(line.unitPrice)} each</div>
                          <div className="text-sm font-semibold pb-2 text-right">{formatCurrency(line.unitPrice * line.quantity)}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <select
                            className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                            value={line.productId === "" ? "" : String(line.productId)}
                            onChange={(e) => updateNewLineProduct(idx, e.target.value)}
                          >
                            <option value="">Select product…</option>
                            {products.map((p) => (
                              <option key={p.productId} value={String(p.productId)}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeLineAt(idx)} aria-label="Remove line">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {line.productId !== "" && products.find((p) => p.productId === line.productId)?.hasPortionPricing ? (
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Portion</Label>
                            <select
                              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                              value={line.portionType ?? ""}
                              onChange={(e) => {
                                const v = e.target.value
                                updateNewLinePortion(idx, v === "MEDIUM" || v === "LARGE" ? v : null)
                              }}
                            >
                              <option value="MEDIUM">Medium</option>
                              <option value="LARGE">Large</option>
                            </select>
                          </div>
                        ) : null}
                        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Qty</Label>
                            <Input type="number" min={1} className="h-9" value={line.quantity} onChange={(e) => setQtyAt(idx, e.target.value)} />
                          </div>
                          <div className="text-xs text-muted-foreground pb-2 whitespace-nowrap">{formatCurrency(line.unitPrice)} each</div>
                          <div className="text-sm font-semibold pb-2 text-right">{formatCurrency(line.unitPrice * line.quantity)}</div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Lines total</span>
                <span>{formatCurrency(draftTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || (isDineIn && (tableNumber.trim() === "" || Number(tableNumber) <= 0))}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
