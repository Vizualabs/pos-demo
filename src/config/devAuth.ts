/** Dev-only: bypass login when VITE_SKIP_LOGIN=true (see .env.development). */
export function isSkipLoginEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_SKIP_LOGIN === "true"
}

export function ensureDevAuthSession(): void {
  if (!isSkipLoginEnabled()) return
  if (localStorage.getItem("isLoggedIn") === "true") return
  localStorage.setItem("isLoggedIn", "true")
  localStorage.setItem(
    "user",
    JSON.stringify({
      username: "dev",
      fullName: "Dev Tester",
      role: "ADMIN",
    }),
  )
}

/** Remove fake dev session left from VITE_SKIP_LOGIN=true so real login is required. */
export function clearStaleDevAuthSession(): void {
  if (isSkipLoginEnabled()) return
  try {
    const userRaw = localStorage.getItem("user")
    if (!userRaw) {
      localStorage.removeItem("isLoggedIn")
      return
    }
    const user = JSON.parse(userRaw) as { username?: string; fullName?: string }
    if (user.username === "dev" && user.fullName === "Dev Tester") {
      localStorage.removeItem("isLoggedIn")
      localStorage.removeItem("user")
      localStorage.removeItem("token")
      localStorage.removeItem("auth_token")
    }
  } catch {
    localStorage.removeItem("isLoggedIn")
    localStorage.removeItem("user")
  }
}
