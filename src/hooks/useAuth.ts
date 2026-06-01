import { getRoleFromUser, hasValidAuthSession, type UserRole } from "@/lib/authSession"

export type { UserRole }

export const useAuth = () => {
  const getUserRole = (): UserRole => {
    if (typeof window === "undefined") return "GUEST"

    try {
      const userStr = localStorage.getItem("user")
      if (!userStr) return "GUEST"
      return getRoleFromUser(JSON.parse(userStr))
    } catch (error) {
      console.error("Error parsing user role:", error)
      return "GUEST"
    }
  }

  const isAdmin = (): boolean => getUserRole() === "ADMIN"

  const isUser = (): boolean => ["USER", "ADMIN"].includes(getUserRole())

  /** Requires login flag + stored user with ADMIN or USER role. */
  const isLoggedIn = (): boolean => hasValidAuthSession()

  return {
    getUserRole,
    isAdmin,
    isUser,
    isLoggedIn,
  }
}
