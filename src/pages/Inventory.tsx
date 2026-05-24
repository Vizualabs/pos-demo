import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, Package, Search, Trash2, Pencil, CookingPot, Plus, Minus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import {
  applyInventoryUsageDeductions,
  createInventoryItem,
  deleteInventoryItem,
  getAllInventoryItems,
  updateInventoryItem,
  type InventoryItemResponseDto,
} from "@/lib/inventoryApi"

type InventoryStatus = "critical" | "low" | "good"

function computeStatus(quantity: number, lowStockThreshold: number): InventoryStatus {
  if (quantity <= lowStockThreshold) return "critical"
  if (quantity <= lowStockThreshold * 1.5) return "low"
  return "good"
}

const Inventory = () => {
  const [items, setItems] = useState<InventoryItemResponseDto[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")

  const [addOpen, setAddOpen] = useState(false)
  const [newItem, setNewItem] = useState({
    itemName: "",
    quantity: "",
    lowStockThreshold: "",
    costPerUnit: "",
  })

  const [editOpen, setEditOpen] = useState(false)
  const [editItemId, setEditItemId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    itemName: "",
    quantity: "",
    lowStockThreshold: "",
    costPerUnit: "",
  })

  const [usageOpen, setUsageOpen] = useState(false)
  const [usageLines, setUsageLines] = useState<{ itemId: number | ""; quantity: string }[]>([])
  const [usageSaving, setUsageSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAllInventoryItems()
      setItems(data)
    } catch (e) {
      console.error(e)
      toast.error("Failed to load inventory items")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.itemName.toLowerCase().includes(q))
  }, [items, query])

  const stats = useMemo(() => {
    const withStatus = items.map((i) => ({
      ...i,
      status: computeStatus(i.quantity, i.lowStockThreshold),
    }))

    const low = withStatus.filter((i) => i.status === "low").length
    const critical = withStatus.filter((i) => i.status === "critical").length
    const totalQty = withStatus.reduce((sum, i) => sum + (Number.isFinite(i.quantity) ? i.quantity : 0), 0)

    return { totalItems: items.length, low, critical, totalQty }
  }, [items])

  const validateAndParse = (body: {
    itemName: string
    quantity: string
    lowStockThreshold: string
    costPerUnit: string
  }) => {
    const itemName = body.itemName.trim()
    const quantity = Number(body.quantity)
    const lowStockThreshold = Number(body.lowStockThreshold)
    const costPerUnit = Number(body.costPerUnit)

    if (!itemName) return { ok: false as const, message: "Item name is required" }
    if (!Number.isFinite(quantity) || quantity < 0) return { ok: false as const, message: "Quantity must be 0 or more" }
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0)
      return { ok: false as const, message: "Low stock threshold must be 0 or more" }
    if (!Number.isFinite(costPerUnit) || costPerUnit < 0)
      return { ok: false as const, message: "Cost per unit (LKR) must be 0 or more" }
    if (lowStockThreshold > quantity)
      return { ok: false as const, message: "Low stock threshold cannot be greater than quantity" }

    return { ok: true as const, value: { itemName, quantity, lowStockThreshold, costPerUnit } }
  }

  const handleAddItem = async () => {
    const parsed = validateAndParse(newItem)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }

    try {
      const created = await createInventoryItem(parsed.value)
      setItems((prev) => [created, ...prev])
      setNewItem({ itemName: "", quantity: "", lowStockThreshold: "", costPerUnit: "" })
      setAddOpen(false)
      toast.success("Inventory item created")
    } catch (e) {
      console.error(e)
      toast.error("Failed to create inventory item")
    }
  }

  const openEdit = (item: InventoryItemResponseDto) => {
    setEditItemId(item.itemId)
    setEditForm({
      itemName: item.itemName,
      quantity: String(item.quantity),
      lowStockThreshold: String(item.lowStockThreshold),
      costPerUnit: String(item.costPerUnit ?? 0),
    })
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (editItemId == null) return

    const parsed = validateAndParse(editForm)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }

    try {
      const updated = await updateInventoryItem(editItemId, parsed.value)
      setItems((prev) => prev.map((p) => (p.itemId === updated.itemId ? updated : p)))
      setEditOpen(false)
      toast.success("Inventory item updated")
    } catch (e) {
      console.error(e)
      toast.error("Failed to update inventory item")
    }
  }

  const handleDelete = async (itemId: number) => {
    const confirmed = window.confirm("Delete this inventory item?")
    if (!confirmed) return

    try {
      await deleteInventoryItem(itemId)
      setItems((prev) => prev.filter((p) => p.itemId !== itemId))
      toast.success("Inventory item deleted")
    } catch (e) {
      console.error(e)
      toast.error("Failed to delete inventory item")
    }
  }

  const openUsageDialog = () => {
    setUsageLines([{ itemId: "", quantity: "" }])
    setUsageOpen(true)
  }

  const handleSaveUsage = async () => {
    const payload = usageLines
      .filter((l) => l.itemId !== "" || l.quantity.trim() !== "")
      .map((l) => ({ itemId: l.itemId as number, quantity: Number(l.quantity) }))
    if (payload.length === 0) {
      toast.error("Add at least one usage line.")
      return
    }
    for (const line of payload) {
      if (!Number.isFinite(line.itemId) || line.itemId <= 0) {
        toast.error("Select a valid inventory item for each line.")
        return
      }
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        toast.error("Qty used must be greater than 0 for each line.")
        return
      }
    }
    setUsageSaving(true)
    try {
      const next = await applyInventoryUsageDeductions(payload)
      setItems(next)
      setUsageOpen(false)
      toast.success("Stock updated — quantities deducted from inventory")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Could not apply usage")
    } finally {
      setUsageSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">Track and manage your stock</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Quantities use <span className="font-medium">kg</span> or <span className="font-medium">litres (L)</span> per
              item label. Use <span className="font-medium">Record catering use</span> to subtract stock after an event.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={openUsageDialog} disabled={items.length === 0}>
              <CookingPot className="w-4 h-4" />
              Record catering use
            </Button>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Package className="w-4 h-4" />
                  Add Item
                </Button>
              </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Inventory Item</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="item-name">Item Name</Label>
                  <Input
                    id="item-name"
                    value={newItem.itemName}
                    onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                    placeholder="Enter item name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="item-qty">Quantity</Label>
                  <Input
                    id="item-qty"
                    type="number"
                    inputMode="decimal"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                    placeholder="e.g. 25"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="item-threshold">Low Stock Threshold</Label>
                  <Input
                    id="item-threshold"
                    type="number"
                    inputMode="decimal"
                    value={newItem.lowStockThreshold}
                    onChange={(e) => setNewItem({ ...newItem, lowStockThreshold: e.target.value })}
                    placeholder="e.g. 5"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="item-cost">Cost per kg / L (LKR)</Label>
                  <Input
                    id="item-cost"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={newItem.costPerUnit}
                    onChange={(e) => setNewItem({ ...newItem, costPerUnit: e.target.value })}
                    placeholder="e.g. 180"
                  />
                  <p className="text-xs text-muted-foreground">Used to calculate menu recipe cost.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddItem}>Add Item</Button>
              </div>
            </DialogContent>
          </Dialog>

            <Dialog open={usageOpen} onOpenChange={setUsageOpen}>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Record catering / stock use</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Add each ingredient you used (same units as inventory: kg or L). Saving subtracts these amounts from
                  current stock.
                </p>
                <div className="space-y-3 py-2">
                  {usageLines.map((line, idx) => (
                    <div key={idx} className="flex flex-wrap items-end gap-2">
                      <div className="grid gap-1 flex-1 min-w-[140px]">
                        <Label className="text-xs">Item</Label>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={line.itemId === "" ? "" : String(line.itemId)}
                          onChange={(e) => {
                            const v = e.target.value
                            setUsageLines((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, itemId: v === "" ? "" : Number(v) } : p)),
                            )
                          }}
                        >
                          <option value="">Select item</option>
                          {items.map((i) => (
                            <option key={i.itemId} value={i.itemId}>
                              {i.itemName} (in stock: {i.quantity})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-1 w-28">
                        <Label className="text-xs">Qty used</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={line.quantity}
                          onChange={(e) =>
                            setUsageLines((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: e.target.value } : p)))
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        disabled={usageLines.length <= 1}
                        onClick={() => setUsageLines((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove line"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                    onClick={() => setUsageLines((prev) => [...prev, { itemId: "", quantity: "" }])}
                  >
                    <Plus className="h-4 w-4" />
                    Add line
                  </Button>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={() => setUsageOpen(false)} disabled={usageSaving}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void handleSaveUsage()} disabled={usageSaving}>
                    {usageSaving ? "Saving…" : "Save & deduct stock"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold mt-1">{stats.totalItems}</p>
                </div>
                <Package className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold mt-1 text-warning">{stats.low}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical Stock</p>
                  <p className="text-2xl font-bold mt-1 text-destructive">{stats.critical}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Quantity</p>
                  <p className="text-2xl font-bold mt-1">{stats.totalQty}</p>
                </div>
                <Package className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Inventory Items</CardTitle>

              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  className="pl-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">No items found</div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => {
                  const status = computeStatus(item.quantity, item.lowStockThreshold)

                  return (
                    <div key={item.itemId} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className={`w-2 h-12 rounded ${
                            status === "critical" ? "bg-destructive" : status === "low" ? "bg-warning" : "bg-success"
                          }`}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{item.itemName}</p>
                          <p className="text-sm text-muted-foreground">
                            Low: {item.lowStockThreshold} · Cost/kg: {formatCurrency(item.costPerUnit ?? 0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-2xl font-bold">{item.quantity}</p>
                          <p className="text-sm text-muted-foreground">qty</p>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                            Adjust
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDelete(item.itemId)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Update Inventory Item</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Item Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.itemName}
                  onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-qty">Quantity</Label>
                <Input
                  id="edit-qty"
                  type="number"
                  inputMode="decimal"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-threshold">Low Stock Threshold</Label>
                <Input
                  id="edit-threshold"
                  type="number"
                  inputMode="decimal"
                  value={editForm.lowStockThreshold}
                  onChange={(e) => setEditForm({ ...editForm, lowStockThreshold: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-cost">Cost per kg / L (LKR)</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={editForm.costPerUnit}
                  onChange={(e) => setEditForm({ ...editForm, costPerUnit: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

export default Inventory