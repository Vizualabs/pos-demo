import { Navigate } from "react-router-dom"
import Login from "@/pages/Login"
import { useAuth } from "@/hooks/useAuth"
import { AuthGate } from "@/components/Auth/AuthGate"

/** `/` is the login page; stale storage cannot skip sign-in */
export const RootRoute = () => {
  const { authReady, isAuthenticated } = useAuth()

  if (!authReady) {
    return <AuthGate>{null}</AuthGate>
  }

  if (isAuthenticated) {
    return <Navigate to="/pos" replace />
  }

  return <Login />
}
