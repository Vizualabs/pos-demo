import type { Kitchen } from "@/lib/ordersApi"
import {
  customerPrinterIp,
  isValidPrinterIp,
  kitchenPrinterIp,
  loadPrintPrinterConfig,
} from "@/lib/printConfig"
import { postPrintJobs, type ServerPrintJob } from "@/lib/serverPrint"
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
  title: "මුළුතැන්ගෙයි ඇණවුම",
  subtitle: "(මිල ගණන් ඇතුළත් නොවේ)",
  orderNo: "ඇණවුම් අංකය",
  table: "මේස අංකය",
  orderType: "ඇණවුම් වර්ගය",
  time: "වේලාව",
  item: "අයිතමය / විස්තරය",
  qty: "ප්‍රමාණය",
  note: "විශේෂ සටහන්",
  none: "—",
  prepNote: "මෙම පත්‍රිකාව ආහාර පිළියෙළ කිරීම සඳහා පමණි.",
}

/** Labels + branding for customer receipt (print + preview). */
export const customerReceiptDialogLabels = {
  restaurant: "Madhara Restaurant",
  thanks: "THANK YOU COME AGAIN !!!",
  softwareCredit: "Software by VIZUALABS | www.vizualabs.com",
  invoice: "Invoice",
  dateTime: "Date & Time",
  staff: "Staff",
  customer: "Customer",
  description: "DESCRIPTION",
  price: "PRICE",
  qty: "QTY",
  amount: "AMOUNT",
  subTotal: "SUB TOTAL",
  discount: "DISCOUNT",
  netTotal: "NET TOTAL",
  paidAmount: "PAID AMOUNT",
  balance: "BALANCE",
  dueAmount: "DUE AMOUNT",
  noOfItems: "No of Items",
  noOfPcs: "No of Pcs",
  payment: "Payment",
  tax: "Tax (10%)",
  /** Legacy — unused by new layout */
  receipt: "Customer receipt",
  date: "Date",
  orderNo: "Order #",
  table: "Table",
  orderType: "Order type",
  item: "Item",
  unit: "Unit",
  sub: "Subtotal",
  grand: "Total",
}

