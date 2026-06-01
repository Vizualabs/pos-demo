import { Navigate } from "react-router-dom"

/** Legacy `/login` URL → app entry at `/`. */
export function LoginRoute() {
  return <Navigate to="/" replace />
}
