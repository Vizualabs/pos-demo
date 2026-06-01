import {
  buildCustomerBillBodyHtml,
  CUSTOMER_BILL_PRINT_STYLES,
  type CustomerBillPayload,
} from "@/components/POS/receiptPrint"

type Props = {
  customer: CustomerBillPayload
  date: Date
  className?: string
}

/**
 * Same HTML + styles as the thermal print — preview matches printed bill (black only).
 */
export function CustomerBillPreview({ customer, date, className = "" }: Props) {
  return (
    <div className={`mx-auto max-w-sm ${className}`}>
      <style>{CUSTOMER_BILL_PRINT_STYLES}</style>
      <div
        className="rounded-lg border border-slate-300 bg-white px-3 py-4 shadow-sm"
        dangerouslySetInnerHTML={{ __html: buildCustomerBillBodyHtml(customer, date) }}
      />
    </div>
  )
}
