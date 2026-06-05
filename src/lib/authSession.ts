import { resolveApiUrl } from "@/lib/apiClient"
import { isElectronApp } from "@/lib/isElectron"

export type UserRole = "ADMIN" | "USER" | "GUEST"

const USER_DETAILS_API = "/api/security/user/details"
/** Tab session only — survives refresh, cleared when tab closes or on logout */
const BROWSER_SESSION_KEY = "pos_auth_session"

const normalizeRole = (role: unknown): string =>
  String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, "")

export const getRoleFromStoredUser = (user: unknown): UserRole => {
  if (!user || typeof user !== "object") return "GUEST"

  const u = user as Record<string, unknown>
  const roleNames: string[] = []

  if (Array.isArray(u.authorities)) {
    for (const auth of u.authorities) {
      if (typeof auth === "string") roleNames.push(normalizeRole(auth))
      else if (auth && typeof auth === "object") {
        const a = auth as Record<string, unknown>
        roleNames.push(normalizeRole(a.authority ?? a.name ?? a.role))
      }
    }
  }

  if (!roleNames.length && u.role) roleNames.push(normalizeRole(u.role))

  if (!roleNames.length && typeof u.roles === "string") {
    const matches = u.roles.match(/ROLE_[A-Z_]+/g) ?? []
    for (const m of matches) roleNames.push(normalizeRole(m))
  }

  if (!roleNames.length && Array.isArray(u.roles)) {
    for (const r of u.roles) {
      if (typeof r === "string") roleNames.push(normalizeRole(r))
      else if (r && typeof r === "object") {
        const role = r as Record<string, unknown>
        roleNames.push(normalizeRole(role.name ?? role.authority ?? role.role))
      }
    }
  }

  const filtered = roleNames.filter(Boolean)
  if (filtered.includes("ADMIN")) return "ADMIN"
  if (filtered.includes("USER")) return "USER"
  return "GUEST"
}

/** Normalize Spring login JSON when `/user/details` is unavailable. */
export const userFromLoginResponse = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== "object") return {}
  const d = data as Record<string, unknown>
  if (d.user && typeof d.user === "object") return d.user as Record<string, unknown>
  return {
    username: d.username,
    userId: d.userId,
    roles: d.roles,
    role: d.role,
  }
}

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null
  return localStorage.getItem("auth_token") ?? localStorage.getItem("token")
}

function sessionStore(): Storage {
  // Electron file:// keeps login across restarts; browser tab uses sessionStorage.
  return isElectronApp() ? localStorage : sessionStorage
}

export const hasActiveBrowserSession = (): boolean => {
  if (typeof window === "undefined") return false
  return sessionStore().getItem(BROWSER_SESSION_KEY) === "1"
}

export const markBrowserSessionActive = (): void => {
  if (typeof window === "undefined") return
  sessionStore().setItem(BROWSER_SESSION_KEY, "1")
}

export const clearBrowserSession = (): void => {
  if (typeof window === "undefined") return
  sessionStore().removeItem(BROWSER_SESSION_KEY)
}

/** Quick local check only — use with Spring Boot verify before trusting session */
export const hasValidAuthSession = (): boolean => {
  if (typeof window === "undefined") return false
  if (!hasActiveBrowserSession()) return false
  if (localStorage.getItem("isLoggedIn") !== "true") return false

  try {
    const userStr = localStorage.getItem("user")
    if (!userStr) return false
    const role = getRoleFromStoredUser(JSON.parse(userStr))
    return role === "ADMIN" || role === "USER"
  } catch {
    return false
  }
}

export const persistAuthSession = (user: unknown, token?: string | null): void => {
  markBrowserSessionActive()
  localStorage.setItem("user", JSON.stringify(user))
  localStorage.setItem("isLoggedIn", "true")
  if (token) {
    localStorage.setItem("token", token)
    localStorage.setItem("auth_token", token)
  }
}

export const clearAuthSession = (): void => {
  clearBrowserSession()
  localStorage.removeItem("isLoggedIn")
  localStorage.removeItem("user")
  localStorage.removeItem("token")
  localStorage.removeItem("auth_token")
  localStorage.removeItem("refresh_token")
}

export const sanitizeAuthSession = (): void => {
  if (!hasValidAuthSession()) clearAuthSession()
}

/** Confirm session with Spring Boot (cookie and/or Bearer token) */
export async function verifySessionWithServer(): Promise<boolean> {
  if (!hasValidAuthSession()) {
    clearAuthSession()
    return false
  }

  // In the packaged Electron app we already have a local token + user stored.
  // Server cookies are not reliable from file:// origin, and CORS may block the check.
  // Trust the existing browser session instead of forcing a remote verify on every launch.
  if (isElectronApp()) {
    return true
  }

  const token = getAuthToken()
  const headers: Record<string, string> = { Accept: "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(resolveApiUrl(USER_DETAILS_API), {
      method: "GET",
      credentials: "include",
      headers,
    })

    if (!res.ok) {
      clearAuthSession()
      return false
    }

    const user = await res.json().catch(() => null)
    const role = getRoleFromStoredUser(user)
    if (role === "GUEST") {
      clearAuthSession()
      return false
    }

    persistAuthSession(user, token)
    return true
  } catch {
    clearAuthSession()
    return false
  }
}
