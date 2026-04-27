import { useEffect, useMemo, useRef, useState } from "react"
import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, UtensilsCrossed, Trash2, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency, cn } from "@/lib/utils"
import { formatItemCode, parseProductIdInput } from "@/lib/itemCode"
import {
  getAllProducts,
  createProduct,
  patchProduct,
  deleteProduct,
  uploadProductImage,
  type ProductResponseDto,
  type PortionPrices,
} from "@/lib/productsApi"
import { createCategory, getAllCategories, type CategoryResponseDto } from "@/lib/categoriesApi"
import { getAllInventoryItems, type InventoryItemResponseDto } from "@/lib/inventoryApi"
import type { Kitchen } from "@/lib/ordersApi"
import { computeRecipeCostLkr } from "@/lib/recipeCost"
import { apiFetchBlob } from "@/lib/apiClient"

type RecipeLineForm = { itemId: number | ""; quantity: string }

const MenuItems = () => {
  const [items, setItems] = useState<ProductResponseDto[]>([])
  const [categories, setCategories] = useState<CategoryResponseDto[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItemResponseDto[]>([])

  const nextProductId = useMemo(() => {
    if (items.length === 0) return 1
    const ids = items.map((p) => Number(p.productId)).filter((n) => Number.isFinite(n) && n >= 1)
    return ids.length > 0 ? Math.max(...ids) + 1 : 1
  }, [items])

  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)

  const [newItem, setNewItem] = useState({
    name: "",
    nameSinhala: "",
    price: "", // small / default selling price
    categoryId: "" as number | "",
    kitchen: "KITCHEN_1" as Kitchen,
    description: "",

    hasPortionPricing: false,
    mediumPrice: "",
    largePrice: "",
    skipKitchenTicket: false,
  })

  const [productIdDraft, setProductIdDraft] = useState("")
  const [recipeLines, setRecipeLines] = useState<RecipeLineForm[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isSavingCategory, setIsSavingCategory] = useState(false)

  const [imageObjectUrls, setImageObjectUrls] = useState<Record<number, { imageUrl: string; objectUrl: string }>>({})

  const imageObjectUrlsRef = useRef(imageObjectUrls)
  useEffect(() => {
    imageObjectUrlsRef.current = imageObjectUrls
  }, [imageObjectUrls])

  useEffect(() => {
    let cancelled = false

    const currentIds = new Set(items.map((i) => i.productId))

    // Remove stale entries (items removed or imageUrl changed)
    setImageObjectUrls((prev) => {
      let changed = false
      const next: typeof prev = {}
      for (const [k, v] of Object.entries(prev)) {
        const id = Number(k)
        const item = items.find((i) => i.productId === id)

        if (!currentIds.has(id) || !item?.imageUrl || item.imageUrl !== v.imageUrl) {
          changed = true
          URL.revokeObjectURL(v.objectUrl)
          continue
        }

        next[id] = v
      }
      return changed ? next : prev
    })

    const toFetch = items.filter((i) => i.imageUrl && !i.imageUrl.startsWith("http"))
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
          } catch (e) {
            // Some backends store the path in imageUrl but only serve the bytes
            // via a secured API endpoint.
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
          console.warn("Failed to load product image", item.productId, item.imageUrl, e)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [items])

  useEffect(() => {
    return () => {
      for (const v of Object.values(imageObjectUrlsRef.current)) {
        URL.revokeObjectURL(v.objectUrl)
      }
    }
  }, [])

  const refreshCategories = async () => {
    setIsLoadingCategories(true)
    try {
      const cats = await getAllCategories()
      const active = cats.filter((c) => c.isActive !== false)

      // normalize ids to numbers + dedupe by categoryId
      const unique = new Map<number, CategoryResponseDto>()
      for (const c of active) {
        const id = Number((c as any).categoryId)
        if (Number.isFinite(id)) unique.set(id, { ...c, categoryId: id })
      }

      setCategories(Array.from(unique.values()))
    } finally {
      setIsLoadingCategories(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setIsLoadingCategories(true)

        const [cats, prods, inv] = await Promise.all([getAllCategories(), getAllProducts(), getAllInventoryItems()])
        if (cancelled) return

        const active = cats.filter((c) => c.isActive !== false)

        const unique = new Map<number, CategoryResponseDto>()
        for (const c of active) {
          const id = Number((c as any).categoryId)
          if (Number.isFinite(id)) unique.set(id, { ...c, categoryId: id })
        }

        setCategories(Array.from(unique.values()))
        setItems(prods)
        setInventoryItems(inv)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setUploadError("Failed to load categories, products, or inventory. Please refresh the page.")
          setCategories([]) // removed hardcoded categories
          setInventoryItems([])
        }
      } finally {
        if (!cancelled) setIsLoadingCategories(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const resetForm = () => {
    setNewItem({
      name: "",
      nameSinhala: "",
      price: "",
      categoryId: "",
      kitchen: "KITCHEN_1",
      description: "",
      hasPortionPricing: false,
      mediumPrice: "",
      largePrice: "",
      skipKitchenTicket: false,
    })
    setProductIdDraft("")
    setRecipeLines([])
    setImageFile(null)
    setUploadError(null)
    setIsSaving(false)
    setIsAddingCategory(false)
    setNewCategoryName("")
    setIsSavingCategory(false)
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name || isSavingCategory) return

    setIsSavingCategory(true)
    setUploadError(null)

    try {
      const created = await createCategory(name)

      // refresh list from backend so the dropdown is up-to-date
      await refreshCategories()

      // keep the newly created category selected
      setNewItem((prev) => ({ ...prev, categoryId: created.categoryId }))

      setNewCategoryName("")
      setIsAddingCategory(false)
    } catch (e) {
      console.error(e)
      setUploadError("Failed to create category. Please try again.")
    } finally {
      setIsSavingCategory(false)
    }
  }

  const usedInventoryIds = useMemo(() => {
    const ids = new Set<number>()
    for (const line of recipeLines) if (line.itemId !== "") ids.add(line.itemId)
    return ids
  }, [recipeLines])

  const recipeForCost = useMemo(() => {
    return recipeLines
      .map((l) => ({
        itemId: l.itemId === "" ? NaN : l.itemId,
        quantity: Number.parseFloat(l.quantity),
      }))
      .filter((l) => Number.isFinite(l.itemId) && Number.isFinite(l.quantity) && l.quantity > 0)
  }, [recipeLines])

  const calculatedIngredientCost = useMemo(() => {
    if (recipeForCost.length === 0) return null
    return computeRecipeCostLkr(recipeForCost, inventoryItems)
  }, [recipeForCost, inventoryItems])

  const handleSaveItem = async () => {
    if (!newItem.name || !newItem.price || newItem.categoryId === "") return

    const isEditing = editingProductId !== null
    let createProductId: number | undefined
    if (!isEditing) {
      const parsedId = parseProductIdInput(productIdDraft)
      if (parsedId == null) {
        setUploadError("Enter a valid item ID (e.g. 15 or ITM-0015).")
        return
      }
      if (items.some((p) => p.productId === parsedId)) {
        setUploadError(`${formatItemCode(parsedId)} is already used. Choose another ID.`)
        return
      }
      createProductId = parsedId
    }

    setIsSaving(true)
    setUploadError(null)

    const existingProduct = isEditing ? items.find((p) => p.productId === editingProductId) : null

    const basePrice = Number.parseFloat(newItem.price)
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setUploadError("Invalid price.")
      setIsSaving(false)
      return
    }

    const isShowcase = newItem.skipKitchenTicket

    let portionPrices: PortionPrices = {}
    if (!isShowcase && newItem.hasPortionPricing) {
      const medium = Number.parseFloat(newItem.mediumPrice)
      const large = Number.parseFloat(newItem.largePrice)
      if (!Number.isFinite(medium) || medium < 0 || !Number.isFinite(large) || large < 0) {
        setUploadError("Please enter valid Medium and Large portion prices.")
        setIsSaving(false)
        return
      }
      portionPrices = { MEDIUM: medium, LARGE: large }
    }

    // Build recipe payload (kg) — showcase items never use recipe
    const recipe = isShowcase
      ? []
      : recipeLines
          .map((l) => ({
            itemId: l.itemId === "" ? NaN : l.itemId,
            quantity: Number.parseFloat(l.quantity),
          }))
          .filter((l) => Number.isFinite(l.itemId) && Number.isFinite(l.quantity) && l.quantity > 0)

    if (!isShowcase) {
      const hasAnyRecipeInput = recipeLines.some((l) => l.itemId !== "" || l.quantity.trim() !== "")
      const allRecipeValid = recipe.length === recipeLines.filter((l) => l.itemId !== "" || l.quantity.trim() !== "").length
      if (hasAnyRecipeInput && !allRecipeValid) {
        setUploadError("Recipe has invalid rows. Select an item and enter a quantity (kg) > 0 for each row.")
        setIsSaving(false)
        return
      }
    }

    const imageUrl: string | null =
      (existingProduct?.imageUrl ?? null) === "/placeholder.svg" ? null : (existingProduct?.imageUrl ?? null)

    const costPrice =
      !isShowcase && recipe.length > 0 && calculatedIngredientCost != null
        ? calculatedIngredientCost
        : Math.round(basePrice * 0.45)

    try {
      const payload = {
        categoryId: newItem.categoryId,
        kitchen: isShowcase ? ("KITCHEN_1" as Kitchen) : newItem.kitchen,
        name: newItem.name.trim(),
        nameSinhala: isShowcase ? null : newItem.nameSinhala.trim() || null,
        description: newItem.description.trim(),
        costPrice,
        /** Always the small/default POS price; M/L live in portionPrices only. */
        sellingPrice: basePrice,
        imageUrl,
        isAvailable: true,

        hasPortionPricing: isShowcase ? false : newItem.hasPortionPricing,
        portionPrices: isShowcase ? {} : portionPrices,
        recipe,
        skipKitchenTicket: isShowcase,
      }

      // 1) Create or update product (JSON)
      let saved: ProductResponseDto
      if (isEditing && existingProduct) {
        const prevHasPortionPricing = !!existingProduct.hasPortionPricing
        const nextHasPortionPricing = !!payload.hasPortionPricing

        const prevMedium = existingProduct.portionPrices?.MEDIUM
        const prevLarge = existingProduct.portionPrices?.LARGE
        const nextMedium = payload.portionPrices?.MEDIUM
        const nextLarge = payload.portionPrices?.LARGE

        const portionPricingChanged = prevHasPortionPricing !== nextHasPortionPricing
        const portionPricesChanged =
          nextHasPortionPricing && (prevMedium !== nextMedium || prevLarge !== nextLarge)
        const shouldSendPortionPricing = portionPricingChanged || portionPricesChanged

        // Workaround: backend PUT path attempts to INSERT portion price rows and
        // can hit unique constraints; PATCH + omitting unchanged portionPrices
        // avoids touching that collection on unrelated edits.
        const patch = {
          categoryId: payload.categoryId,
          kitchen: payload.kitchen,
          name: payload.name,
          nameSinhala: payload.nameSinhala,
          description: payload.description,
          costPrice: payload.costPrice,
          sellingPrice: payload.sellingPrice,
          imageUrl: payload.imageUrl,
          isAvailable: payload.isAvailable,
          recipe: payload.recipe,
          skipKitchenTicket: payload.skipKitchenTicket,
          productId: existingProduct.productId,
          ...(shouldSendPortionPricing
            ? {
                hasPortionPricing: nextHasPortionPricing,
                portionPrices: nextHasPortionPricing ? payload.portionPrices : {},
              }
            : {}),
        }

        saved = await patchProduct(existingProduct.productId, patch)
        setItems((prev) => prev.map((p) => (p.productId === saved.productId ? saved : p)))
        toast.success(`Item ${formatItemCode(saved.productId)} updated`)
      } else {
        saved = await createProduct({ ...payload, productId: createProductId })
        setItems((prev) => [...prev, saved])
        toast.success(`Item saved with ID ${formatItemCode(saved.productId)}`)
      }

      // 2) If an image file is selected, upload it (multipart)
      if (imageFile) {
        try {
          const withImage = await uploadProductImage(saved.productId, imageFile)
          setItems((prev) => prev.map((p) => (p.productId === withImage.productId ? withImage : p)))
        } catch (e) {
          console.error(e)
          setUploadError("Image upload failed. Product was saved without updating the image.")
        }
      }

      resetForm()
      setEditingProductId(null)
      setIsDialogOpen(false)
    } catch (e) {
      console.error(e)
      setUploadError(e instanceof Error ? e.message : "Failed to save product. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (productId: number) => {
    try {
      await deleteProduct(productId)
      setItems((prev) => prev.filter((p) => p.productId !== productId))
    } catch (error) {
      console.error(error)
      setUploadError("Failed to delete product.")
    }
  }

  const canSave =
    !isSaving &&
    !!newItem.name &&
    !!newItem.price &&
    newItem.categoryId !== "" &&
    (editingProductId != null || parseProductIdInput(productIdDraft) != null) &&
    (newItem.skipKitchenTicket || !newItem.hasPortionPricing || (!!newItem.mediumPrice && !!newItem.largePrice))

  const setItemKind = (showcase: boolean) => {
    setNewItem((prev) => ({
      ...prev,
      skipKitchenTicket: showcase,
      ...(showcase
        ? {
            hasPortionPricing: false,
            mediumPrice: "",
            largePrice: "",
            nameSinhala: "",
            kitchen: "KITCHEN_1" as Kitchen,
          }
        : {}),
    }))
    if (showcase) setRecipeLines([])
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UtensilsCrossed className="h-5 w-5" />
              </span>
              Menu Items
            </h1>
            <p className="text-muted-foreground mt-1">Manage the items that appear in your POS terminal and QR menu.</p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) {
                resetForm()
                setEditingProductId(null)
              }
            }}
          >
            <DialogTrigger
              asChild
              onClick={() => {
                setEditingProductId(null)
                resetForm()
                setProductIdDraft(String(nextProductId))
              }}
            >
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Menu Item
              </Button>
            </DialogTrigger>

            <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-[520px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
              <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-2 pt-6 pr-14 text-left">
                <DialogTitle>
                  {editingProductId != null
                    ? newItem.skipKitchenTicket
                      ? "Edit showcase item"
                      : "Edit menu item"
                    : newItem.skipKitchenTicket
                      ? "Add showcase item"
                      : "Add menu item"}
                </DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-2">
              <div className="grid gap-4 pb-2">
                {editingProductId != null ? (
                  <div className="rounded-lg border border-muted bg-muted/30 px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-muted-foreground">Item ID</span>
                      <span className="font-mono font-semibold tabular-nums">{formatItemCode(editingProductId)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">ID cannot be changed after the item is created.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="item-product-id">Item ID</Label>
                    <Input
                      id="item-product-id"
                      className="font-mono tabular-nums"
                      value={productIdDraft}
                      onChange={(e) => setProductIdDraft(e.target.value)}
                      placeholder={`Suggested: ${formatItemCode(nextProductId)}`}
                      inputMode="numeric"
                    />
                    <p className="text-xs text-muted-foreground">
                      Type a number (e.g. <span className="font-mono">42</span>) or code (e.g.{" "}
                      <span className="font-mono">ITM-0042</span>). Must be unique. Default is the next free ID — edit if
                      you need a specific code.
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Item kind</Label>
                  <div className="flex gap-1 rounded-lg border border-input bg-muted/30 p-1">
                    <button
                      type="button"
                      onClick={() => setItemKind(false)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        !newItem.skipKitchenTicket
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Menu item
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemKind(true)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        newItem.skipKitchenTicket
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Showcase · bill only
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {newItem.skipKitchenTicket
                      ? "Receipt & POS only (no KOT). Fill name, category, price, and image — like drinks or retail."
                      : "Kitchen tickets, portions, recipe, and Sinhala name when needed."}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="item-name">Item Name</Label>
                  <Input
                    id="item-name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="E.g. Chicken Fried Rice"
                  />
                </div>

                {!newItem.skipKitchenTicket && (
                  <div className="grid gap-2">
                    <Label htmlFor="item-name-si">Kitchen ticket name (Sinhala, optional)</Label>
                    <Input
                      id="item-name-si"
                      value={newItem.nameSinhala}
                      onChange={(e) => setNewItem({ ...newItem, nameSinhala: e.target.value })}
                      placeholder="Shown on Sinhala KOT; English name if left empty"
                      style={{ fontFamily: "'Noto Sans Sinhala', system-ui, sans-serif" }}
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="item-category">Category</Label>
                  <div className="flex gap-2">
                    <select
                      id="item-category"
                      value={newItem.categoryId === "" ? "" : String(newItem.categoryId)}
                      disabled={isLoadingCategories}
                      onChange={(e) =>
                        setNewItem({
                          ...newItem,
                          categoryId: e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="">{isLoadingCategories ? "Loading categories..." : "Select category"}</option>
                      {categories.map((c) => (
                        <option key={c.categoryId} value={String(c.categoryId)}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsAddingCategory((prev) => !prev)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {isAddingCategory && (
                    <div className="mt-2 flex gap-2">
                      <Input
                        placeholder="New category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCategory}
                        disabled={isSavingCategory || !newCategoryName.trim()}
                      >
                        {isSavingCategory ? "Saving..." : "Add"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsAddingCategory(false)
                          setNewCategoryName("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {!newItem.skipKitchenTicket && (
                  <div className="grid gap-2">
                    <Label htmlFor="item-kitchen">Kitchen</Label>
                    <select
                      id="item-kitchen"
                      value={newItem.kitchen}
                      onChange={(e) => setNewItem({ ...newItem, kitchen: e.target.value as Kitchen })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      <option value="KITCHEN_1">Kitchen 1</option>
                      <option value="KITCHEN_2">Kitchen 2</option>
                    </select>
                    <p className="text-xs text-muted-foreground">Which station gets this item on the KOT.</p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="item-price">{newItem.skipKitchenTicket ? "Price" : "Small Price"}</Label>
                  <Input
                    id="item-price"
                    type="number"
                    min="0"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder={newItem.skipKitchenTicket ? "E.g. 120" : "E.g. 350"}
                  />
                  <p className="text-xs text-muted-foreground">
                    {newItem.skipKitchenTicket
                      ? "Selling price on the bill and POS."
                      : "Without portions, this is the selling price. With portion pricing, this is the small tier; Medium is the default POS/list price."}
                  </p>
                </div>

                {/* Portion pricing — menu items only */}
                {!newItem.skipKitchenTicket && (
                <div className="rounded-md border border-muted p-3 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Portion Pricing</p>
                      <p className="text-xs text-muted-foreground">Enable Medium/Large prices for this item.</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newItem.hasPortionPricing}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            hasPortionPricing: e.target.checked,
                            mediumPrice: e.target.checked ? prev.mediumPrice : "",
                            largePrice: e.target.checked ? prev.largePrice : "",
                          }))
                        }
                      />
                      Has portion pricing
                    </label>
                  </div>

                  {newItem.hasPortionPricing && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="portion-medium">Medium Price</Label>
                        <Input
                          id="portion-medium"
                          type="number"
                          min="0"
                          value={newItem.mediumPrice}
                          onChange={(e) => setNewItem({ ...newItem, mediumPrice: e.target.value })}
                          placeholder="E.g. 450"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="portion-large">Large Price</Label>
                        <Input
                          id="portion-large"
                          type="number"
                          min="0"
                          value={newItem.largePrice}
                          onChange={(e) => setNewItem({ ...newItem, largePrice: e.target.value })}
                          placeholder="E.g. 550"
                        />
                      </div>
                    </div>
                  )}
                </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="item-description">
                    {newItem.skipKitchenTicket ? "Note (optional)" : "Description / Ingredients"}
                  </Label>
                  <textarea
                    id="item-description"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    rows={newItem.skipKitchenTicket ? 2 : 3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={
                      newItem.skipKitchenTicket ? "Optional short note on the menu card" : "Short description, key ingredients, etc."
                    }
                  />
                </div>

                {/* Recipe — menu items only */}
                {!newItem.skipKitchenTicket && (
                <div className="rounded-md border border-muted p-3 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Recipe</p>
                      <p className="text-xs text-muted-foreground">
                        Select inventory items used and quantity in <span className="font-medium">kg</span>. Cost uses{" "}
                        <span className="font-medium">qty × unit cost (LKR/kg)</span> from inventory.
                      </p>
                      {calculatedIngredientCost != null && (
                        <p className="text-sm font-semibold text-primary mt-2">
                          Calculated cost (ingredients): {formatCurrency(calculatedIngredientCost)}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRecipeLines((prev) => [...prev, { itemId: "", quantity: "" }])}
                      disabled={inventoryItems.length === 0}
                    >
                      Add Ingredient
                    </Button>
                  </div>

                  {inventoryItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No inventory items loaded. Create inventory items first to build recipes.
                    </p>
                  ) : recipeLines.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recipe items added.</p>
                  ) : (
                    <div className="space-y-2">
                      {recipeLines.map((line, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_140px_36px] gap-2 items-end">
                          <div className="grid gap-1">
                            <Label className="text-xs">Inventory Item</Label>
                            <select
                              value={line.itemId === "" ? "" : String(line.itemId)}
                              onChange={(e) => {
                                const nextId = e.target.value === "" ? "" : Number(e.target.value)
                                setRecipeLines((prev) => prev.map((p, i) => (i === idx ? { ...p, itemId: nextId } : p)))
                              }}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            >
                              <option value="">Select item</option>
                              {inventoryItems.map((inv) => (
                                <option
                                  key={inv.itemId}
                                  value={String(inv.itemId)}
                                  disabled={usedInventoryIds.has(inv.itemId) && inv.itemId !== line.itemId}
                                >
                                  {inv.itemName}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid gap-1">
                            <Label className="text-xs">Qty (kg)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={line.quantity}
                              onChange={(e) =>
                                setRecipeLines((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: e.target.value } : p)))
                              }
                              placeholder="e.g. 0.25"
                            />
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setRecipeLines((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label="Remove ingredient"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="item-image-file">Item Image</Label>
                  <Input
                    id="item-image-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Select an image from your computer. If you don&apos;t select a file, imageUrl will remain null (or keep existing on edit).
                  </p>
                </div>

                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-background px-6 py-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveItem} disabled={!canSave}>
                  {isSaving ? "Saving..." : editingProductId ? "Update Item" : "Save Item"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="modern-card shadow-modern-lg border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Current Menu</CardTitle>
            <span className="text-sm text-muted-foreground">{items.length} items</span>
          </CardHeader>

          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <div className="mb-3 rounded-full bg-muted p-3">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <p className="font-medium">No menu items yet</p>
                <p className="text-sm">Click &quot;Add Menu Item&quot; to create your first item.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <Card
                    key={item.productId}
                    className="border border-muted/60 hover:shadow-modern transition-all duration-200"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                              {formatItemCode(item.productId)}
                            </Badge>
                            <h3 className="font-semibold truncate">{item.name}</h3>
                            <Badge className="bg-slate-100 text-slate-800" variant="outline">
                              {categories.find((c) => c.categoryId === item.categoryId)?.name ?? `Category ${item.categoryId}`}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm text-accent font-semibold">{formatCurrency(item.sellingPrice)}</p>
                            {item.skipKitchenTicket ? (
                              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-800 bg-amber-50">
                                Showcase · no KOT
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                {(item.kitchen ?? "KITCHEN_1") === "KITCHEN_2" ? "Kitchen 2" : "Kitchen 1"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">Cost: {formatCurrency(item.costPrice)}</p>

                          {item.hasPortionPricing && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Portions: MEDIUM {item.portionPrices?.MEDIUM != null ? formatCurrency(item.portionPrices.MEDIUM) : "-"}{" "}
                              · LARGE {item.portionPrices?.LARGE != null ? formatCurrency(item.portionPrices.LARGE) : "-"}
                            </p>
                          )}

                          {item.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingProductId(item.productId)
                              setProductIdDraft(String(item.productId))
                              setNewItem({
                                name: item.name,
                                nameSinhala: item.nameSinhala ?? "",
                                price: String(item.sellingPrice),
                                categoryId: item.categoryId,
                                kitchen: item.kitchen ?? "KITCHEN_1",
                                description: item.description ?? "",

                                hasPortionPricing: !!item.hasPortionPricing,
                                mediumPrice: item.portionPrices?.MEDIUM != null ? String(item.portionPrices.MEDIUM) : "",
                                largePrice: item.portionPrices?.LARGE != null ? String(item.portionPrices.LARGE) : "",
                                skipKitchenTicket: item.skipKitchenTicket === true,
                              })

                              setRecipeLines(
                                Array.isArray(item.recipe)
                                  ? item.recipe.map((r) => ({ itemId: r.itemId, quantity: String(r.quantity) }))
                                  : [],
                              )

                              setImageFile(null)
                              setUploadError(null)
                              setIsDialogOpen(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.productId)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const rawUrl = item.imageUrl
                        const resolvedUrl =
                          rawUrl && rawUrl.startsWith("http")
                            ? rawUrl
                            : rawUrl
                              ? (imageObjectUrls[item.productId]?.objectUrl ?? rawUrl)
                              : undefined

                        const hasImage = Boolean(resolvedUrl)

                        return (
                          <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                            <img
                              src={resolvedUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              style={{ display: hasImage ? undefined : "none" }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none"
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null
                                if (fallback) fallback.style.display = "flex"
                              }}
                            />
                            <div
                              className="flex flex-col items-center justify-center text-muted-foreground"
                              style={{ display: hasImage ? "none" : "flex" }}
                            >
                              <img src="/placeholder.svg" alt="" className="h-10 w-10 opacity-70" />
                              <span className="mt-1 text-xs">No image available</span>
                            </div>
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default MenuItems

