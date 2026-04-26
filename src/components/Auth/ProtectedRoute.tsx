import { ReactElement } from "react"
import { Navigate, useLocation } from "react-router-dom"

type ProtectedRouteProps = {
  children: ReactElement
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation()

  const isLoggedIn = typeof window !== "undefined" && localStorage.getItem("isLoggedIn") === "true"

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

