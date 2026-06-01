const STORAGE_KEY = "pos_print_printers_v1"

/** How receipt jobs are sent: cloud Node server (production) or browser dialog (dev). */
export type PrintBackend = "server" | "browser"

export type PrintPrinterConfig = {
  printBackend: PrintBackend
  /** Cashier / customer bill printer — LAN IP, port 9100. */
  customerPrinterIp: string
  kitchen1PrinterIp: string
  kitchen2PrinterIp: string
  /** TCP port for network thermal printers (default 9100). */
  printerPort: number
}

const defaults: PrintPrinterConfig = {
  printBackend: "server",
  customerPrinterIp: "",
  kitchen1PrinterIp: "",
  kitchen2PrinterIp: "",
  printerPort: 9100,
}

function normalizeBackend(v: unknown): PrintBackend {
  if (v === "browser") return "browser"
  return "server"
}

function migrateLegacyFields(p: Record<string, unknown>): Partial<PrintPrinterConfig> {
  const legacy = p as {
    customerPrinterName?: string
    kitchen1PrinterName?: string
    kitchen2PrinterName?: string
    customerPrinterIp?: string
    kitchen1PrinterIp?: string
    kitchen2PrinterIp?: string
    customerPrinterConnection?: string
  }
  let customerIp = String(legacy.customerPrinterIp ?? "").trim()
  const legacyName = String(legacy.customerPrinterName ?? "").trim()
  if (!customerIp && legacyName && isValidPrinterIp(legacyName)) {
    customerIp = legacyName
  }
  return {
    customerPrinterIp: isValidPrinterIp(customerIp) ? customerIp : "",
    kitchen1PrinterIp: String(legacy.kitchen1PrinterIp ?? legacy.kitchen1PrinterName ?? ""),
    kitchen2PrinterIp: String(legacy.kitchen2PrinterIp ?? legacy.kitchen2PrinterName ?? ""),
  }
}

export function loadPrintPrinterConfig(): PrintPrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const p = JSON.parse(raw) as Partial<PrintPrinterConfig> & Record<string, unknown>
    const migrated = migrateLegacyFields(p)
    const port = Number(p.printerPort)
    return {
      printBackend: normalizeBackend(p.printBackend),
      customerPrinterIp: String(p.customerPrinterIp ?? migrated.customerPrinterIp ?? "").trim(),
      kitchen1PrinterIp: String(p.kitchen1PrinterIp ?? migrated.kitchen1PrinterIp ?? "").trim(),
      kitchen2PrinterIp: String(p.kitchen2PrinterIp ?? migrated.kitchen2PrinterIp ?? "").trim(),
      printerPort: port > 0 ? port : defaults.printerPort,
    }
  } catch {
    return { ...defaults }
  }
}

export function savePrintPrinterConfig(c: PrintPrinterConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
}

/** Merge server/API settings into localStorage (print jobs read from here). */
export function mergePrintPrinterConfig(patch: Partial<PrintPrinterConfig>): PrintPrinterConfig {
  const next: PrintPrinterConfig = {
    ...loadPrintPrinterConfig(),
    ...patch,
  }
  savePrintPrinterConfig(next)
  return next
}

export function isValidPrinterIp(ip: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false
  return ip.split(".").every((part) => {
    const n = Number(part)
    return Number.isInteger(n) && n >= 0 && n <= 255
  })
}

export function customerPrinterIp(): string {
  return loadPrintPrinterConfig().customerPrinterIp.trim()
}

export function kitchenPrinterIp(kitchen: "KITCHEN_1" | "KITCHEN_2"): string {
  const cfg = loadPrintPrinterConfig()
  return (kitchen === "KITCHEN_1" ? cfg.kitchen1PrinterIp : cfg.kitchen2PrinterIp).trim()
}
