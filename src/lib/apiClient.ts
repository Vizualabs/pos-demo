type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type ApiClientOptions = {
  /**
  * Defaults to `import.meta.env.VITE_API_BASE_URL`.
  * If not set, uses same-origin (""), which is ideal for local dev via Vite proxy.
   * Should NOT include a trailing slash.
   */
  baseUrl?: string
  /** If provided, used as `Authorization: Bearer <token>` */
  token?: string | null
  /**
   * Whether to send cookies. Defaults to true since existing security endpoints
   * in this repo use cookie sessions.
   */
  credentials?: RequestCredentials
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "")
}

export function getDefaultApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (fromEnv?.trim()) return normalizeBaseUrl(fromEnv.trim())
  return ""
}

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem("token")
  } catch {
    return null
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const data: unknown = await res.json().catch(() => null)
    if (data && typeof data === "object") {
      const rec = data as Record<string, unknown>
      const msg = rec.message ?? rec.error ?? rec.details
      if (typeof msg === "string" && msg.trim()) return msg
    }
    return data == null ? `${res.status} ${res.statusText}` : JSON.stringify(data)
  }
  const text = await res.text().catch(() => "")
  return text || `${res.status} ${res.statusText}`
}

export async function apiFetch<T>(
  path: string,
  init: Omit<RequestInit, "method" | "headers" | "body"> & {
    method?: HttpMethod
    headers?: Record<string, string>
    body?: unknown
    options?: ApiClientOptions
  } = {},
): Promise<T> {
  const method: HttpMethod = init.method ?? "GET"
  const options = init.options

  const baseUrl = normalizeBaseUrl(options?.baseUrl ?? getDefaultApiBaseUrl())
  const token = options?.token !== undefined ? options.token : getStoredAuthToken()
  const credentials = options?.credentials ?? "include"

  const url = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`

  const headers: Record<string, string> = {
    ...(init.headers ?? {}),
  }

  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData
  if (init.body !== undefined && init.body !== null && !isFormData) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json"
  }

  if (token) {
    headers["Authorization"] = headers["Authorization"] ?? `Bearer ${token}`
  }

  const body =
    init.body === undefined || init.body === null
      ? undefined
      : isFormData
        ? (init.body as FormData)
        : JSON.stringify(init.body)

  const res = await fetch(url, {
    ...init,
    method,
    headers,
    credentials,
    body: body as BodyInit | null | undefined,
  })

  if (!res.ok) {
    const msg = await readErrorMessage(res)
    const prefix = `${res.status} ${res.statusText}`
    throw new Error(msg.startsWith(prefix) ? msg : `${prefix}: ${msg}`)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  const ct = res.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    return (await res.json()) as T
  }
  return (await res.text()) as unknown as T
}

export async function apiFetchBlob(
  path: string,
  init: Omit<RequestInit, "method" | "headers" | "body"> & {
    method?: HttpMethod
    headers?: Record<string, string>
    body?: unknown
    options?: ApiClientOptions
  } = {},
): Promise<Blob> {
  const method: HttpMethod = init.method ?? "GET"
  const options = init.options

  const baseUrl = normalizeBaseUrl(options?.baseUrl ?? getDefaultApiBaseUrl())
  const token = options?.token !== undefined ? options.token : getStoredAuthToken()
  const credentials = options?.credentials ?? "include"

  const url = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`

  const headers: Record<string, string> = {
    ...(init.headers ?? {}),
  }

  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData
  if (!isFormData) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json"
  }

  if (token) {
    headers["Authorization"] = headers["Authorization"] ?? `Bearer ${token}`
  }

  const body =
    init.body === undefined || init.body === null
      ? undefined
      : isFormData
        ? (init.body as FormData)
        : JSON.stringify(init.body)

  const res = await fetch(url, {
    ...init,
    method,
    headers,
    credentials,
    body: body as BodyInit | null | undefined,
  })

  if (!res.ok) {
    const msg = await readErrorMessage(res)
    const prefix = `${res.status} ${res.statusText}`
    throw new Error(msg.startsWith(prefix) ? msg : `${prefix}: ${msg}`)
  }

  return await res.blob()
}
