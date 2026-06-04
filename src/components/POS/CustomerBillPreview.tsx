import { useState } from "react"
import {
  customerReceiptDialogLabels,
  formatReceiptAmount,
  type CustomerBillPayload,
} from "@/components/POS/receiptPrint"
import { BRAND_LOGO_PATHS } from "@/lib/brandLogo"

type Props = {
  customer: CustomerBillPayload
  date: Date
  className?: string
}

function SeparatorLine({ variant = "default" }: { variant?: "default" | "thin" }) {
  const thickness = variant === "thin" ? "border-t" : "border-t-2"
  return <div className={`${thickness} border-black/20`} />
}

function ReceiptLogoMark() {
  const [pathIndex, setPathIndex] = useState(0)
  if (pathIndex >= BRAND_LOGO_PATHS.length) return null
  return (
    <img
      src={BRAND_LOGO_PATHS[pathIndex]}
      alt=""
      className="mx-auto mb-3 h-14 w-auto max-w-[70%] object-contain grayscale contrast-110"
      onError={() => setPathIndex((i) => i + 1)}
    />
  )
}

/** Screen preview — monochrome (matches black thermal print, no accent colors). */
export function CustomerBillPreview({ customer, date, className = "" }: Props) {
  const L = customerReceiptDialogLabels
  const dateStr = date.toLocaleDateString("en-CA")
  const timeStr = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
  const itemCount = customer.lines.length
  const pieceCount = customer.lines.reduce((s, line) => s + line.qty, 0)
  const customerLabel = [customer.tableLabel, customer.orderTypeLabel].filter(Boolean).join(" · ") || "WALK-IN"
  const pending = customer.paymentLabel.toLowerCase().includes("pending")
  const paidAmount = pending ? 0 : customer.total
  const dueAmount = pending ? customer.total : 0

  return (
    <div
      className={`bg-white rounded-xl shadow-lg border border-black/10 mx-auto max-w-sm overflow-hidden ${className}`}
    >
      <div className="px-6 pt-6 pb-5 text-center border-b-2 border-black">
        <ReceiptLogoMark />
        <h1 className="text-xl font-bold tracking-wide text-black">{L.restaurant.toUpperCase()}</h1>
        <div className="h-0.5 w-10 bg-black mx-auto mt-3" />
      </div>

      <div className="px-5 py-5 space-y-4 text-black">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center gap-2">
            <span className="text-black/60">{L.invoice}</span>
            <span className="font-semibold tabular-nums">{customer.orderId}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-black/60">{L.dateTime}</span>
            <span className="text-xs font-mono font-medium text-right">
              {dateStr} · {timeStr}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-black/60">{L.staff}</span>
            <span className="font-medium">POS</span>
          </div>
        </div>

        <SeparatorLine />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-black/60 shrink-0">{L.customer}</span>
            <span className="font-medium text-right">{customerLabel}</span>
          </div>
          {customer.paymentLabel.trim() ? (
            <div className="flex justify-between gap-2">
              <span className="text-black/60 shrink-0">{L.payment}</span>
              <span className="font-medium text-right">{customer.paymentLabel}</span>
            </div>
          ) : null}
        </div>

        <SeparatorLine />

        <div className="grid grid-cols-[1fr_2.5rem_4rem] gap-2 text-[10px] font-bold uppercase tracking-wide text-black/70 border-b border-black pb-1">
          <span>{L.description}</span>
          <span className="text-center">{L.qty}</span>
          <span className="text-right">{L.amount}</span>
        </div>

        <div className="space-y-3">
          {customer.lines.map((line, i) => (
            <div key={i} className="flex justify-between items-start gap-2 border-b border-black/10 pb-2 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  {line.portion ? `${line.name} (${line.portion})` : line.name}
                </p>
                <p className="text-xs text-black/50 mt-0.5">
                  {formatReceiptAmount(line.unitPrice)} × {line.qty}
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums shrink-0">
                {formatReceiptAmount(line.lineTotal)}
              </span>
            </div>
          ))}
        </div>

        <SeparatorLine />

        <div className="space-y-2 text-sm">
          {customer.taxAmount > 0 ? (
            <>
              <div className="flex justify-between">
                <span className="text-black/60">{L.subTotal}</span>
                <span className="font-medium tabular-nums">{formatReceiptAmount(customer.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/60">{L.tax}</span>
                <span className="font-medium tabular-nums">{formatReceiptAmount(customer.taxAmount)}</span>
              </div>
            </>
          ) : null}
          <div className="pt-2 border-t-2 border-black flex justify-between items-center">
            <span className="font-bold">{L.netTotal}</span>
            <span className="font-bold text-lg tabular-nums">{formatReceiptAmount(customer.total)}</span>
          </div>
        </div>

        {customer.paymentLabel.trim() ? (
          <>
            <SeparatorLine variant="thin" />
            <div className="space-y-2 text-sm border border-dashed border-black/40 rounded-lg p-3">
              <div className="flex justify-between">
                <span className="text-black/60">{L.paidAmount}</span>
                <span className="font-semibold tabular-nums">{formatReceiptAmount(paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black/60">{L.balance}</span>
                <span className="font-semibold tabular-nums">{formatReceiptAmount(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">{L.dueAmount}</span>
                <span className="font-bold tabular-nums">{formatReceiptAmount(dueAmount)}</span>
              </div>
            </div>
          </>
        ) : null}

        <SeparatorLine variant="thin" />

        <div className="flex justify-between text-xs font-medium text-black/70">
          <span>
            {L.noOfItems}: <strong className="text-black">{itemCount}</strong>
          </span>
          <span>
            {L.noOfPcs}: <strong className="text-black">{pieceCount.toFixed(1)}</strong>
          </span>
        </div>

        <SeparatorLine variant="thin" />

        <div className="text-center space-y-1.5 pt-1">
          <p className="text-xs font-bold uppercase tracking-wide">{L.thanks}</p>
          <p className="text-[10px] text-black/50 italic">{L.softwareCredit}</p>
        </div>
      </div>
    </div>
  )
}
