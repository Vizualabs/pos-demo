import { apiFetch } from "@/lib/apiClient"

export type VerifyAdminPasswordResponse = {
  authenticated: boolean
  message: string
}

type LoginResponse = {
  message?: string
  username?: string
  roles?: string
}

/** Verify admin password via the existing login endpoint (username fixed to admin account). */
export async function verifyAdminPassword(password: string): Promise<VerifyAdminPasswordResponse> {
  const p = password.trim()

  if (!p) {
    return { authenticated: false, message: "Password is required" }
  }

  try {
    const data = await apiFetch<LoginResponse>("/api/security/login", {
      method: "POST",
      body: { username: "admin", password: p },
    })

    const roles = String(data.roles ?? "")
    const isAdmin = roles.includes("ADMIN")

    if (!isAdmin) {
      return { authenticated: false, message: "Admin access required to delete orders" }
    }

    return { authenticated: true, message: data.message ?? "Authenticated" }
  } catch (err) {
    return {
      authenticated: false,
      message: err instanceof Error ? err.message : "Invalid admin password",
    }
  }
}
