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
