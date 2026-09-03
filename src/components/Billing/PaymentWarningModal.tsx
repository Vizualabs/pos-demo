import { Button } from "@/components/ui/button"
import type { PaymentAccess } from "@/lib/paymentControl"
import { AlertTriangle } from "lucide-react"

type PaymentWarningModalProps = {
  payment: PaymentAccess
  onClose: () => void
}

export function PaymentWarningModal({ payment, onClose }: PaymentWarningModalProps) {
  const deadlineLabel = payment.paymentDeadline
    ? new Date(payment.paymentDeadline).toLocaleString()
    : "-"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-modern-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-warning-title"
      >
        <div className="flex items-start gap-3 border-b border-border px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="payment-warning-title" className="text-lg font-semibold text-foreground">
              Payment reminder
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {payment.message ||
                "Please complete outstanding payment before the deadline to avoid service interruption."}
            </p>
          </div>
        </div>

        <div className="space-y-3 px-6 py-5 text-sm">
          <p>
            Remaining time:{" "}
            <strong className="text-foreground">
              {payment.daysRemaining != null ? `${payment.daysRemaining} day(s)` : "-"}
            </strong>
          </p>
          <p>
            Deadline: <strong className="text-foreground">{deadlineLabel}</strong>
          </p>
          <p className="text-muted-foreground">
            Contact Vizualabs support after payment so access can be restored permanently.
          </p>
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button type="button" onClick={onClose}>
            I understand
          </Button>
        </div>
      </div>
    </div>
  )
}
