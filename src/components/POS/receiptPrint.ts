import type { Kitchen } from "@/lib/ordersApi"
import { getBrandLogoForEmbed } from "@/lib/brandLogo"
import { loadPrintPrinterConfig, usesElectronSilentPrint } from "@/lib/printConfig"
import { printHtmlViaQz } from "@/lib/qzPrintClient"
import { postPrintToAgent } from "@/lib/httpPrintAgent"
import { printHtmlViaElectron } from "@/lib/electronPrintClient"
import { toast } from "sonner"

export type ReceiptLine = {
  name: string
  qty: number
  unitPrice: number
  lineTotal: number
  portion?: string
}

/** English payment receipt for the customer. */
export type CustomerBillPayload = {
  orderId: number
  lines: ReceiptLine[]
  subtotal: number
  taxAmount: number
  total: number
  tableLabel: string
  paymentLabel: string
  orderTypeLabel: string
}

export type KitchenTicketLine = {
  nameEn: string
  nameSi: string | null
  qty: number
  portionSi?: string
  /** Prints only on this line’s kitchen KOT (not on customer bill). */
  lineNote?: string | null
}

/** One prep ticket per station (Sinhala UI, no prices). */
export type KitchenTicketPayload = {
  kitchen: Kitchen
  kitchenBadgeSi: string
  orderId: number
  tableLabel: string
  /** English on KOT — e.g. Take Away, Dine In */
  orderTypeLabel: string
  /** @deprecated Line notes are per-item; footer uses standard prep text only. */
  kitchenNote?: string | null
  lines: KitchenTicketLine[]
}

export type OrderBillsPayload = {
  customer: CustomerBillPayload
  kitchenTickets: KitchenTicketPayload[]
}

const kotLabels = {
  title: "මුළුතැන්ගෙයි ඇණවුම", // Kitchen Order එකට වඩාත් ගැළපෙන වචනය
  subtitle: "(මිල ගණන් ඇතුළත් නොවේ)", // වඩාත් පැහැදිලියි
  orderNo: "Order No",
  table: "Table No",
  orderType: "Order Type",
  time: "Time",
  item: "අයිතමය / විස්තරය",
  qty: "ප්‍රමාණය",
  note: "විශේෂ සටහන්", // Note එකට වඩාත් වෘත්තීය පෙනුමක් ලබා දෙයි
  none: "—",
  prepNote: "මෙම පත්‍රිකාව ආහාර පිළියෙළ කිරීම සඳහා පමණි.",
}

/** Labels for customer receipt preview + thermal print (shared). */
export const customerReceiptDialogLabels = {
  restaurant: "Madara Restaurant",
  receipt: "Customer Receipt",
  invoice: "Invoice",
  dateTime: "Date & Time",
  staff: "Staff",
  customer: "Customer",
  payment: "Payment",
  description: "Description",
  qty: "Qty",
  amount: "Amount",
  subTotal: "Sub Total",
  tax: "Tax",
  netTotal: "Net Total",
  paidAmount: "Paid Amount",
  balance: "Balance",
  dueAmount: "Due Amount",
  noOfItems: "No of Items",
  noOfPcs: "No of Pcs",
  thanks: "THANK YOU COME AGAIN !!!",
  softwareCredit: "Software by VIZUALABS | www.vizualabs.com",
  /** @deprecated use invoice */
  orderNo: "Invoice",
  date: "Date & Time",
  table: "Table",
  orderType: "Order type",
  item: "Description",
  unit: "Unit",
  sub: "Sub Total",
  grand: "Net Total",
}

