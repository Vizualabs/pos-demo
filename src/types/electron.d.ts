export type ElectronPrinterInfo = {
  name: string
  isDefault: boolean
  status?: number
}

export type ElectronFetchResult = {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  encoding?: "text" | "base64"
}

export type ElectronAPI = {
  isElectron: true
  printHtml: (printerName: string, html: string) => Promise<{ ok: boolean }>
  printSequential: (
    jobs: { printerName: string; html: string }[],
    gapMs?: number,
  ) => Promise<{ ok: boolean }>
  listPrinters: () => Promise<ElectronPrinterInfo[]>
  getVersion: () => Promise<string>
  fetch: (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => Promise<ElectronFetchResult>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
