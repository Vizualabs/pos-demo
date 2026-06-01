import { Navigate } from "react-router-dom"
import { isSkipLoginEnabled } from "@/config/devAuth"
import { useAuth } from "@/hooks/useAuth"

/** Send visitors to login when not authenticated; otherwise default app entry. */
export function RootRedirect() {
  const { isLoggedIn } = useAuth()

  if (isSkipLoginEnabled()) {
    return <Navigate to="/pos" replace />
  }

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to="/pos" replace />
}
