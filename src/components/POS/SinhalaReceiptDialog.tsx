import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
  printCustomerBillAndKitchenTickets,
  customerReceiptDialogLabels,
  type OrderBillsPayload,
} from "@/components/POS/receiptPrint"
import { loadPrintPrinterConfig } from "@/lib/printConfig"

export function SinhalaReceiptDialog({
  open,
  onOpenChange,
  payload,
  /** Fired after user prints a dine-in “Pending payment” bill (Orders flow). */
  onPendingDineInBillPrinted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  payload: OrderBillsPayload | null
  onPendingDineInBillPrinted?: (orderId: number) => void
}) {
  if (!payload) return null

  const d = new Date()
  const L = customerReceiptDialogLabels
  const printCfg = loadPrintPrinterConfig()
  const printBackend = printCfg.printBackend

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            {payload.kitchenTickets.length === 0 &&
            payload.customer.paymentLabel.toLowerCase().includes("pending")
              ? "Customer bill"
              : payload.kitchenTickets.length === 0
                ? "Sale complete"
                : "Order complete"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review the receipt and print kitchen tickets and customer bill.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          <div
            className="space-y-3 text-sm p-3 border rounded-lg bg-card"
            style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}
          >
            <div className="text-center">
              <p className="font-extrabold text-lg tracking-tight leading-none">{L.restaurant}</p>
              <p className="text-xs text-muted-foreground mt-1">{L.receipt}</p>
            </div>
            <div className="h-px bg-border/70" />

            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{L.date}</span>
                <span className="font-semibold text-right tabular-nums">{d.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{L.orderNo}</span>
                <span className="font-semibold text-right font-mono">#{payload.customer.orderId}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{L.table}</span>
                <span className="font-semibold text-right">{payload.customer.tableLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{L.orderType}</span>
                <span className="font-semibold text-right">{payload.customer.orderTypeLabel}</span>
              </div>
              {payload.customer.paymentLabel.trim() ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{L.payment}</span>
                  <span className="font-semibold text-right">{payload.customer.paymentLabel}</span>
                </div>
              ) : null}
            </div>

            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="border-b border-border/70">
                  <th className="text-left py-2 font-bold text-muted-foreground/90">{L.item}</th>
                  <th className="text-center w-12 py-2 font-bold text-muted-foreground/90">{L.qty}</th>
                  <th className="text-right py-2 font-bold text-muted-foreground/90">{L.unit}</th>
                  <th className="text-right py-2 font-bold text-muted-foreground/90">{L.amount}</th>
                </tr>
              </thead>
              <tbody>
                {payload.customer.lines.map((line, i) => (
                  <tr key={i} className="border-b border-muted/30">
                    <td className="py-2 pr-2 align-top">
                      {line.portion ? `${line.name} (${line.portion})` : line.name}
                    </td>
                    <td className="text-center py-2 font-bold align-top tabular-nums">{line.qty}</td>
                    <td className="text-right py-2 whitespace-nowrap align-top tabular-nums">
                      {formatCurrency(line.unitPrice)}
                    </td>
                    <td className="text-right py-2 whitespace-nowrap font-extrabold align-top tabular-nums">
                      {formatCurrency(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 text-xs border-t border-border/70 pt-3 mt-2">
              {payload.customer.taxAmount > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span>{L.sub}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(payload.customer.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{L.tax}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(payload.customer.taxAmount)}</span>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between text-lg font-extrabold pt-2">
                <span>{L.grand}</span>
                <span className="tabular-nums">{formatCurrency(payload.customer.total)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-muted-foreground/50 pt-3 mt-2" />
            <p className="text-center text-xs text-muted-foreground">{L.thanks}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              type="button"
              onClick={() => {
                const pending = payload.customer.paymentLabel.toLowerCase().includes("pending")
                printCustomerBillAndKitchenTickets(payload.customer, payload.kitchenTickets, d, () => {
                  if (pending) onPendingDineInBillPrinted?.(payload.customer.orderId)
                  onOpenChange(false)
                })
              }}
            >
              {payload.kitchenTickets.length === 0 ? "Print customer bill" : "Print receipt & kitchen tickets"}
            </Button>
            {payload.kitchenTickets.length > 0 ? (
              <p className="text-[10px] text-muted-foreground text-right leading-snug max-w-md ml-auto">
                {printBackend === "browser" ? (
                  <>
                    Dev mode: separate print dialogs —{" "}
                    <span className="font-medium text-foreground">one per kitchen station</span>, then{" "}
                    <span className="font-medium text-foreground">customer bill</span>.
                  </>
                ) : (
                  <>
                    Sent silently via print server:{" "}
                    <span className="font-medium text-foreground">kitchen 1</span> →{" "}
                    <span className="font-medium text-foreground">kitchen 2</span> →{" "}
                    <span className="font-medium text-foreground">cashier bill</span> (LAN IP, no dialog).
                  </>
                )}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