/** Plain amount for thermal lines (no currency prefix). */
export function formatReceiptAmount(amount: number): string {
  return amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatReceiptDateTime(d: Date): { date: string; time: string } {
  return {
    date: d.toLocaleDateString("en-CA"),
    time: d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  }
}

function kotLineDisplay(line: KitchenTicketLine) {
  const si = line.nameSi?.trim()
  if (si && si.length > 0) return si
  return line.nameEn
}

function kotLineItemCell(line: KitchenTicketLine): string {
  const base = kotLineDisplay(line)
  const p = line.portionSi?.trim()
  if (p && p.length > 0 && p !== kotLabels.none) {
    return `${base} (${p})`
  }
  return base
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function lineDisplayName(line: ReceiptLine): string {
  return line.portion ? `${line.name} (${line.portion})` : line.name
}

function receiptHr(thin = false): string {
  return `<div class="c-hr${thin ? " c-hr-thin" : ""}"></div>`
}

function buildReceiptLogoHtml(logoDataUrl: string | null): string {
  if (!logoDataUrl) return ""
  return `<div class="c-logo-wrap">
    <img src="${logoDataUrl}" alt="" class="c-logo" />
  </div>`
}

/** Black-only 80mm thermal bill — matches CustomerBillPreview layout. */
function buildCustomerBillHtml(
  customer: CustomerBillPayload,
  d: Date,
  logoDataUrl: string | null = null,
): string {
  const L = customerReceiptDialogLabels
  const { date, time } = formatReceiptDateTime(d)
  const itemCount = customer.lines.length
  const pieceCount = customer.lines.reduce((s, line) => s + line.qty, 0)
  const customerLabel =
    [customer.tableLabel, customer.orderTypeLabel].filter(Boolean).join(" · ") || "WALK-IN"
  const pending = customer.paymentLabel.toLowerCase().includes("pending")
  const paidAmount = pending ? 0 : customer.total
  const dueAmount = pending ? customer.total : 0

  const itemRows = customer.lines
    .map(
      (line) => `<div class="c-item-row">
      <div class="c-item-main">
        <div class="c-item-name">${escapeHtml(lineDisplayName(line))}</div>
        <div class="c-item-sub">${formatReceiptAmount(line.unitPrice)} × ${line.qty}</div>
      </div>
      <div class="c-item-amt">${formatReceiptAmount(line.lineTotal)}</div>
    </div>`,
    )
    .join("")

  const taxBlock =
    customer.taxAmount > 0
      ? `<div class="c-sum-row"><span>${L.subTotal}</span><span>${formatReceiptAmount(customer.subtotal)}</span></div>
      <div class="c-sum-row"><span>${L.tax}</span><span>${formatReceiptAmount(customer.taxAmount)}</span></div>`
      : ""

  const paymentBlock = customer.paymentLabel.trim()
    ? `${receiptHr()}
    <div class="c-pay-block">
      <div class="c-sum-row"><span>${L.paidAmount}</span><span>${formatReceiptAmount(paidAmount)}</span></div>
      <div class="c-sum-row"><span>${L.balance}</span><span>${formatReceiptAmount(0)}</span></div>
      <div class="c-sum-row c-sum-due"><span>${L.dueAmount}</span><span>${formatReceiptAmount(dueAmount)}</span></div>
    </div>`
    : ""

  return `<div class="customer-print-section">
    <div class="c-top">
      ${buildReceiptLogoHtml(logoDataUrl)}
      <div class="c-restaurant">${escapeHtml(L.restaurant.toUpperCase())}</div>
      <div class="c-head-rule"></div>
    </div>
    <div class="c-body">
      <div class="c-meta">
        <div class="c-meta-row"><span>${L.invoice}</span><span class="c-meta-v">${customer.orderId}</span></div>
        <div class="c-meta-row"><span>${L.dateTime}</span><span class="c-meta-v c-meta-sm">${escapeHtml(date)} · ${escapeHtml(time)}</span></div>
        <div class="c-meta-row"><span>${L.staff}</span><span class="c-meta-v">POS</span></div>
      </div>
      ${receiptHr()}
      <div class="c-meta">
        <div class="c-meta-row"><span>${L.customer}</span><span class="c-meta-v">${escapeHtml(customerLabel)}</span></div>
        ${
          customer.paymentLabel.trim()
            ? `<div class="c-meta-row"><span>${L.payment}</span><span class="c-meta-v">${escapeHtml(customer.paymentLabel)}</span></div>`
            : ""
        }
      </div>
      ${receiptHr()}
      <div class="c-items-head">
        <span>${L.description}</span>
        <span class="c-col-qty">${L.qty}</span>
        <span class="c-col-amt">${L.amount}</span>
      </div>
      <div class="c-items">${itemRows}</div>
      ${receiptHr()}
      <div class="c-summary">
        ${taxBlock}
        <div class="c-net-row"><span>${L.netTotal}</span><span>${formatReceiptAmount(customer.total)}</span></div>
      </div>
      ${paymentBlock}
      ${receiptHr()}
      <div class="c-stats">
        <span>${L.noOfItems}: <strong>${itemCount}</strong></span>
        <span>${L.noOfPcs}: <strong>${pieceCount.toFixed(1)}</strong></span>
      </div>
      ${receiptHr()}
      <div class="c-foot">
        <p class="c-thanks">${escapeHtml(L.thanks)}</p>
        <p class="c-credit">${escapeHtml(L.softwareCredit)}</p>
      </div>
    </div>
  </div>`
}

/** Same HTML as thermal print — loads logo when possible */
export async function buildCustomerBillBodyHtml(
  customer: CustomerBillPayload,
  d: Date,
): Promise<string> {
  const logo = await getBrandLogoForEmbed()
  return buildCustomerBillHtml(customer, d, logo?.dataUrl ?? null)
}

/** Black-only thermal bill — compact fonts, flex layout like preview */
export const CUSTOMER_BILL_PRINT_STYLES = `
  .customer-print-section {
    color: #000;
    font-family: Arial, 'Segoe UI', sans-serif;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.35;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: anywhere;
  }
  .c-top { text-align: center; padding: 6px 0 8px; border-bottom: 2px solid #000; }
  .c-logo-wrap { padding: 0 0 6px; text-align: center; }
  .c-logo { display: block; margin: 0 auto; height: 44px; width: auto; max-width: 65%; object-fit: contain; filter: grayscale(100%) contrast(1.15); }
  .c-restaurant { font-size: 14px; font-weight: 800; letter-spacing: 0.04em; text-align: center; text-transform: uppercase; color: #000; }
  .c-head-rule { width: 32px; height: 2px; background: #000; margin: 8px auto 0; }
  .c-body { padding: 6px 0 4px; box-sizing: border-box; }
  .c-hr { border-top: 1px solid #000; margin: 6px 0; }
  .c-hr-thin { border-top-width: 1px; margin: 5px 0; }
  .c-meta { font-size: 10px; font-weight: 700; color: #000; }
  .c-meta-row { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 2px 0; color: #000; }
  .c-meta-row > span:first-child { color: #000; font-weight: 700; }
  .c-meta-v { font-weight: 800; text-align: right; word-break: break-word; color: #000; }
  .c-meta-sm { font-size: 9px; font-weight: 700; color: #000; }
  .c-items-head { display: grid; grid-template-columns: 1fr 1.75rem 3.2rem; gap: 3px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #000; padding-bottom: 3px; border-bottom: 1px solid #000; }
  .c-col-qty { text-align: center; }
  .c-col-amt { text-align: right; }
  .c-items { margin-top: 2px; }
  .c-item-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; padding: 5px 0; border-bottom: 1px solid #000; color: #000; }
  .c-item-row:last-child { border-bottom: none; }
  .c-item-main { flex: 1; min-width: 0; }
  .c-item-name { font-size: 11px; font-weight: 800; line-height: 1.25; word-break: break-word; color: #000; }
  .c-item-sub { font-size: 10px; font-weight: 800; color: #000; margin-top: 1px; line-height: 1.2; }
  .c-item-amt { font-size: 11px; font-weight: 800; white-space: nowrap; flex-shrink: 0; color: #000; }
  .c-summary { font-size: 10px; font-weight: 700; color: #000; }
  .c-sum-row { display: flex; justify-content: space-between; padding: 2px 0; color: #000; }
  .c-sum-row > span:first-child { color: #000; font-weight: 700; }
  .c-net-row { display: flex; justify-content: space-between; align-items: center; padding-top: 6px; margin-top: 3px; border-top: 2px solid #000; font-size: 12px; font-weight: 900; color: #000; }
  .c-net-row span:last-child { font-size: 13px; font-weight: 900; color: #000; }
  .c-pay-block { padding: 6px 0; border: 1px dashed #000; margin-top: 4px; }
  .c-sum-due span:first-child { font-weight: 700; color: #000; }
  .c-sum-due span:last-child { font-weight: 900; color: #000; }
  .c-stats { display: flex; justify-content: space-between; font-size: 9px; font-weight: 800; color: #000; }
  .c-stats strong { color: #000; font-weight: 900; }
  .c-foot { text-align: center; padding-top: 4px; }
  .c-thanks { font-size: 10px; font-weight: 900; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.04em; color: #000; }
  .c-credit { font-size: 8px; font-weight: 700; color: #000; margin: 0; }
  @media print {
    .customer-print-section, .c-body, .c-meta, .c-items-head, .c-item-row, .c-summary, .c-stats, .c-foot,
    .c-meta-row, .c-meta-v, .c-item-name, .c-item-sub, .c-item-amt, .c-sum-row, .c-net-row, .c-thanks, .c-credit {
      color: #000 !important;
    }
  }
`

/** Matches index.css — embedded in print popup so styles apply without Tailwind */
const KOT_PRINT_STYLES = `
  .kot-single {
    page-break-after: auto;
    width: 100%;
    font-family: 'Iskoola Pota', 'Nirmala UI', 'Noto Sans Sinhala', 'Segoe UI', Arial, sans-serif;
    font-size: 16px;
    color: #000;
  }
  .kot-title {
    font-size: 1.6rem;
    letter-spacing: 0.3px;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
    margin-bottom: 8px;
    text-align: center;
    font-weight: 800;
    color: #000;
  }
  .kot-subtitle {
    font-size: 1.1rem;
    font-weight: 700;
    color: #000;
    text-align: center;
    margin: 4px 0 8px;
  }
  .kot-table {
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1.55;
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    color: #000;
  }
  .kot-table th, .kot-table td {
    text-align: left;
    padding: 8px 4px;
    border-bottom: 1px solid #000;
    color: #000;
    font-weight: 700;
  }
  .kot-table th:nth-child(2), .kot-table td:nth-child(2) { text-align: center; width: 3rem; font-weight: 800; }
  .kot-table th:nth-child(3), .kot-table td:nth-child(3) { text-align: left; word-break: break-word; font-size: 1.2rem; }
  .kot-table th { font-weight: 800; }
  .prep-note {
    font-size: 1.1rem;
    font-weight: 700;
    margin-top: 14px;
    text-align: center;
    border-top: 1px dashed #000;
    padding-top: 8px;
    color: #000;
  }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; background: #000; color: #fff; font-size: 1.05rem; font-weight: 800; margin: 8px 0; }
  .kot-page { page-break-after: always; }
  .kot-page:last-child { page-break-after: auto; }
  .kot-meta { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; row-gap: 4px; font-size: 1.1rem; font-weight: 700; margin-top: 8px; color: #000; align-items: baseline; }
  .kot-meta > span:nth-child(odd) { color: #000; font-weight: 800; }
  .kot-meta > span:nth-child(even) { text-align: right; font-weight: 800; color: #000; }
  @media print {
    .kot-single { font-size: 16px !important; }
    .kot-table, .kot-table th:nth-child(3), .kot-table td:nth-child(3) { font-size: 1.25rem !important; }
  }
`

function renderKotInnerHtml(ticket: KitchenTicketPayload, d: Date) {
  const rows = ticket.lines
    .map(
      (line) => `<tr>
      <td>${escapeHtml(kotLineItemCell(line))}</td>
      <td>${line.qty}</td>
      <td>${escapeHtml(line.lineNote?.trim() ? line.lineNote.trim() : kotLabels.none)}</td>
    </tr>`,
    )
    .join("")
  const noteBlock = `<p class="prep-note">${kotLabels.prepNote}</p>`
  return `
    <div class="kot-title">${kotLabels.title}</div>
    <p class="kot-subtitle">${kotLabels.subtitle}</p>
    <div style="text-align:center"><span class="badge">${ticket.kitchenBadgeSi}</span></div>
    <div class="kot-meta">
      <span>${kotLabels.orderNo}:</span><span>#${ticket.orderId}</span>
      <span>${kotLabels.table}:</span><span>${escapeHtml(ticket.tableLabel)}</span>
      <span>${kotLabels.orderType}:</span><span>${escapeHtml(ticket.orderTypeLabel)}</span>
      <span>${kotLabels.time}:</span><span>${escapeHtml(d.toLocaleString())}</span>
    </div>
    <table class="kot-table">
      <thead><tr>
        <th>${kotLabels.item}</th>
        <th style="width:3rem">${kotLabels.qty}</th>
        <th>${kotLabels.note}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${noteBlock}
  `
}

/** 80mm roll — left-aligned content (no left margin from centering). */
const THERMAL_PAGE_WIDTH_MM = 80
const THERMAL_CONTENT_WIDTH_MM = 72

const THERMAL_BASE_STYLES = `
      @page { size: ${THERMAL_PAGE_WIDTH_MM}mm auto; margin: 0; }
      html {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        width: ${THERMAL_PAGE_WIDTH_MM}mm;
        height: auto;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        width: ${THERMAL_PAGE_WIDTH_MM}mm;
        max-width: ${THERMAL_PAGE_WIDTH_MM}mm;
        margin: 0;
        padding: 2mm 0 2mm 0;
        box-sizing: border-box;
        overflow: visible;
        color: #000;
        background: #fff;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }
      .thermal-content {
        display: block;
        width: ${THERMAL_CONTENT_WIDTH_MM}mm;
        max-width: ${THERMAL_CONTENT_WIDTH_MM}mm;
        margin: 0;
        padding: 0;
        text-align: left;
        box-sizing: border-box;
        background: #fff;
        flex-shrink: 0;
      }
      @media print {
        html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; }
        html { width: ${THERMAL_PAGE_WIDTH_MM}mm !important; margin: 0 !important; padding: 0 !important; }
        body {
          width: ${THERMAL_PAGE_WIDTH_MM}mm !important;
          max-width: ${THERMAL_PAGE_WIDTH_MM}mm !important;
          margin: 0 !important;
          padding: 2mm 0 2mm 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
        }
        .thermal-content {
          display: block !important;
          width: ${THERMAL_CONTENT_WIDTH_MM}mm !important;
          max-width: ${THERMAL_CONTENT_WIDTH_MM}mm !important;
          margin: 0 !important;
        }
      }
`

function buildPrintDocumentHtmlCustomerOnly(customerHtml: string): string {
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8" />
    <title>Customer bill</title>
    <style>
      ${THERMAL_BASE_STYLES}
      ${CUSTOMER_BILL_PRINT_STYLES}
    </style>
  </head><body><div class="thermal-content">${customerHtml}</div></body></html>`
}

/** One kitchen station per print job (80mm). */
function buildPrintDocumentHtmlKotSingle(kotInnerHtml: string): string {
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8" />
    <title>Kitchen ticket</title>
    <style>
      ${THERMAL_BASE_STYLES}
      ${KOT_PRINT_STYLES}
    </style>
  </head><body><div class="thermal-content"><div class="kot-single">${kotInnerHtml}</div></div></body></html>`
}

type RunPrintOptions = {
  /** Use hidden iframe only — avoids popup blocker on jobs after the first (no user gesture). */
  preferIframe?: boolean
  /** Named Windows printer for QZ Tray / HTTP agent (customer or kitchen queue). */
  printerName?: string
}

function kitchenPrinterName(kitchen: Kitchen): string {
  const cfg = loadPrintPrinterConfig()
  return kitchen === "KITCHEN_1" ? cfg.kitchen1PrinterName.trim() : cfg.kitchen2PrinterName.trim()
}

function runPrint(html: string, onComplete?: () => void, options?: RunPrintOptions): void {
  let completeFired = false
  const fireComplete = () => {
    if (completeFired) return
    completeFired = true
    onComplete?.()
  }

  const cfg = loadPrintPrinterConfig()
  const printerName = (options?.printerName ?? "").trim()

  if (usesElectronSilentPrint(cfg)) {
    if (!printerName) {
      toast.error("Printer name empty — set it in Settings for this slot.")
      queueMicrotask(() => fireComplete())
      return
    }
    void printHtmlViaElectron(printerName, html)
      .then(() => fireComplete())
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error(`Print failed: ${msg}`)
        fireComplete()
      })
    return
  }

  if (cfg.printBackend === "qz") {
    if (!printerName) {
      toast.error("Printer name empty — set it in Settings for this slot (QZ Tray).")
      queueMicrotask(() => fireComplete())
      return
    }
    void printHtmlViaQz(printerName, html)
      .then(() => fireComplete())
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error(`QZ Tray print failed: ${msg}`)
        fireComplete()
      })
    return
  }

  if (cfg.printBackend === "http") {
    const base = cfg.printAgentUrl.trim()
    if (!base || !printerName) {
      toast.error("Set print agent URL and printer names in Settings.")
      queueMicrotask(() => fireComplete())
      return
    }
    void postPrintToAgent(base, printerName, html)
      .then(() => fireComplete())
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        toast.error(`Print agent failed: ${msg}`)
        fireComplete()
      })
    return
  }

  const schedulePrint = (win: Window, opts: { closeDelayMs: number; printDelayMs: number }, afterIframeRemove?: () => void) => {
    const doc = win.document
    doc.open()
    doc.write(html)
    doc.close()
    win.focus()
    const doPrint = () => {
      win.print()
      const closeLater = () => {
        try {
          win.close()
        } catch {
          /* ignore */
        }
        afterIframeRemove?.()
        fireComplete()
      }
      win.addEventListener("afterprint", closeLater)
      setTimeout(closeLater, opts.closeDelayMs)
    }
    const kick = () => setTimeout(doPrint, opts.printDelayMs)
    if (doc.readyState === "complete") {
      kick()
    } else {
      win.addEventListener("load", kick)
    }
  }

  if (!options?.preferIframe) {
    const w = window.open("", "_blank", "width=320,height=720")
    if (w) {
      schedulePrint(w, { closeDelayMs: 2500, printDelayMs: 150 })
      return
    }
  }

  const iframe = document.createElement("iframe")
  iframe.setAttribute("title", "Print receipt")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;border:0;margin:0;padding:0;opacity:0;z-index:-1;pointer-events:none"
  document.body.appendChild(iframe)
  const iw = iframe.contentWindow
  if (!iw) {
    iframe.remove()
    fireComplete()
    return
  }
  schedulePrint(iw, { closeDelayMs: 8000, printDelayMs: 400 }, () => {
    iframe.remove()
  })
}

