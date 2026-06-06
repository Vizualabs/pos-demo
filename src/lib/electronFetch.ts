import type { ElectronFetchResult } from "@/types/electron"
import { isElectronApp } from "@/lib/isElectron"

export type { ElectronFetchResult }

/** Main-process fetch only for file:// — http dev/preview use renderer + Vite proxy. */
export function shouldRouteApiViaElectronMain(): boolean {
  if (typeof window === "undefined") return false
  if (!isElectronApp() || !window.electronAPI?.fetch) return false
  const proto = window.location.protocol
  return proto === "file:" || proto === "app:"
}

/** Fetch via Electron main process — avoids CORS/cookie issues from file:// origin. */
export async function electronFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<ElectronFetchResult> {
  const api = window.electronAPI
  if (!api?.fetch) {
    throw new Error("Electron fetch API not available")
  }
  return api.fetch(url, init)
}

function bodyToResponse(result: ElectronFetchResult): Response {
  if (result.encoding === "base64") {
    const binary = atob(result.body)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Response(bytes, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    })
  }
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers: result.headers,
  })
}

/** Drop-in Response wrapper for renderer fetch calls. */
export async function electronFetchAsResponse(
  url: string,
  init: {
    method?: string
    headers?: Record<string, string>
    body?: string
    credentials?: RequestCredentials
  } = {},
): Promise<Response> {
  const result = await electronFetch(url, init)
  return bodyToResponse(result)
}
