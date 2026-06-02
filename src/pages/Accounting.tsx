import { DashboardLayout } from "@/components/Layout/DashboardLayout"
import { StatCard } from "@/components/Dashboard/StatCard"
import { ReportPdfShell } from "@/components/reports/ReportPdfShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/apiErrors"
import { getCustomerById } from "@/lib/customersApi"
import {
  createCustomerMealInvoiceDocument,
  deleteCustomerMealInvoiceDocument,
  getAllCustomerMealInvoiceDocuments,
  markCustomerMealInvoiceDocumentPaid,
  type CustomerMealInvoiceDocument,
  type MealType,
} from "@/lib/customerMealInvoicesApi"
import { generateCustomerMealInvoicePdf, generatePDF } from "@/lib/pdfUtils"
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils"
import { CheckCircle, Clock, DollarSign, Download, Plus, Trash2, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"]
type InvoiceLineDraft = {
  mealType: MealType
  quantity: string
  unitPrice: string
}

function isEmptyBackendListError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const m = msg.toLowerCase()
  return m.includes("not.found") || m.includes("no invoice") || m.includes("no invoice records")
}
const Accounting = () => {
  const [invoices, setInvoices] = useState<CustomerMealInvoiceDocument[]>([])
  const [loading, setLoading] = useState(true)

  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineDraft[]>([
    { mealType: "LUNCH", quantity: "1", unitPrice: "650" },
  ])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const list = await getAllCustomerMealInvoiceDocuments()
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

    if (invoiceLines.length === 0) {
      toast.error("Add at least one invoice line.")
      return
    }

    for (const [idx, line] of invoiceLines.entries()) {
      const qty = Number.parseFloat(line.quantity)
      const price = Number.parseFloat(line.unitPrice)
      if (!MEAL_TYPES.includes(line.mealType)) {
        toast.error(`Meal type is required for line ${idx + 1}.`)
        return
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error(`Quantity must be greater than zero for line ${idx + 1}.`)
        return
      }
      if (!Number.isFinite(price) || price <= 0) {
        toast.error(`Unit price must be greater than zero for line ${idx + 1}.`)
        return
      }
    }

    let resolvedCustomerId: number | undefined
    let resolvedCustomerName: string | undefined

    if (hasCustomerId) {
      try {
        const customer = await getCustomerById(parsedCustomerId)
        resolvedCustomerId = customer.customerId
        resolvedCustomerName = customer.name.trim()
      } catch (e) {
        console.error(e)
        toast.error(
          getApiErrorMessage(
            e,
            `Customer ID ${parsedCustomerId} was not found. Register the customer first, or use Customer name only.`,
          ),
        )
        return
      }
    } else {
      resolvedCustomerName = customerName.trim()
    }

    try {
      const created = await createCustomerMealInvoiceDocument({
        ...(resolvedCustomerId != null ? { customerId: resolvedCustomerId } : {}),
        ...(resolvedCustomerName ? { customerName: resolvedCustomerName } : {}),
        lines: invoiceLines.map((line) => ({
          mealType: line.mealType,
          quantity: Number.parseFloat(line.quantity),
          unitPrice: Number.parseFloat(line.unitPrice),
        })),
      })
      setInvoices((prev) => [created, ...prev])
      setCustomerId("")
      setCustomerName("")
      setInvoiceLines([{ mealType: "LUNCH", quantity: "1", unitPrice: "650" }])
      toast.success(
        created.lines.length === 1
          ? "Invoice created."
          : `Invoice created with ${created.lines.length} meal lines.`,
      )
    } catch (e) {
      console.error(e)
      toast.error(getApiErrorMessage(e, "Could not create invoice."))
    }
  }

  const handleMarkPaid = async (inv: CustomerMealInvoiceDocument) => {
    try {
      const updated = await markCustomerMealInvoiceDocumentPaid(inv)
      setInvoices((prev) => prev.map((x) => (x.groupId === inv.groupId ? updated : x)))
      toast.success("Marked paid.")
    } catch (e) {
      console.error(e)
      toast.error(getApiErrorMessage(e, "Could not mark paid."))
    }
  }

  const handleDelete = async (inv: CustomerMealInvoiceDocument) => {
    const lineNote = inv.lines.length > 1 ? ` (${inv.lines.length} meal lines)` : ""
    if (!window.confirm(`Delete invoice ${inv.invoiceNo}?${lineNote}`)) return
    try {
      await deleteCustomerMealInvoiceDocument(inv)
      setInvoices((prev) => prev.filter((x) => x.groupId !== inv.groupId))
      toast.success("Invoice deleted.")
    } catch (e) {
      console.error(e)
      toast.error(getApiErrorMessage(e, "Could not delete invoice."))
    }
  }

  const handleDownloadInvoice = async (inv: CustomerMealInvoiceDocument) => {
    try {
      await generateCustomerMealInvoicePdf(inv)
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
                  Add meal lines for one customer — all lines go on <strong>one invoice</strong>. Use customer name for
                  walk-in guests, or a valid customer ID from CRM.
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

                <div className="space-y-3">
                  {invoiceLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-md border p-3">
                      <div className="grid gap-2">
                        <Label>Meal type</Label>
                        <select
                          value={line.mealType}
                          onChange={(e) =>
                            setInvoiceLines((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, mealType: e.target.value as MealType } : r)),
                            )
                          }
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
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) =>
                            setInvoiceLines((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)),
                            )
                          }
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Unit price (LKR)</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={line.unitPrice}
                          onChange={(e) =>
                            setInvoiceLines((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, unitPrice: e.target.value } : r)),
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={invoiceLines.length <= 1}
                        onClick={() => setInvoiceLines((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove line"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    onClick={() =>
                      setInvoiceLines((prev) => [...prev, { mealType: "LUNCH", quantity: "1", unitPrice: "650" }])
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add line
                  </Button>
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
                      <TableHead>Meals</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Qty (sum)</TableHead>
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
                        <TableRow key={inv.groupId}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{inv.invoiceNo}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{inv.customerName}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <span className="line-clamp-2 text-sm">
                              {inv.lines.map((l) => l.mealType).join(", ")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{inv.lines.length}</TableCell>
                          <TableCell className="text-right">
                            {inv.lines.reduce((s, l) => s + l.quantity, 0)}
                          </TableCell>
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