const SEQUENTIAL_PRINT_GAP_MS = 500

type PrintJob = { html: string; printerName?: string }

function runPrintJobsSequential(
  jobs: PrintJob[],
  delayBetweenMs = SEQUENTIAL_PRINT_GAP_MS,
  onAllDone?: () => void,
  allJobsPreferIframe?: boolean,
): void {
  if (jobs.length === 0) {
    onAllDone?.()
    return
  }
  let i = 0
  const next = () => {
    if (i >= jobs.length) {
      onAllDone?.()
      return
    }
    const idx = i++
    const preferIframe = allJobsPreferIframe === true || idx > 0
    runPrint(
      jobs[idx]!.html,
      () => {
        setTimeout(next, delayBetweenMs)
      },
      { preferIframe, printerName: jobs[idx]!.printerName },
    )
  }
  next()
}

/** Customer bill only — send to customer / cashier printer (80mm). */
export async function printCustomerBillOnly(
  customer: CustomerBillPayload,
  d: Date = new Date(),
): Promise<void> {
  const cfg = loadPrintPrinterConfig()
  const logo = await getBrandLogoForEmbed()
  const html = buildPrintDocumentHtmlCustomerOnly(buildCustomerBillHtml(customer, d, logo?.dataUrl ?? null))
  runPrint(html, undefined, {
    printerName: cfg.customerPrinterName,
  })
}

