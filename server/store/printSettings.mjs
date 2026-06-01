import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SETTINGS_PATH = join(__dirname, "print-settings.json")

const DEFAULTS = {
  customerPrinterIp: "",
  kitchen1PrinterIp: "",
  kitchen2PrinterIp: "",
  printerPort: 9100,
}

/** @typedef {typeof DEFAULTS} PrintSettings */

/** @returns {Promise<PrintSettings>} */
export async function loadPrintSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8")
    const parsed = JSON.parse(raw)
    let customerIp = String(parsed.customerPrinterIp ?? "").trim()
    const legacyName = String(parsed.customerPrinterName ?? "").trim()
    if (!customerIp && /^\d{1,3}(\.\d{1,3}){3}$/.test(legacyName)) {
      customerIp = legacyName
    }
    return {
      customerPrinterIp: customerIp,
      kitchen1PrinterIp: String(parsed.kitchen1PrinterIp ?? ""),
      kitchen2PrinterIp: String(parsed.kitchen2PrinterIp ?? ""),
      printerPort: Number(parsed.printerPort) || 9100,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/** @param {Partial<PrintSettings>} patch */
export async function savePrintSettings(patch) {
  const current = await loadPrintSettings()
  const next = {
    customerPrinterIp: String(patch.customerPrinterIp ?? current.customerPrinterIp).trim(),
    kitchen1PrinterIp: String(patch.kitchen1PrinterIp ?? current.kitchen1PrinterIp).trim(),
    kitchen2PrinterIp: String(patch.kitchen2PrinterIp ?? current.kitchen2PrinterIp).trim(),
    printerPort: Number(patch.printerPort ?? current.printerPort) || 9100,
  }
  await mkdir(dirname(SETTINGS_PATH), { recursive: true })
  await writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf8")
  return next
}
