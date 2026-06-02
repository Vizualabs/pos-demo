import { Navigate } from "react-router-dom"

/** Legacy `/login` URL → home login at `/` */
export const LoginRoute = () => <Navigate to="/" replace />
