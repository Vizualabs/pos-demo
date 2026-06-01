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
