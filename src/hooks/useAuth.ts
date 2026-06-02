import { useAuthContext } from "@/components/Auth/AuthProvider"

export type { UserRole } from "@/lib/authSession"

export const useAuth = () => useAuthContext()
