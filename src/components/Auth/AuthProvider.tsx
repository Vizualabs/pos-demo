import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  clearAuthSession,
  getRoleFromStoredUser,
  hasValidAuthSession,
  sanitizeAuthSession,
  verifySessionWithServer,
} from "@/lib/authSession"
import { isElectronApp } from "@/lib/isElectron"
import type { UserRole } from "@/lib/authSession"

type AuthContextValue = {
  authReady: boolean
  isAuthenticated: boolean
  getUserRole: () => UserRole
  isAdmin: () => boolean
  isUser: () => boolean
  isLoggedIn: () => boolean
  refreshAuth: () => Promise<boolean>
  markAuthenticated: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authReady, setAuthReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const getUserRole = useCallback((): UserRole => {
    if (!isAuthenticated || typeof window === "undefined") return "GUEST"
    try {
      const userStr = localStorage.getItem("user")
      if (!userStr) return "GUEST"
      return getRoleFromStoredUser(JSON.parse(userStr))
    } catch {
      return "GUEST"
    }
  }, [isAuthenticated])

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    sanitizeAuthSession()
    if (!hasValidAuthSession()) {
      setIsAuthenticated(false)
      return false
    }
    if (isElectronApp()) {
      setIsAuthenticated(true)
      return true
    }
    const ok = await verifySessionWithServer()
    setIsAuthenticated(ok)
    return ok
  }, [])

  const markAuthenticated = useCallback(() => {
    setIsAuthenticated(hasValidAuthSession())
  }, [])

  const logout = useCallback(() => {
    clearAuthSession()
    setIsAuthenticated(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      sanitizeAuthSession()
      let ok = false
      if (hasValidAuthSession()) {
        ok = isElectronApp() ? true : await verifySessionWithServer()
      }
      if (!cancelled) {
        setIsAuthenticated(ok)
        setAuthReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      authReady,
      isAuthenticated,
      getUserRole,
      isAdmin: () => getUserRole() === "ADMIN",
      isUser: () => ["USER", "ADMIN"].includes(getUserRole()),
      isLoggedIn: () => isAuthenticated,
      refreshAuth,
      markAuthenticated,
      logout,
    }),
    [authReady, isAuthenticated, getUserRole, refreshAuth, markAuthenticated, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthContext = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
