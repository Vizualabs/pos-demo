import type { Kitchen } from "@/lib/ordersApi"
import { getBrandLogoForEmbed } from "@/lib/brandLogo"
import { loadPrintPrinterConfig } from "@/lib/printConfig"
import { printHtmlViaQz } from "@/lib/qzPrintClient"
import { postPrintToAgent } from "@/lib/httpPrintAgent"
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
  orderTypeLabelSi: string
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
  orderNo: "ඇණවුම් අංකය",
  table: "මේස අංකය",
  orderType: "ඇණවුම් වර්ගය",
  time: "වේලාව",
  item: "අයිතමය / විස්තරය",
  qty: "ප්‍රමාණය",
  note: "විශේෂ සටහන්", // Note එකට වඩාත් වෘත්තීය පෙනුමක් ලබා දෙයි
  none: "—",
  prepNote: "මෙම පත්‍රිකාව ආහාර පිළියෙළ කිරීම සඳහා පමණි.",
}

/** Labels for customer receipt preview + thermal print (shared). */
export const customerReceiptDialogLabels = {
  restaurant: "Madhara Restaurant",
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
  return si && si.length > 0 ? si : line.nameEn
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

/** Black-only styles for preview + print document */
export const CUSTOMER_BILL_PRINT_STYLES = `
  .customer-print-section { color: #000; font-family: system-ui, -apple-system, Segoe UI, sans-serif; font-size: 11px; line-height: 1.35; }
  .c-top { text-align: center; padding: 4px 4px 8px; border-bottom: 2px solid #000; }
  .c-logo-wrap { padding: 4px 0 6px; }
  .c-logo { display: block; margin: 0 auto; width: 22mm; max-width: 72%; height: auto; max-height: 18mm; object-fit: contain; filter: grayscale(100%) contrast(1.15); }
  .c-restaurant { font-size: 15px; font-weight: 800; letter-spacing: 0.5px; }
  .c-head-rule { width: 28px; height: 2px; background: #000; margin: 6px auto 0; }
  .c-body { padding: 8px 2px 4px; }
  .c-hr { border-top: 2px solid #000; margin: 8px 0; opacity: 0.15; }
  .c-hr-thin { border-top-width: 1px; margin: 6px 0; }
  .c-meta { font-size: 10px; }
  .c-meta-row { display: flex; justify-content: space-between; gap: 6px; padding: 2px 0; }
  .c-meta-v { font-weight: 700; text-align: right; }
  .c-meta-sm { font-size: 9px; font-weight: 600; }
  .c-items-head { display: grid; grid-template-columns: 1fr 2.2rem 3.5rem; gap: 4px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; padding-bottom: 4px; border-bottom: 1px solid #000; }
  .c-col-qty { text-align: center; }
  .c-col-amt { text-align: right; }
  .c-items { margin-top: 4px; }
  .c-item-row { display: flex; justify-content: space-between; gap: 6px; padding: 5px 0; border-bottom: 1px solid #e5e5e5; }
  .c-item-row:last-child { border-bottom: none; }
  .c-item-name { font-size: 11px; font-weight: 700; }
  .c-item-sub { font-size: 9px; color: #333; margin-top: 1px; }
  .c-item-amt { font-size: 11px; font-weight: 800; white-space: nowrap; }
  .c-summary { font-size: 10px; }
  .c-sum-row { display: flex; justify-content: space-between; padding: 2px 0; }
  .c-net-row { display: flex; justify-content: space-between; padding: 6px 0 2px; margin-top: 4px; border-top: 2px solid #000; font-size: 12px; font-weight: 900; }
  .c-pay-block { padding: 6px 0; border: 1px dashed #666; margin-top: 4px; }
  .c-sum-due span:last-child { font-weight: 900; }
  .c-stats { display: flex; justify-content: space-between; font-size: 9px; font-weight: 600; }
  .c-foot { text-align: center; padding-top: 4px; }
  .c-thanks { font-size: 10px; font-weight: 800; margin: 0 0 4px; letter-spacing: 0.3px; }
  .c-credit { font-size: 8px; color: #333; margin: 0; font-style: italic; }
`

/** Matches index.css — embedded in print popup so styles apply without Tailwind */
const KOT_PRINT_STYLES = `
  .kot-title {
    font-size: 1.15rem;
    letter-spacing: 0.3px;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
    margin-bottom: 8px;
    text-align: center;
    font-weight: bold;
  }
  .kot-table {
    font-size: 0.95rem;
    line-height: 1.5;
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }
  .kot-table th, .kot-table td {
    text-align: left;
    padding: 7px 4px;
    border-bottom: 1px solid #eaeaea;
  }
  .kot-table th:nth-child(2), .kot-table td:nth-child(2) { text-align: center; }
  .kot-table th:nth-child(3), .kot-table td:nth-child(3) { text-align: left; word-break: break-word; }
  .kot-table th { font-weight: 600; }
  .prep-note {
    font-style: italic;
    font-size: 0.8rem;
    margin-top: 14px;
    text-align: center;
    border-top: 1px dashed #777;
    padding-top: 8px;
  }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; background: #111; color: #fff; font-size: 0.85rem; margin: 8px 0; }
  .kot-page { page-break-after: always; }
  .kot-page:last-child { page-break-after: auto; }
  .kot-single { page-break-after: auto; }
  .kot-subtitle { font-size: 0.7rem; color: #666; text-align: center; margin: 4px 0 8px; }
  /* Key/value rows: keep labels tight, values aligned nicely */
  .kot-meta { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; row-gap: 4px; font-size: 0.72rem; margin-top: 8px; color: #111; align-items: baseline; }
  .kot-meta > span:nth-child(odd) { color: #555; }
  .kot-meta > span:nth-child(even) { text-align: right; font-weight: 600; }
`

function renderKotInnerHtml(ticket: KitchenTicketPayload, d: Date) {
  const rows = ticket.lines
    .map(
      (line) => `<tr>
      <td>${escapeHtml(kotLineItemCell(line))}</td>
      <td style="font-weight:700">${line.qty}</td>
      <td style="font-size:0.95rem">${escapeHtml(line.lineNote?.trim() ? line.lineNote.trim() : kotLabels.none)}</td>
    </tr>`,
    )
    .join("")
  const noteBlock = `<p class="prep-note">${kotLabels.prepNote}</p>`
  return `
    <div class="kot-title">${kotLabels.title}</div>
    <p class="kot-subtitle">${kotLabels.subtitle}</p>
    <div style="text-align:center"><span class="badge">${ticket.kitchenBadgeSi}</span></div>
    <div class="kot-meta">
      <span>${kotLabels.orderNo}:</span><span style="text-align:right;font-family:monospace;font-weight:700">#${ticket.orderId}</span>
      <span>${kotLabels.table}:</span><span style="text-align:right">${escapeHtml(ticket.tableLabel)}</span>
      <span>${kotLabels.orderType}:</span><span style="text-align:right">${escapeHtml(ticket.orderTypeLabelSi)}</span>
      <span>${kotLabels.time}:</span><span style="text-align:right">${escapeHtml(d.toLocaleString())}</span>
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

/** 80mm thermal roll: content width ~72mm inside printable area. */
const THERMAL_BASE_STYLES = `
      @page { size: 80mm auto; margin: 2mm; }
      html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        font-family: system-ui, -apple-system, Segoe UI, sans-serif;
        width: 72mm;
        max-width: 72mm;
        margin: 0 auto;
        padding: 2mm;
        font-size: 11px;
        box-sizing: border-box;
      }
      @media print {
        html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; }
        body { margin: 0 auto; padding: 2mm; }
      }
`

function buildPrintDocumentHtmlCustomerOnly(customerHtml: string): string {
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8" />
    <title>Customer bill</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      ${THERMAL_BASE_STYLES}
      ${CUSTOMER_BILL_PRINT_STYLES}
      @media print {
        .c-hr { border-color: #000 !important; opacity: 1 !important; }
        .c-item-row { border-color: #ccc !important; }
      }
    </style>
  </head><body>${customerHtml}</body></html>`
}

/** One kitchen station per print job (80mm). */
function buildPrintDocumentHtmlKotSingle(kotInnerHtml: string): string {
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8" />
    <title>Kitchen ticket</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      ${THERMAL_BASE_STYLES}
      ${KOT_PRINT_STYLES}
      body { font-family: 'Noto Sans Sinhala', system-ui, sans-serif; font-size: 12px; }
      .kot-title { font-size: 1.15rem; }
      .kot-table { font-size: 0.95rem; line-height: 1.5; }
      @media print {
        .kot-single { page-break-after: auto; break-after: auto; }
      }
    </style>
  </head><body><div class="kot-single">${kotInnerHtml}</div></body></html>`
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
