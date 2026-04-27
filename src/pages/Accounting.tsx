import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { StatCard } from "@/components/Dashboard/StatCard"
import { ReportPdfShell } from "@/components/reports/ReportPdfShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  createCustomerMealInvoice,
  deleteCustomerMealInvoice,
  getAllCustomerMealInvoices,
  patchCustomerMealInvoice,
  type CustomerMealInvoiceResponseDto,
  type MealType,
} from "@/lib/customerMealInvoicesApi"
import { generateCustomerMealInvoicePdf, generatePDF } from "@/lib/pdfUtils"
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils"
import { CheckCircle, Clock, DollarSign, Download, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"]

function isEmptyBackendListError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const m = msg.toLowerCase()
  return m.includes("not.found") || m.includes("no invoice") || m.includes("no invoice records")
}

const Accounting = () => {
  const [invoices, setInvoices] = useState<CustomerMealInvoiceResponseDto[]>([])
  const [loading, setLoading] = useState(true)

  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [mealType, setMealType] = useState<MealType>("LUNCH")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("650")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const list = await getAllCustomerMealInvoices()
        if (!cancelled) setInvoices(list)
      } catch (e) {
        console.error(e)
        if (!cancelled) setInvoices([])
        if (!isEmptyBackendListError(e)) toast.error("Could not load invoices.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const totals = useMemo(() => {
    const totalAll = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
    const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + (Number(i.total) || 0), 0)
    const totalUnpaid = invoices
      .filter((i) => i.status === "UNPAID")
      .reduce((s, i) => s + (Number(i.total) || 0), 0)
    return { totalAll, totalPaid, totalUnpaid }
  }, [invoices])

  const handleExportReport = async () => {
    try {
      await generatePDF("accounting-content", "RestaurantOS-accounting-report.pdf", { marginMm: 12 })
      toast.success("PDF downloaded.")
    } catch (error) {
      console.error("Error exporting report:", error)
      toast.error("Could not export PDF.")
    }
  }

  const handleCreate = async () => {
    const parsedCustomerId = Number.parseInt(customerId, 10)
    const hasCustomerId = Number.isFinite(parsedCustomerId) && parsedCustomerId > 0
    const hasCustomerName = customerName.trim().length > 0
    if (!hasCustomerId && !hasCustomerName) {
      toast.error("Provide either Customer ID or Customer name.")
      return
    }

    const qty = Number.parseFloat(quantity)
    const price = Number.parseFloat(unitPrice)
    if (!MEAL_TYPES.includes(mealType)) {
      toast.error("Meal type is required.")
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be greater than zero.")
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Unit price must be greater than zero (LKR).")
      return
    }

    try {
      const created = await createCustomerMealInvoice({
        ...(hasCustomerId
          ? { customerId: parsedCustomerId, customerName: null }
          : { customerId: null, customerName: customerName.trim() }),
        mealType,
        quantity: qty,
        unitPrice: price,
      })
      setInvoices((prev) => [created, ...prev])
      setCustomerId("")
      setCustomerName("")
      setMealType("LUNCH")
      setQuantity("1")
      setUnitPrice("650")
      toast.success("Invoice created.")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Could not create invoice.")
    }
  }

  const handleMarkPaid = async (inv: CustomerMealInvoiceResponseDto) => {
    try {
      const updated = await patchCustomerMealInvoice(inv.invoiceId, { status: "PAID" })
      setInvoices((prev) => prev.map((x) => (x.invoiceId === inv.invoiceId ? updated : x)))
      toast.success("Marked paid.")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Could not mark paid.")
    }
  }

  const handleDelete = async (inv: CustomerMealInvoiceResponseDto) => {
    if (!window.confirm(`Delete invoice ${inv.invoiceNo}?`)) return
    try {
      await deleteCustomerMealInvoice(inv.invoiceId)
      setInvoices((prev) => prev.filter((x) => x.invoiceId !== inv.invoiceId))
      toast.success("Invoice deleted.")
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : "Could not delete invoice.")
    }
  }

  const handleDownloadInvoice = (inv: CustomerMealInvoiceResponseDto) => {
    try {
      generateCustomerMealInvoicePdf(inv)
    } catch (e) {
      console.error(e)
      toast.error("Could not download invoice PDF.")
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Accounting</h1>
            <p className="text-muted-foreground mt-2">Customer meal invoices</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExportReport}>
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <div id="accounting-content" className="w-full max-w-none">
          <ReportPdfShell
            title="Accounting report"
            subtitle="Customer meal invoices summary"
            footer="This report is generated from backend data. Create/row actions are omitted from the PDF capture."
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Invoiced"
                value={formatCurrencyCompact(totals.totalAll)}
                change={`${invoices.length} invoices`}
                icon={DollarSign}
                trend="up"
              />
              <StatCard
                title="Paid"
                value={formatCurrencyCompact(totals.totalPaid)}
                change="Status: PAID"
                icon={CheckCircle}
                trend="up"
              />
              <StatCard
                title="Unpaid"
                value={formatCurrencyCompact(totals.totalUnpaid)}
                change="Status: UNPAID"
                icon={Clock}
                trend={totals.totalUnpaid > 0 ? "down" : "up"}
              />
              <StatCard
                title="Average Invoice"
                value={formatCurrencyCompact(invoices.length > 0 ? totals.totalAll / invoices.length : 0)}
                change="(total / count)"
                icon={DollarSign}
                trend="up"
              />
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Create invoice</CardTitle>
                <CardDescription>
                  Meal type must be one of: BREAKFAST, LUNCH, DINNER. Provide either a Customer ID (recommended) or type a
                  Customer name.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pdf-hide">
                <div className="grid gap-2">
                  <Label htmlFor="cmi-customerId">Customer ID (optional)</Label>
                  <Input
                    id="cmi-customerId"
                    type="number"
                    min="1"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cmi-customerName">Customer name (optional)</Label>
                  <Input
                    id="cmi-customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in Customer"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="cmi-mealType">Meal type</Label>
                    <select
                      id="cmi-mealType"
                      value={mealType}
                      onChange={(e) => setMealType(e.target.value as MealType)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    >
                      {MEAL_TYPES.map((mt) => (
                        <option key={mt} value={mt}>
                          {mt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="cmi-qty">Quantity</Label>
                    <Input
                      id="cmi-qty"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="cmi-unit">Unit price (LKR)</Label>
                    <Input
                      id="cmi-unit"
                      type="number"
                      min="1"
                      step="1"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="button" className="w-fit" onClick={() => void handleCreate()}>
                  Create invoice
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>{loading ? "Loading…" : "Latest invoices from backend"}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Meal type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right pdf-hide">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-muted-foreground text-center py-6">
                          No invoices yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices.map((inv) => (
                        <TableRow key={inv.invoiceId}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{inv.invoiceNo}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{inv.customerName}</TableCell>
                          <TableCell>{inv.mealType}</TableCell>
                          <TableCell className="text-right">{inv.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.unitPrice)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(inv.total)}</TableCell>
                          <TableCell>
                            <Badge variant={inv.status === "PAID" ? "default" : "secondary"}>{inv.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(inv.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="text-right pdf-hide">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button type="button" size="sm" variant="outline" onClick={() => handleDownloadInvoice(inv)}>
                                PDF
                              </Button>
                              {inv.status === "UNPAID" && (
                                <Button type="button" size="sm" onClick={() => void handleMarkPaid(inv)}>
                                  Mark paid
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="gap-1"
                                onClick={() => void handleDelete(inv)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </ReportPdfShell>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default Accounting
