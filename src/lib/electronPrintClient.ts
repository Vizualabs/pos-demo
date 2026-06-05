/**
 * Silent receipt printing via Electron main process (no QZ Tray, no print-agent).
 * Printer names must match Windows exactly (Control Panel → Printers).
 */
export async function printHtmlViaElectron(printerName: string, html: string): Promise<void> {
  const api = window.electronAPI
  if (!api?.printHtml) {
    throw new Error("Electron print API not available")
  }
  await api.printHtml(printerName.trim(), html)
}

export async function printJobsViaElectron(
  jobs: { printerName: string; html: string }[],
  gapMs = 500,
): Promise<void> {
  const api = window.electronAPI
  if (!api?.printSequential) {
    throw new Error("Electron print API not available")
  }
  await api.printSequential(jobs, gapMs)
}

export async function listElectronPrinters(): Promise<{ name: string; isDefault: boolean }[]> {
  const api = window.electronAPI
  if (!api?.listPrinters) return []
  const list = await api.listPrinters()
  return Array.isArray(list) ? list : []
}
