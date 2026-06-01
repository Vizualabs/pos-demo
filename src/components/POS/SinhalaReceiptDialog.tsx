import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  printCustomerBillAndKitchenTickets,
  type OrderBillsPayload,
} from "@/components/POS/receiptPrint"
import { CustomerBillPreview } from "@/components/POS/CustomerBillPreview"
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
          <CustomerBillPreview customer={payload.customer} date={d} />
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
