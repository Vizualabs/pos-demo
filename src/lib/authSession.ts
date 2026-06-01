import { isSkipLoginEnabled } from "@/config/devAuth"

export type UserRole = "ADMIN" | "USER" | "GUEST"

const normalizeRole = (role: unknown): string =>
  String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, "")

/** Parse Spring Security / legacy user objects into ADMIN | USER | GUEST. */
export function getRoleFromUser(user: unknown): UserRole {
  if (!user || typeof user !== "object") return "GUEST"

  const u = user as Record<string, unknown>
  let roleNames: string[] = []

  if (Array.isArray(u.authorities)) {
    roleNames = u.authorities
      .map((auth: unknown) => {
        if (typeof auth === "string") return normalizeRole(auth)
        if (auth && typeof auth === "object") {
          const a = auth as Record<string, unknown>
          if (a.authority) return normalizeRole(a.authority)
          if (a.name || a.role) return normalizeRole(a.name ?? a.role)
        }
        return ""
      })
      .filter(Boolean)
  }

  if (!roleNames.length && u.role) {
    const role = normalizeRole(u.role)
    if (role) roleNames = [role]
  }

  if (!roleNames.length && Array.isArray(u.roles)) {
    roleNames = u.roles
      .map((r: unknown) =>
        normalizeRole(typeof r === "string" ? r : (r as Record<string, unknown>)?.name ?? (r as Record<string, unknown>)?.authority ?? (r as Record<string, unknown>)?.role),
      )
      .filter(Boolean)
  }

  if (roleNames.includes("ADMIN")) return "ADMIN"
  if (roleNames.includes("USER")) return "USER"
  return "GUEST"
}

export function clearAuthSession(): void {
  localStorage.removeItem("isLoggedIn")
  localStorage.removeItem("user")
  localStorage.removeItem("token")
  localStorage.removeItem("auth_token")
  localStorage.removeItem("refresh_token")
}

/** True only after a real login stored user + role (not just a stale flag). */
export function hasValidAuthSession(): boolean {
  if (typeof window === "undefined") return false
  if (localStorage.getItem("isLoggedIn") !== "true") return false

  try {
    const userStr = localStorage.getItem("user")
    if (!userStr) return false
    const role = getRoleFromUser(JSON.parse(userStr))
    return role === "ADMIN" || role === "USER"
  } catch {
    return false
  }
}

/** Drop orphan flags, fake dev user, or sessions without a valid role. */
export function sanitizeAuthSession(): void {
  if (isSkipLoginEnabled()) return

  try {
    const userRaw = localStorage.getItem("user")
    if (userRaw) {
      const user = JSON.parse(userRaw) as { username?: string; fullName?: string }
      if (user.username === "dev" && user.fullName === "Dev Tester") {
        clearAuthSession()
        return
      }
    }
  } catch {
    clearAuthSession()
    return
  }

  if (!hasValidAuthSession()) {
    clearAuthSession()
  }
}
