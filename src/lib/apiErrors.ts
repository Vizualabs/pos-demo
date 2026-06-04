import axios from "axios"

/** Read Spring Boot / axios error bodies for user-facing toasts */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (typeof data === "string" && data.trim()) return data.trim()
    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>
      if (typeof d.message === "string" && d.message.trim()) return d.message.trim()
      if (typeof d.error === "string" && d.error.trim()) return d.error.trim()
      if (Array.isArray(d.errors)) {
        const joined = d.errors.map((x) => String(x)).filter(Boolean).join(", ")
        if (joined) return joined
      }
    }
    const status = err.response?.status
    if (status) return `${fallback} (HTTP ${status})`
  }

  if (err instanceof Error && err.message.trim()) return err.message.trim()
  return fallback
}
