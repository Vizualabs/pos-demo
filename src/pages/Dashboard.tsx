"use client"

import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { StatCard } from "@/components/Dashboard/StatCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, ShoppingCart, Users, TrendingUp, Clock, CheckCircle, Store } from "lucide-react"
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils"
import { getAllOrders, type OrderResponseDto } from "@/lib/ordersApi"
import { getAllOrderItems, type OrderItemResponseDto } from "@/lib/orderItemsApi"
import { getAllProducts, type ProductResponseDto } from "@/lib/productsApi"
import { getAllInventoryItems, type InventoryItemResponseDto } from "@/lib/inventoryApi"

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
function inDay(iso: string, day: Date) {
  const dt = new Date(iso)
  return dt >= startOfDay(day) && dt <= endOfDay(day)
}
function startOfWeek(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay() // 0=Sun,1=Mon,...
  const diff = (day + 6) % 7 // monday-based
  copy.setDate(copy.getDate() - diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}
function inRange(iso: string, from: Date, to: Date) {
  const dt = new Date(iso)
  return dt >= from && dt <= to
}
function pctChange(today: number, yesterday: number) {
  if (!Number.isFinite(today) || !Number.isFinite(yesterday)) return null
  if (yesterday === 0) return null
  return ((today - yesterday) / yesterday) * 100
}
function fmtChangeLabel(p: number | null) {
  if (p == null) return "—"
  const abs = Math.abs(p)
  const sign = p >= 0 ? "+" : "-"
  return `${sign}${abs.toFixed(1)}% from yesterday`
}

type RecentOrderRow = {
  idLabel: string
  subLabel: string
  amount: number
  statusLabel: string
  icon: "paid" | "clock"
  timeLabel: string
}

type TopItemRow = {
  name: string
  sold: number
  revenue: number
}

type LowStockRow = {
  itemName: string
  stockLabel: string
  level: "critical" | "low"
}

const Dashboard = () => {
  const location = useLocation()
  const [orders, setOrders] = useState<OrderResponseDto[]>([])
  const [orderItems, setOrderItems] = useState<OrderItemResponseDto[]>([])
  const [products, setProducts] = useState<ProductResponseDto[]>([])
  const [inventory, setInventory] = useState<InventoryItemResponseDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (location.pathname !== "/dashboard") return

    let cancelled = false
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        const [o, oi, p, inv] = await Promise.allSettled([
          getAllOrders(),
          getAllOrderItems(),
          getAllProducts(),
          getAllInventoryItems(),
        ])

        if (cancelled) return

        setOrders(o.status === "fulfilled" ? o.value : [])
        setOrderItems(oi.status === "fulfilled" ? oi.value : [])
        setProducts(p.status === "fulfilled" ? p.value : [])
        setInventory(inv.status === "fulfilled" ? inv.value : [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchDashboardData()
    const intervalId = window.setInterval(() => {
      void fetchDashboardData()
    }, 15000)

    const onFocus = () => {
      void fetchDashboardData()
    }
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener("focus", onFocus)
    }
  }, [location.pathname])

  const productById = useMemo(() => {
    const m = new Map<number, ProductResponseDto>()
    for (const p of products) m.set(p.productId, p)
    return m
  }, [products])

  const now = new Date()
  const today = now
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const todaysOrders = useMemo(
    () => orders.filter((o) => inDay(o.orderDate ?? o.createdAt, today)),
    [orders, today],
  )
  const yesterdaysOrders = useMemo(
    () => orders.filter((o) => inDay(o.orderDate ?? o.createdAt, yesterday)),
    [orders, yesterday],
  )
  const weeklyOrders = useMemo(() => {
    const from = startOfWeek(today)
    return orders.filter((o) => inRange(o.orderDate ?? o.createdAt, from, endOfDay(today)))
  }, [orders, today])
  const monthlyOrders = useMemo(() => {
    const from = startOfMonth(today)
    return orders.filter((o) => inRange(o.orderDate ?? o.createdAt, from, endOfDay(today)))
  }, [orders, today])

  const todaysRevenue = useMemo(() => {
    // Prefer PAID orders; fall back to all if backend doesn’t use PAID consistently
    const paid = todaysOrders.filter((o) => String(o.status).toUpperCase() === "PAID")
    const list = paid.length > 0 ? paid : todaysOrders
    return list.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
  }, [todaysOrders])

  const yesterdaysRevenue = useMemo(() => {
    const paid = yesterdaysOrders.filter((o) => String(o.status).toUpperCase() === "PAID")
    const list = paid.length > 0 ? paid : yesterdaysOrders
    return list.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
  }, [yesterdaysOrders])
  const weeklyRevenue = useMemo(() => {
    const paid = weeklyOrders.filter((o) => String(o.status).toUpperCase() === "PAID")
    const list = paid.length > 0 ? paid : weeklyOrders
    return list.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
  }, [weeklyOrders])
  const monthlyRevenue = useMemo(() => {
    const paid = monthlyOrders.filter((o) => String(o.status).toUpperCase() === "PAID")
    const list = paid.length > 0 ? paid : monthlyOrders
    return list.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
  }, [monthlyOrders])

  const todaysOrderCount = todaysOrders.length
  const yesterdaysOrderCount = yesterdaysOrders.length

  const activeTables = useMemo(() => {
    // Consider "active" = DINE_IN + NEW
    const set = new Set<number>()
    for (const o of todaysOrders) {
      const isDineIn = String(o.orderType).toUpperCase() === "DINE_IN"
      const isNew = String(o.status).toUpperCase() === "NEW"
      const tn = o.tableNumber
      if (isDineIn && isNew && typeof tn === "number") set.add(tn)
    }
    return set.size
  }, [todaysOrders])

  const avgOrderValue = todaysOrderCount > 0 ? todaysRevenue / todaysOrderCount : 0

  const recentOrders: RecentOrderRow[] = useMemo(() => {
    const sorted = [...todaysOrders].sort(
      (a, b) => new Date(b.createdAt ?? b.orderDate).getTime() - new Date(a.createdAt ?? a.orderDate).getTime(),
    )

    const top = sorted.slice(0, 4)
    return top.map((o) => {
      const status = String(o.status).toUpperCase()
      const isPaid = status === "PAID"
      const dt = new Date(o.createdAt ?? o.orderDate)
      const mins = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 60000))
      const timeLabel = mins < 1 ? "Just now" : mins < 60 ? `${mins} min ago` : dt.toLocaleTimeString()

      const subLabel =
        String(o.orderType).toUpperCase() === "DINE_IN"
          ? `Table ${o.tableNumber ?? "-"}`
          : String(o.orderType).replace(/_/g, " ")

      return {
        idLabel: `Order #${o.orderId}`,
        subLabel,
        amount: Number(o.totalAmount) || 0,
        statusLabel: status,
        icon: isPaid ? "paid" : "clock",
        timeLabel,
      }
    })
  }, [todaysOrders])

  const topItemsToday: TopItemRow[] = useMemo(() => {
    // Join orderItems to todaysOrders by orderId
    const todayOrderIds = new Set(todaysOrders.map((o) => o.orderId))
    const items = orderItems.filter((i) => todayOrderIds.has(i.orderId))

    const agg = new Map<number, { sold: number; revenue: number }>()
    for (const it of items) {
      const cur = agg.get(it.productId) ?? { sold: 0, revenue: 0 }
      cur.sold += Number(it.quantity) || 0
      cur.revenue += Number(it.subtotal) || 0
      agg.set(it.productId, cur)
    }

    return Array.from(agg.entries())
      .map(([productId, v]) => ({
        name: productById.get(productId)?.name ?? `Product #${productId}`,
        sold: v.sold,
        revenue: v.revenue,
      }))
      .sort((a, b) => b.sold - a.sold || b.revenue - a.revenue)
      .slice(0, 5)
  }, [orderItems, productById, todaysOrders])

  const lowStock: LowStockRow[] = useMemo(() => {
    // Inventory shape may differ; access defensively.
    const rows: LowStockRow[] = []

    for (const inv of inventory) {
      const anyInv = inv as any
      const name = String(anyInv.itemName ?? anyInv.name ?? `Item #${anyInv.itemId ?? ""}`).trim()

      const qty =
        Number(anyInv.availableQuantity ?? anyInv.quantity ?? anyInv.stock ?? anyInv.qty ?? anyInv.currentStock) || 0
      const reorder =
        Number(anyInv.reorderLevel ?? anyInv.reorderPoint ?? anyInv.minStock ?? anyInv.minimumStockLevel) || 0
      const unit = String(anyInv.unit ?? anyInv.unitType ?? anyInv.uom ?? "").trim()

      // If backend provides a reorder level, use it; else use a small heuristic
      const criticalThreshold = reorder > 0 ? reorder : 5
      const lowThreshold = reorder > 0 ? reorder * 2 : 10

      if (qty <= criticalThreshold) {
        rows.push({
          itemName: name,
          stockLabel: `${qty}${unit ? ` ${unit}` : ""}`,
          level: "critical",
        })
      } else if (qty <= lowThreshold) {
        rows.push({
          itemName: name,
          stockLabel: `${qty}${unit ? ` ${unit}` : ""}`,
          level: "low",
        })
      }
    }

    return rows.slice(0, 6)
  }, [inventory])

  const revenueChange = pctChange(todaysRevenue, yesterdaysRevenue)
  const ordersChange = pctChange(todaysOrderCount, yesterdaysOrderCount)

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <div className="p-8 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                Dashboard Overview
              </h1>
              <p className="text-muted-foreground mt-3 text-xl">Live operational summary (today).</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-accent/10 rounded-full border border-accent/20">
                <span className="text-accent font-semibold text-sm">{loading ? "Loading..." : "Live Data"}</span>
              </div>
              <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <StatCard
              title="Today's Revenue"
              value={formatCurrencyCompact(todaysRevenue)}
              change={fmtChangeLabel(revenueChange)}
              trend={revenueChange != null && revenueChange < 0 ? "down" : "up"}
              icon={DollarSign}
              color="success"
            />
            <StatCard
              title="Today Orders"
              value={String(todaysOrderCount)}
              change={fmtChangeLabel(ordersChange)}
              trend={ordersChange != null && ordersChange < 0 ? "down" : "up"}
              icon={ShoppingCart}
              color="primary"
            />
            <StatCard
              title="Weekly Revenue"
              value={formatCurrencyCompact(weeklyRevenue)}
              change={`${weeklyOrders.length} orders`}
              trend="up"
              icon={TrendingUp}
              color="warning"
            />
            <StatCard
              title="Monthly Revenue"
              value={formatCurrencyCompact(monthlyRevenue)}
              change={`${monthlyOrders.length} orders`}
              trend="up"
              icon={Users}
              color="accent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="modern-card border-0">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Today snapshot</p>
                <p className="text-xl font-bold mt-1">
                  {todaysOrderCount} orders · {formatCurrency(todaysRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Avg {formatCurrency(avgOrderValue)} per order</p>
              </CardContent>
            </Card>
            <Card className="modern-card border-0">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">This week</p>
                <p className="text-xl font-bold mt-1">
                  {weeklyOrders.length} orders · {formatCurrency(weeklyRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">From Monday to now</p>
              </CardContent>
            </Card>
            <Card className="modern-card border-0">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">This month</p>
                <p className="text-xl font-bold mt-1">
                  {monthlyOrders.length} orders · {formatCurrency(monthlyRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Live month-to-date totals</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <Card className="modern-card shadow-modern-lg border-0 flex flex-col min-h-0 max-h-[min(28rem,52vh)] overflow-hidden">
              <CardHeader className="pb-4 shrink-0">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  Recent Orders
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
                {recentOrders.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No orders for today.</div>
                ) : (
                  <div className="space-y-4">
                    {recentOrders.map((o) => (
                      <div
                        key={o.idLabel}
                        className="flex items-center justify-between p-5 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-muted/50 hover:shadow-modern transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-3 rounded-xl ${
                              o.icon === "paid"
                                ? "bg-success/20 text-success"
                                : "bg-warning/20 text-warning"
                            }`}
                          >
                            {o.icon === "paid" ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <Clock className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-base">{o.idLabel}</p>
                            <p className="text-sm text-muted-foreground font-medium">{o.subLabel}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(o.amount)}</p>
                          <p className="text-sm text-muted-foreground">{o.timeLabel}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="modern-card shadow-modern-lg border-0 flex flex-col min-h-0 max-h-[min(28rem,52vh)] overflow-hidden">
              <CardHeader className="pb-4 shrink-0">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="w-8 h-8 gradient-accent rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  Top Selling Items Today
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
                {topItemsToday.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No sales data for today.</div>
                ) : (
                  <div className="space-y-4">
                    {topItemsToday.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between p-5 bg-gradient-to-r from-muted/30 to-muted/10 rounded-xl border border-muted/50 hover:shadow-modern transition-all duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl gradient-primary text-white flex items-center justify-center font-bold text-sm shadow-modern">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-bold text-base">{item.name}</p>
                            <p className="text-sm text-muted-foreground font-medium">{item.sold} sold</p>
                          </div>
                        </div>
                        <p className="font-bold text-lg text-success">{formatCurrency(item.revenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 pb-12">
            <Card className="modern-card shadow-modern-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-3">
                  <div className="w-7 h-7 gradient-warning rounded-lg flex items-center justify-center">
                    <Store className="w-4 h-4 text-white" />
                  </div>
                  Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lowStock.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No low stock items (or stock levels not provided by backend).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lowStock.map((item) => (
                      <div
                        key={item.itemName}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/20 to-muted/10 rounded-xl border border-muted/30 hover:shadow-modern transition-all duration-200"
                      >
                        <div>
                          <p className="font-bold text-sm">{item.itemName}</p>
                          <p className="text-xs text-muted-foreground font-medium">Stock: {item.stockLabel}</p>
                        </div>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            item.level === "critical"
                              ? "bg-destructive/20 text-destructive border border-destructive/30"
                              : "bg-warning/20 text-warning border border-warning/30"
                          }`}
                        >
                          {item.level === "critical" ? "Critical" : "Low"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Dashboard
