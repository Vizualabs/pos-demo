import { ReactElement } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth, type UserRole } from "@/hooks/useAuth"

type ProtectedRouteProps = {
  children: ReactElement
  allowedRoles?: UserRole[]
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const location = useLocation()
  const { getUserRole, isLoggedIn } = useAuth()

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const role = getUserRole()

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/pos" replace />
  }

  return children
}
