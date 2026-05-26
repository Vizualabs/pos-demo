import { useState, FormEvent } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircle, LogIn } from "lucide-react"
import type { UserRole } from "@/hooks/useAuth"

const LOGIN_API = "http://localhost:8080/api/security/login"
const USER_DETAILS_API = "http://localhost:8080/api/security/user/details"
const RESET_PASSWORD_API = "http://localhost:8080/api/security/reset-password"

const MAX_USERNAME_LEN = 50
const MAX_PASSWORD_LEN = 128

const getRoleFromUser = (user: any): UserRole => {
  const normalizeRole = (role: unknown) =>
    String(role ?? "")
      .trim()
      .toUpperCase()
      .replace(/^ROLE_/, "")

  const roles = [
    normalizeRole(user?.role),
    ...(Array.isArray(user?.authorities)
      ? user.authorities.map((auth: any) => normalizeRole(typeof auth === "string" ? auth : auth?.authority || auth?.name || auth?.role))
      : []),
    ...(Array.isArray(user?.roles)
      ? user.roles.map((role: any) => normalizeRole(typeof role === "string" ? role : role?.name || role?.authority || role?.role))
      : []),
  ].filter(Boolean)

  if (roles.includes("ADMIN")) return "ADMIN"
  if (roles.includes("USER")) return "USER"
  return "GUEST"
}

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetUsername, setResetUsername] = useState("")
  const [resetNewPassword, setResetNewPassword] = useState("")
  const [resetConfirmPassword, setResetConfirmPassword] = useState("")
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)
  const [resetSubmitting, setResetSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const u = username.trim()
    const p = password.trim()
    if (!u || !p) {
      setError("Please enter username and password.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(LOGIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u, password: p }),
      })

      if (!response.ok) {
        const message = (await response.json().catch(() => ({})))?.message
        setError(message || "Invalid username or password.")
        return
      }

      const data = await response.json().catch(() => ({}))
      if (data.token) {
        localStorage.setItem("token", data.token)
        localStorage.setItem("auth_token", data.token)
      }

      const detailsResponse = await fetch(USER_DETAILS_API, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      })

      const user = detailsResponse.ok ? await detailsResponse.json().catch(() => data.user || data) : data.user || data
      const role = getRoleFromUser(user)

      if (role === "GUEST") {
        setError("Login succeeded, but no valid user role was found.")
        localStorage.removeItem("isLoggedIn")
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        localStorage.removeItem("auth_token")
        return
      }

      localStorage.setItem("user", JSON.stringify(user))
      localStorage.setItem("isLoggedIn", "true")

      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from || "/pos", { replace: true })
    } catch {
      setError("Login failed. Please check credentials and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    setResetError(null)
    setResetSuccess(null)

    const resetUser = resetUsername.trim()
    const nextPassword = resetNewPassword.trim()
    const confirmPassword = resetConfirmPassword.trim()

    if (!resetUser || !nextPassword || !confirmPassword) {
      setResetError("Please fill in all fields.")
      return
    }

    if (nextPassword !== confirmPassword) {
      setResetError("New passwords do not match.")
      return
    }

    if (nextPassword.length < 6) {
      setResetError("New password must be at least 6 characters.")
      return
    }

    setResetSubmitting(true)
    try {
      const response = await fetch(RESET_PASSWORD_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: resetUser,
          newPassword: nextPassword,
          confirmPassword,
        }),
      })

      if (!response.ok) {
        if (response.status === 404 || response.status === 405 || response.status === 501) {
          setResetSuccess("Reset request captured. Backend reset endpoint is not available yet.")
          return
        }

        const message = (await response.json().catch(() => ({})))?.message
        throw new Error(message || "Failed to reset password.")
      }

      const message = (await response.json().catch(() => ({})))?.message
      setResetSuccess(message || "Password reset request submitted successfully.")
      setResetUsername("")
      setResetNewPassword("")
      setResetConfirmPassword("")
    } catch (err) {
      if (err instanceof TypeError) {
        setResetSuccess("Reset request captured. Connect the backend reset endpoint to complete this flow.")
        return
      }

      setResetError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setResetSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
            DineMate
          </h1>
          <p className="text-slate-400 text-sm">Restaurant Management System</p>
        </div>

        {/* Login Card */}
        <Card className="modern-card shadow-2xl border border-slate-800/50 bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-white">Welcome To Madara Resturant </CardTitle>
            <p className="text-center text-slate-400 text-sm mt-2">Sign in to access your POS system</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300 font-medium">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={(e) => setUsername(e.target.value.trim())}
                  maxLength={MAX_USERNAME_LEN}
                  placeholder="Enter your username"
                  autoComplete="username"
                  className="bg-slate-800/50 border-slate-700 focus:border-green-500 focus:ring-green-500 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={(e) => setPassword(e.target.value.trim())}
                  maxLength={MAX_PASSWORD_LEN}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="bg-slate-800/50 border-slate-700 focus:border-green-500 focus:ring-green-500 text-white placeholder:text-slate-500"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full mt-6 h-11 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                <LogIn className="w-4 h-4 mr-2" />
                {isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowResetDialog(true)
                  setResetError(null)
                  setResetSuccess(null)
                }}
                className="w-full h-9 text-xs text-green-300 hover:text-green-200 hover:bg-slate-800/60"
              >
                Reset Password
              </Button>

              <p className="text-center text-slate-500 text-xs mt-4">
                Secure authentication • Your credentials are encrypted
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-slate-600 text-xs">
            © 2026 DineMate. All rights reserved.
          </p>
        </div>
      </div>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent className="max-w-sm rounded-3xl border border-slate-800/50 bg-slate-900 p-0 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600" />
          <div className="p-7">
            <AlertDialogHeader className="text-center items-center gap-1 mb-4">
              <AlertDialogTitle className="text-2xl font-bold text-white">Reset Password</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400 text-sm">
                Enter your username and set a new password.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 mt-5">
              <div>
                <Label htmlFor="reset-username" className="text-slate-300">Username</Label>
                <Input
                  id="reset-username"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  onBlur={(e) => setResetUsername(e.target.value.trim())}
                  maxLength={MAX_USERNAME_LEN}
                  placeholder="Enter your username"
                  className="mt-2 bg-slate-800/50 border-slate-700 focus:border-green-500 focus:ring-green-500 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label htmlFor="reset-new-password" className="text-slate-300">New Password</Label>
                <Input
                  id="reset-new-password"
                  type="password"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  maxLength={MAX_PASSWORD_LEN}
                  placeholder="Enter new password"
                  className="mt-2 bg-slate-800/50 border-slate-700 focus:border-green-500 focus:ring-green-500 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label htmlFor="reset-confirm-password" className="text-slate-300">Confirm Password</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  maxLength={MAX_PASSWORD_LEN}
                  placeholder="Confirm new password"
                  className="mt-2 bg-slate-800/50 border-slate-700 focus:border-green-500 focus:ring-green-500 text-white placeholder:text-slate-500"
                />
              </div>

              {resetError ? (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {resetError}
                </p>
              ) : null}
              {resetSuccess ? (
                <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  {resetSuccess}
                </p>
              ) : null}
            </div>

            <AlertDialogFooter className="flex-col gap-3 mt-6 sm:flex-col">
              <Button
                type="button"
                onClick={handleResetPassword}
                disabled={resetSubmitting}
                className="w-full h-11 rounded-xl disabled:opacity-50"
              >
                {resetSubmitting ? "Submitting..." : "Update Password"}
              </Button>
              <AlertDialogCancel
                onClick={() => {
                  setResetError(null)
                  setResetSuccess(null)
                }}
                className="w-full h-11 rounded-xl bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700"
              >
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Login

