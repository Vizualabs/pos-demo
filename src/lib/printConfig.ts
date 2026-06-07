import { isElectronApp } from "@/lib/isElectron"

const STORAGE_KEY = "pos_print_printers_v1"

/** How receipt jobs are sent: browser dialog, QZ Tray, HTTP agent, or Electron (desktop app). */
export type PrintBackend = "browser" | "qz" | "http" | "electron"

export type PrintPrinterConfig = {
  printBackend: PrintBackend
  /** Desktop app: print directly to named Windows printers (no dialog). */
  silentPrint: boolean
  /** Windows printer name (exact) — used by QZ Tray and the optional print agent */
  customerPrinterName: string
  kitchen1PrinterName: string
  kitchen2PrinterName: string
  /** Base URL for HTTP agent, e.g. http://127.0.0.1:9101 (POST /print) */
  printAgentUrl: string
}

export function hasElectronPrintApi(): boolean {
  return typeof window !== "undefined" && Boolean(window.electronAPI?.printHtml)
}

/** First-time load (no localStorage entry yet). Change in Settings anytime; existing saved config wins over this. */
const defaults: PrintPrinterConfig = {
  printBackend: hasElectronPrintApi() ? "electron" : "qz",
  silentPrint: hasElectronPrintApi(),
  customerPrinterName: "",
  kitchen1PrinterName: "",
  kitchen2PrinterName: "",
  printAgentUrl: "",
}

export function usesElectronSilentPrint(cfg: PrintPrinterConfig): boolean {
  if (typeof window === "undefined") return false
  if (!window.electronAPI?.printHtml) return false
  return cfg.silentPrint || cfg.printBackend === "electron"
}

function normalizeBackend(v: unknown): PrintBackend {
  if (v === "electron" && hasElectronPrintApi()) return "electron"
  if (v === "qz" || v === "http" || v === "browser") return v
  return defaults.printBackend
}

export function loadPrintPrinterConfig(): PrintPrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const p = JSON.parse(raw) as Partial<PrintPrinterConfig>
    let printBackend = normalizeBackend(p.printBackend)
    if (hasElectronPrintApi() && (printBackend === "qz" || printBackend === "http")) {
      printBackend = "electron"
    }
    return {
      printBackend,
      silentPrint:
        typeof p.silentPrint === "boolean"
          ? p.silentPrint
          : printBackend === "electron" && hasElectronPrintApi(),
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

export function printerOsSettingsLabel(): {
  osName: string
  settingsPath: string
  listButton: string
  emptyListHint: string
} {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.userAgent)
  if (isMac) {
    return {
      osName: "macOS",
      settingsPath: "System Settings → Printers & Scanners",
      listButton: "Show macOS printers",
      emptyListHint: "No printers found — add them in System Settings → Printers & Scanners",
    }
  }
  return {
    osName: "Windows",
    settingsPath: "Windows Settings → Printers",
    listButton: "Show Windows printers",
    emptyListHint: "No printers found — add them in Windows Settings → Printers",
  }
}
