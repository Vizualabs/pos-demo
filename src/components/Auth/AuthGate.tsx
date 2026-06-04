import type { ReactNode } from "react"
import { useAuth } from "@/hooks/useAuth"

/** Blocks route render until Spring Boot session check finishes */
export const AuthGate = ({ children }: { children: ReactNode }) => {
  const { authReady } = useAuth()

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}