/** One print job per kitchen station (Kitchen 1 printer, then Kitchen 2 printer, etc.). */
export function printKitchenTicketsForStationsSequentially(
  tickets: KitchenTicketPayload[],
  d: Date = new Date(),
  onAllComplete?: () => void,
): void {
  if (tickets.length === 0) {
    onAllComplete?.()
    return
  }
  const jobs = tickets.map((t) => ({
    html: buildPrintDocumentHtmlKotSingle(renderKotInnerHtml(t, d)),
    printerName: kitchenPrinterName(t.kitchen),
  }))
  runPrintJobsSequential(jobs, SEQUENTIAL_PRINT_GAP_MS, onAllComplete, false)
}

/**
 * Customer bill first (pick customer/cashier printer), then one print per kitchen station (Kitchen 1, then Kitchen 2).
 * Kitchen jobs use iframe printing so the browser does not block popups after the first dialog.
 * @param onAllComplete — run after every job finishes (e.g. close UI).
 */
export async function printCustomerBillAndKitchenTickets(
  customer: CustomerBillPayload,
  tickets: KitchenTicketPayload[],
  d: Date,
  onAllComplete?: () => void,
): Promise<void> {
  const cfg = loadPrintPrinterConfig()
  const logo = await getBrandLogoForEmbed()
  const customerDoc = buildPrintDocumentHtmlCustomerOnly(
    buildCustomerBillHtml(customer, d, logo?.dataUrl ?? null),
  )
  const kotJobs = tickets.map((t) => ({
    html: buildPrintDocumentHtmlKotSingle(renderKotInnerHtml(t, d)),
    printerName: kitchenPrinterName(t.kitchen),
  }))
  if (kotJobs.length === 0) {
    runPrint(customerDoc, onAllComplete, { printerName: cfg.customerPrinterName })
    return
  }
  runPrint(customerDoc, () => {
    runPrintJobsSequential(kotJobs, SEQUENTIAL_PRINT_GAP_MS, onAllComplete, true)
  }, { printerName: cfg.customerPrinterName })
}

/** @deprecated Use printKitchenTicketsForStationsSequentially — kept for existing imports. */
export function printKitchenTicketsOnly(tickets: KitchenTicketPayload[], d: Date = new Date()): void {
  printKitchenTicketsForStationsSequentially(tickets, d)
}
