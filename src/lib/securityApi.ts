import { apiFetch } from "@/lib/apiClient"

export type VerifyAdminPasswordResponse = {
  authenticated: boolean
  message: string
}

/** Verify admin password without creating a new login session. */
export async function verifyAdminPassword(password: string): Promise<VerifyAdminPasswordResponse> {
  const p = password.trim()

  if (!p) {
    return { authenticated: false, message: "Password is required" }
  }

  try {
    return await apiFetch<VerifyAdminPasswordResponse>("/api/security/verify-admin-password", {
      method: "POST",
      body: { password: p },
    })
  } catch (err) {
    return {
      authenticated: false,
      message: err instanceof Error ? err.message : "Invalid admin password",
    }
  }
}