/** Plain amount for thermal receipt lines (no LKR prefix). */
export function formatReceiptAmount(amount: number): string {
  return amount.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function receiptHr(thin = false): string {
  return `<div class="c-hr${thin ? " c-hr-thin" : ""}"></div>`
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

/** Classic 80mm thermal receipt — same layout as preview, black only. */
export function buildCustomerBillBodyHtml(customer: CustomerBillPayload, d: Date): string {
  const L = customerReceiptDialogLabels
  const { date, time } = formatReceiptDateTime(d)
  const itemCount = customer.lines.length
  const pieceCount = customer.lines.reduce((s, line) => s + line.qty, 0)
  const customerLabel = [customer.tableLabel, customer.orderTypeLabel].filter(Boolean).join(" · ") || "WALK-IN"
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

  const taxRow =
    customer.taxAmount > 0
      ? `<div class="c-sum-row"><span>${L.tax}</span><span>${formatReceiptAmount(customer.taxAmount)}</span></div>`
      : ""

  const paymentBlock = customer.paymentLabel.trim()
    ? `${receiptHr()}
    <div class="c-payment-box">
      <div class="c-sum-row"><span>${L.paidAmount}</span><span>${formatReceiptAmount(paidAmount)}</span></div>
      <div class="c-sum-row"><span>${L.balance}</span><span>${formatReceiptAmount(0)}</span></div>
      <div class="c-sum-row c-sum-due"><span>${L.dueAmount}</span><span>${formatReceiptAmount(dueAmount)}</span></div>
    </div>`
    : ""

  return `<div class="customer-print-section">
    <div class="c-header-block">
      <h1 class="c-shop-name">${escapeHtml(L.restaurant.toUpperCase())}</h1>
      <div class="c-accent-bar"></div>
    </div>
    ${receiptHr()}
    <div class="c-meta-block">
      <div class="c-row"><span class="c-label">${L.invoice}</span><span class="c-val">${customer.orderId}</span></div>
      <div class="c-row"><span class="c-label">${L.dateTime}</span><span class="c-val c-mono">${escapeHtml(date)} • ${escapeHtml(time)}</span></div>
      <div class="c-row"><span class="c-label">${L.staff}</span><span class="c-val">POS</span></div>
    </div>
    ${receiptHr()}
    <div class="c-customer-block">
      <div class="c-inline"><span class="c-label">${L.customer}:</span> <span class="c-val">${escapeHtml(customerLabel)}</span></div>
      ${
        customer.paymentLabel.trim()
          ? `<div class="c-inline"><span class="c-label">${L.payment}:</span> <span class="c-val">${escapeHtml(customer.paymentLabel)}</span></div>`
          : ""
      }
    </div>
    ${receiptHr()}
    <div class="c-col-head">
      <span>${L.description}</span>
      <span class="c-col-qty">${L.qty}</span>
      <span class="c-col-amt">${L.amount}</span>
    </div>
    <div class="c-items">${itemRows}</div>
    ${receiptHr()}
    <div class="c-sum-block">
      <div class="c-sum-row"><span>${L.subTotal}</span><span>${formatReceiptAmount(customer.subtotal)}</span></div>
      ${taxRow}
      <div class="c-sum-row c-sum-net"><span>${L.netTotal}</span><span>${formatReceiptAmount(customer.total)}</span></div>
    </div>
    ${paymentBlock}
    ${receiptHr()}
    <div class="c-count-row">
      <span>${L.noOfItems}: <strong>${itemCount}</strong></span>
      <span>${L.noOfPcs}: <strong>${pieceCount.toFixed(1)}</strong></span>
    </div>
    ${receiptHr()}
    <p class="c-thanks">✦ ${L.thanks} ✦</p>
    <p class="c-credit">${escapeHtml(L.softwareCredit)}</p>
  </div>`
}

function buildCustomerBillHtml(customer: CustomerBillPayload, d: Date): string {
  return buildCustomerBillBodyHtml(customer, d)
}

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
  .kot-meta { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; row-gap: 4px; font-size: 0.72rem; margin-top: 8px; color: #111; align-items: baseline; }
  .kot-meta > span:nth-child(odd) { color: #555; }
  .kot-meta > span:nth-child(even) { text-align: right; font-weight: 600; }
`

function renderKotInnerHtml(ticket: KitchenTicketPayload, d: Date) {
  const rows = ticket.lines
    .map(
      (line) => `<tr>
      <td>${escapeHtml(kotLineItemCell(line))}</td>
      <td style="font-size:1em;font-weight:700">${line.qty}</td>
      <td style="font-size:0.95em">${escapeHtml(line.lineNote?.trim() ? line.lineNote.trim() : kotLabels.none)}</td>
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

/** Print + on-screen preview — black thermal layout (matches printed bill). */
export const CUSTOMER_BILL_PRINT_STYLES = `
      .customer-print-section {
        color: #000;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        max-width: 68mm;
        margin: 0 auto;
        padding: 4px 2px;
        font-size: 13px;
        line-height: 1.4;
      }
      .c-header-block { text-align: center; padding: 8px 0 10px; }
      .c-shop-name {
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0.02em;
        margin: 0 0 8px;
        line-height: 1.15;
      }
      .c-accent-bar {
        width: 48px;
        height: 3px;
        background: #000;
        margin: 0 auto;
      }
      .c-hr {
        border: none;
        border-top: 2px solid #000;
        margin: 10px 0;
        height: 0;
      }
      .c-meta-block, .c-customer-block, .c-sum-block, .c-payment-box {
        margin: 4px 0;
      }
      .c-row, .c-sum-row, .c-count-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin: 4px 0;
      }
      .c-label { color: #000; font-weight: 500; }
      .c-val { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
      .c-mono { font-family: ui-monospace, monospace; font-size: 0.92em; }
      .c-inline { margin: 4px 0; line-height: 1.45; }
      .c-inline .c-label { font-weight: 500; }
      .c-inline .c-val { font-weight: 700; }
      .c-col-head {
        display: grid;
        grid-template-columns: 1fr 2.2rem 4.5rem;
        gap: 6px;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 8px 0 6px;
        color: #000;
      }
      .c-col-qty { text-align: center; }
      .c-col-amt { text-align: right; }
      .c-items { margin: 6px 0; }
      .c-item-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        margin: 10px 0;
      }
      .c-item-main { flex: 1; min-width: 0; }
      .c-item-name {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.25;
        margin-bottom: 2px;
        word-break: break-word;
      }
      .c-item-sub {
        font-size: 12px;
        font-weight: 500;
        color: #000;
        font-variant-numeric: tabular-nums;
      }
      .c-item-amt {
        font-size: 14px;
        font-weight: 800;
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .c-sum-block { margin-top: 4px; }
      .c-sum-row span:last-child { font-weight: 700; }
      .c-sum-net {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 2px solid #000;
        font-size: 15px;
        font-weight: 800;
      }
      .c-sum-net span:last-child { font-weight: 900; }
      .c-payment-box {
        border: 2px solid #000;
        padding: 8px 10px;
        margin: 8px 0;
      }
      .c-sum-due span:last-child { font-weight: 900; }
      .c-count-row {
        font-size: 12px;
        font-weight: 600;
      }
      .c-count-row strong { font-weight: 800; }
      .c-thanks {
        text-align: center;
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 10px 0 6px;
      }
      .c-credit {
        text-align: center;
        font-size: 10px;
        font-weight: 500;
        font-style: italic;
        margin: 0;
        color: #000;
      }
`

function buildPrintDocumentHtmlCustomerOnly(customerHtml: string): string {
  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8" />
    <title>Customer bill</title>
    <style>
      ${THERMAL_BASE_STYLES}
      ${CUSTOMER_BILL_PRINT_STYLES}
      body { font-size: 13px; color: #000; }
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
  preferIframe?: boolean
  printerIp?: string
  slot?: string
}

function kitchenSlot(kitchen: Kitchen): string {
  return kitchen === "KITCHEN_1" ? "kitchen1" : "kitchen2"
}

function printHtmlInWindow(
  win: Window,
  html: string,
  onComplete?: () => void,
  opts: { closeDelayMs?: number; printDelayMs?: number; kiosk?: boolean } = {},
): void {
  let completeFired = false
  const fireComplete = () => {
    if (completeFired) return
    completeFired = true
    onComplete?.()
  }

  const closeDelayMs = opts.closeDelayMs ?? (opts.kiosk ? 4000 : 60_000)
  const printDelayMs = opts.printDelayMs ?? 350

  try {
    const doc = win.document
    doc.open()
    doc.write(html)
    doc.close()
    if (!opts.kiosk) win.focus()
  } catch {
    toast.error("Could not prepare bill for printing.")
    fireComplete()
    return
  }

  const doPrint = () => {
    try {
      win.print()
    } catch {
      if (!opts.kiosk) {
        toast.error("Print failed — check Chrome is started with --kiosk-printing for silent USB bill.")
      }
    }
    const closeLater = () => {
      if (!opts.kiosk) {
        try {
          if (!win.closed) win.close()
        } catch {
          /* ignore */
        }
      }
      fireComplete()
    }
    win.addEventListener("afterprint", closeLater, { once: true })
    setTimeout(closeLater, closeDelayMs)
  }

  const kick = () => setTimeout(doPrint, printDelayMs)
  if (win.document.readyState === "complete") {
    kick()
  } else {
    win.addEventListener("load", kick, { once: true })
  }
}

/** Silent USB cashier print — hidden iframe + Chrome --kiosk-printing (no popup, no dialog). */
function runPrintBrowserKiosk(html: string, onComplete?: () => void): void {
  const iframe = document.createElement("iframe")
  iframe.setAttribute("title", "Print receipt")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:320px;height:2400px;border:0;margin:0;padding:0;opacity:0;pointer-events:none"
  document.body.appendChild(iframe)
  const iw = iframe.contentWindow
  if (!iw) {
    iframe.remove()
    onComplete?.()
    return
  }
  printHtmlInWindow(
    iw,
    html,
    () => {
      iframe.remove()
      onComplete?.()
    },
    { kiosk: true },
  )
}

/** Dev / fallback: visible print when kiosk mode is not enabled. */
function runPrintBrowser(html: string, onComplete?: () => void, _options?: RunPrintOptions): void {
  runPrintBrowserKiosk(html, onComplete)
}

const SEQUENTIAL_PRINT_GAP_MS = 500

type LocalPrintJob = { html: string; preferIframe?: boolean }

function runPrintJobsSequentialBrowser(
  jobs: LocalPrintJob[],
  delayBetweenMs = SEQUENTIAL_PRINT_GAP_MS,
  onAllDone?: () => void,
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
    runPrintBrowser(
      jobs[idx]!.html,
      () => {
        setTimeout(next, delayBetweenMs)
      },
      { preferIframe: true },
    )
  }
  next()
}

function buildKitchenServerJobs(tickets: KitchenTicketPayload[], d: Date): ServerPrintJob[] {
  const cfg = loadPrintPrinterConfig()
  const port = cfg.printerPort
  const jobs: ServerPrintJob[] = []

  for (const t of tickets) {
    const ip = kitchenPrinterIp(t.kitchen)
    if (!ip) {
      throw new Error(`Kitchen printer IP empty — set Kitchen ${t.kitchen === "KITCHEN_1" ? "1" : "2"} in Settings.`)
    }
    if (!isValidPrinterIp(ip)) {
      throw new Error(
        `Kitchen ${t.kitchen === "KITCHEN_1" ? "1" : "2"} IP invalid (${ip}) — use format 192.168.1.101 in Settings.`,
      )
    }
    jobs.push({
      slot: kitchenSlot(t.kitchen),
      html: buildPrintDocumentHtmlKotSingle(renderKotInnerHtml(t, d)),
      printerIp: ip,
      port,
    })
  }

  return jobs
}

function buildCustomerBillHtmlDoc(customer: CustomerBillPayload, d: Date): string {
  return buildPrintDocumentHtmlCustomerOnly(buildCustomerBillHtml(customer, d))
}

function buildCustomerNetworkJob(customer: CustomerBillPayload, d: Date): ServerPrintJob {
  const cfg = loadPrintPrinterConfig()
  const ip = customerPrinterIp()
  if (!ip) {
    throw new Error("Cashier printer IP empty — set Customer bill printer IP in Settings.")
  }
  if (!isValidPrinterIp(ip)) {
    throw new Error(`Cashier printer IP invalid (${ip}) — use format 192.168.1.100 in Settings.`)
  }
  return {
    slot: "customer",
    html: buildCustomerBillHtmlDoc(customer, d),
    printerIp: ip,
    port: cfg.printerPort,
  }
}

async function runServerPrintJobs(
  jobs: ServerPrintJob[],
  orderId: number,
): Promise<boolean> {
  if (jobs.length === 0) return true
  try {
    const result = await postPrintJobs(jobs, orderId)
    if (!result.ok) {
      const failedList = result.failed.map((f) => `${f.slot}: ${f.error}`).join("; ")
      toast.error(`Print failed — ${failedList}`, { duration: 8000 })
      return false
    }
    if (result.printed.length > 0) {
      toast.success(`Printed: ${result.printed.join(", ")}`, { duration: 3000 })
    }
    return true
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    toast.error(`Print server unreachable — kitchen not printed. Is npm run dev:server running? (${msg})`, {
      duration: 8000,
    })
    return false
  }
}

async function dispatchOrderPrint(
  tickets: KitchenTicketPayload[],
  customer: CustomerBillPayload | null,
  d: Date,
  onComplete?: () => void,
): Promise<void> {
  const cfg = loadPrintPrinterConfig()
  const orderId = customer?.orderId ?? tickets[0]?.orderId ?? 0

  if (cfg.printBackend === "browser") {
    const htmlJobs: LocalPrintJob[] = []
    for (const t of tickets) {
      htmlJobs.push({
        html: buildPrintDocumentHtmlKotSingle(renderKotInnerHtml(t, d)),
      })
    }
    if (customer) {
      htmlJobs.push({ html: buildCustomerBillHtmlDoc(customer, d) })
    }
    runPrintJobsSequentialBrowser(htmlJobs, SEQUENTIAL_PRINT_GAP_MS, onComplete)
    return
  }

  try {
    const jobs = buildKitchenServerJobs(tickets, d)
    if (customer) {
      jobs.push(buildCustomerNetworkJob(customer, d))
    }
    await runServerPrintJobs(jobs, orderId)
    onComplete?.()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    toast.error(`Print failed: ${msg}`)
    onComplete?.()
  }
}

/** Customer bill only — LAN printer IP via print server. */
export function printCustomerBillOnly(customer: CustomerBillPayload, d: Date = new Date()): void {
  void dispatchOrderPrint([], customer, d)
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
  void dispatchOrderPrint(tickets, null, d, onAllComplete)
}

/**
 * Kitchen ticket(s) first (Kitchen 1, then Kitchen 2), then customer bill.
 * All three printers via LAN IP → print server → TCP :9100 ESC/POS.
 */
export function printCustomerBillAndKitchenTickets(
  customer: CustomerBillPayload,
  tickets: KitchenTicketPayload[],
  d: Date,
  onAllComplete?: () => void,
) {
  void dispatchOrderPrint(tickets, customer, d, onAllComplete)
}

/** @deprecated Use printKitchenTicketsForStationsSequentially — kept for existing imports. */
export function printKitchenTicketsOnly(tickets: KitchenTicketPayload[], d: Date = new Date()): void {
  printKitchenTicketsForStationsSequentially(tickets, d)
}
