import { ReactElement } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import type { UserRole } from "@/lib/authSession"
import { AuthGate } from "@/components/Auth/AuthGate"

type ProtectedRouteProps = {
  children: ReactElement
  allowedRoles?: UserRole[]
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation()
  const { authReady, isAuthenticated, getUserRole } = useAuth()

  if (!authReady) {
    return <AuthGate>{null}</AuthGate>
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  const role = getUserRole()

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/pos" replace />
  }

  return children
}
