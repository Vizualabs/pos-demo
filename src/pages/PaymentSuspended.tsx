import { useMemo } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { AuthBackground } from "@/components/Auth/AuthBackground"
import { AlertCircle } from "lucide-react"

export default function PaymentSuspended() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const state = (location.state as { message?: string; deadline?: string } | null) ?? null

  const message = useMemo(
    () => state?.message || searchParams.get("message") || null,
    [state?.message, searchParams],
  )
  const deadline = useMemo(
    () => state?.deadline || searchParams.get("deadline") || null,
    [state?.deadline, searchParams],
  )

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-secondary/40 to-background px-4">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-modern-lg">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Service temporarily suspended</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {message ||
            "Access is locked because payment is overdue. Please contact support to restore the system."}
        </p>
        {deadline && (
          <p className="mt-2 text-sm text-muted-foreground">
            Deadline: {new Date(deadline).toLocaleString()}
          </p>
        )}
        <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium text-foreground">Contact support</p>
          <p className="mt-1 text-muted-foreground">
            Powered by{" "}
            <a
              href="https://vizualabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              vizualabs.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
