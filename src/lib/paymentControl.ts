export type PaymentStatus = "PENDING" | "FULLY_PAID"

export type PaymentAccess = {
  loginAllowed: boolean
  showWarning: boolean
  paymentStatus: PaymentStatus
  daysRemaining: number | null
  paymentDeadline: string | null
  message: string | null
}

export function parsePaymentAccess(data: unknown): PaymentAccess | null {
  if (!data || typeof data !== "object") return null
  const root = data as Record<string, unknown>
  const payment = (root.payment && typeof root.payment === "object"
    ? root.payment
    : root) as Record<string, unknown>

  const status = String(payment.paymentStatus ?? "").toUpperCase()
  if (status !== "PENDING" && status !== "FULLY_PAID") return null

  const daysRaw = payment.daysRemaining
  const daysRemaining =
    typeof daysRaw === "number"
      ? daysRaw
      : typeof daysRaw === "string" && daysRaw.trim()
        ? Number(daysRaw)
        : null

  return {
    loginAllowed: payment.loginAllowed !== false,
    showWarning: Boolean(payment.showWarning),
    paymentStatus: status as PaymentStatus,
    daysRemaining: Number.isFinite(daysRemaining as number) ? (daysRemaining as number) : null,
    paymentDeadline: typeof payment.paymentDeadline === "string" ? payment.paymentDeadline : null,
    message: typeof payment.message === "string" ? payment.message : null,
  }
}

export function isPaymentLockedResponse(status: number, body: unknown): boolean {
  if (status !== 423) return false
  if (!body || typeof body !== "object") return true
  const rec = body as Record<string, unknown>
  const code = String(rec.code ?? rec.errorCode ?? "").toUpperCase()
  return code.includes("PAYMENT") || code === "PAYMENT_OVERDUE" || code === "PAYMENT_LOCKED" || !code
}
