import { mergePrintPrinterConfig, type PrintPrinterConfig } from "@/lib/printConfig"

export type ServerPrintJob = {
  slot: string
  html: string
  printerIp: string
  port?: number
}

export type ServerPrintJobsResponse = {
  ok: boolean
  orderId?: number | null
  printed: string[]
  failed: { slot: string; error: string }[]
  error?: string
}

/** Node print server — never use Java `VITE_API_BASE_URL` (8081). Dev: Vite proxies `/api/print` → :3001. */
function printApiBase(): string {
  const fromEnv = import.meta.env.VITE_PRINT_API_BASE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, "")
  return "/api/print"
}

export async function fetchPrintSettings(): Promise<{
  customerPrinterIp: string
  kitchen1PrinterIp: string
  kitchen2PrinterIp: string
  printerPort: number
}> {
  const res = await fetch(`${printApiBase()}/settings`, { credentials: "include" })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) detail = j.error
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function savePrintSettingsToServer(settings: {
  customerPrinterIp: string
  kitchen1PrinterIp: string
  kitchen2PrinterIp: string
  printerPort: number
}): Promise<void> {
  const res = await fetch(`${printApiBase()}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(settings),
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) detail = j.error
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
}

/** Send all print jobs in one request; server prints sequentially (kitchen → bill). */
export async function postPrintJobs(
  jobs: ServerPrintJob[],
  orderId?: number,
): Promise<ServerPrintJobsResponse> {
  const res = await fetch(`${printApiBase()}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ orderId: orderId ?? null, jobs }),
  })
  const body = (await res.json()) as ServerPrintJobsResponse
  if (!res.ok && res.status !== 207) {
    throw new Error(body.error || body.failed?.[0]?.error || `HTTP ${res.status}`)
  }
  return body
}

/** Load print settings from Node server into localStorage so POS print uses current IPs. */
export async function syncPrintSettingsFromServer(): Promise<PrintPrinterConfig | null> {
  try {
    const remote = await fetchPrintSettings()
    return mergePrintPrinterConfig({
      customerPrinterIp: remote.customerPrinterIp,
      kitchen1PrinterIp: remote.kitchen1PrinterIp,
      kitchen2PrinterIp: remote.kitchen2PrinterIp,
      printerPort: remote.printerPort,
    })
  } catch {
    return null
  }
}
