import { isElectronApp } from "@/lib/isElectron"
import { clearAuthSession } from "@/lib/authSession"

/** Avoid `replace("/")` on Electron file:// — that becomes `file:///D:/` (white screen). */
export function redirectToLoginPage(): void {
  if (typeof window === "undefined") return

  if (isElectronApp()) {
    const hash = window.location.hash
    if (!hash || hash === "#" || hash === "#/" || hash.startsWith("#/login")) return
    clearAuthSession()
    window.location.hash = "#/"
    return
  }

  const path = window.location.pathname
  if (path === "/" || path === "/login") return
  clearAuthSession()
  window.location.replace("/")
}

export function redirectToSuspendedPage(message?: string, deadline?: string | null): void {
  if (typeof window === "undefined") return
  clearAuthSession()

  const params = new URLSearchParams()
  if (message) params.set("message", message)
  if (deadline) params.set("deadline", deadline)
  const qs = params.toString()
  const path = qs ? `/suspended?${qs}` : "/suspended"

  if (isElectronApp()) {
    window.location.hash = `#${path}`
    return
  }

  if (window.location.pathname.startsWith("/suspended")) return
  window.location.replace(path)
}
