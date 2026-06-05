import { isElectronApp } from "@/lib/isElectron"

const STORAGE_KEY = "pos_print_printers_v1"

/** How receipt jobs are sent: browser dialog, QZ Tray, HTTP agent, or Electron (desktop app). */
export type PrintBackend = "browser" | "qz" | "http" | "electron"

export type PrintPrinterConfig = {
  printBackend: PrintBackend
  /** Windows printer name (exact) — used by QZ Tray and the optional print agent */
  customerPrinterName: string
  kitchen1PrinterName: string
  kitchen2PrinterName: string
  /** Base URL for HTTP agent, e.g. http://127.0.0.1:9101 (POST /print) */
  printAgentUrl: string
}

/** First-time load (no localStorage entry yet). Change in Settings anytime; existing saved config wins over this. */
const defaults: PrintPrinterConfig = {
  printBackend: isElectronApp() ? "electron" : "qz",
  customerPrinterName: "",
  kitchen1PrinterName: "",
  kitchen2PrinterName: "", 
  printAgentUrl: "",
}

function normalizeBackend(v: unknown): PrintBackend {
  if (v === "electron" && isElectronApp()) return "electron"
  if (v === "qz" || v === "http" || v === "browser") return v
  return defaults.printBackend
}

export function loadPrintPrinterConfig(): PrintPrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const p = JSON.parse(raw) as Partial<PrintPrinterConfig>
    let printBackend = normalizeBackend(p.printBackend)
    if (isElectronApp() && (printBackend === "qz" || printBackend === "http")) {
      printBackend = "electron"
    }
    return {
      printBackend,
      customerPrinterName: String(p.customerPrinterName ?? ""),
      kitchen1PrinterName: String(p.kitchen1PrinterName ?? ""),
      kitchen2PrinterName: String(p.kitchen2PrinterName ?? ""),
      printAgentUrl: String(p.printAgentUrl ?? ""),
    }
  } catch {
    return { ...defaults }
  }
}

export function savePrintPrinterConfig(c: PrintPrinterConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
}
