import { Navigate } from "react-router-dom"
import { isSkipLoginEnabled } from "@/config/devAuth"
import { useAuth } from "@/hooks/useAuth"
import Login from "@/pages/Login"

/** Show login, or redirect away if already signed in. */
export function LoginRoute() {
  const { isLoggedIn, getUserRole } = useAuth()

  if (isSkipLoginEnabled()) {
    return <Navigate to="/pos" replace />
  }

  if (isLoggedIn() && getUserRole() !== "GUEST") {
    return <Navigate to="/pos" replace />
  }

  return <Login />
}
