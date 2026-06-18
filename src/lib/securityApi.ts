export type VerifyAdminPasswordResponse = {
  authenticated: boolean
  message: string
}

const VERIFY_ADMIN_PASSWORD_API = "/api/security/verify-admin-password"

export async function verifyAdminPassword(password: string): Promise<VerifyAdminPasswordResponse> {
  const response = await fetch(VERIFY_ADMIN_PASSWORD_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password }),
  })

  if (!response.ok) {
    throw new Error("Unable to verify admin credentials. Please try again.")
  }

  return response.json() as Promise<VerifyAdminPasswordResponse>
}
