import { useEffect, useMemo, useState, FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from "lucide-react"

const RESET_PASSWORD_API = "/api/security/reset-password"

const MIN_PASSWORD_LEN = 6
const MAX_PASSWORD_LEN = 128
const REDIRECT_DELAY_MS = 2500

const ResetPassword = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams])

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.")
    }
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!token) {
      setError("Invalid or missing reset token. Please request a new reset link.")
      return
    }

    const nextPassword = newPassword.trim()
    const confirmation = confirmPassword.trim()

    if (!nextPassword || !confirmation) {
      setError("Please fill in both password fields.")
      return
    }

    if (nextPassword.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`)
      return
    }

    if (nextPassword !== confirmation) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await axios.post(
        RESET_PASSWORD_API,
        {
          token,
          newPassword: nextPassword,
          confirmPassword: confirmation,
        },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      )

      const message =
        response?.data?.message ||
        "Password reset successfully. Please login with your new password."

      setSuccessMessage(message)
      toast.success(message)
      setNewPassword("")
      setConfirmPassword("")

      setTimeout(() => {
        navigate("/login", { replace: true })
      }, REDIRECT_DELAY_MS)
    } catch (err) {
      let message = "Unable to reset password. Please try again."
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const backendMessage = err.response?.data?.message

        if (backendMessage) {
          message = backendMessage
        } else if (status === 400) {
          message = "Invalid request. Please check your password and try again."
        } else if (status === 401 || status === 403) {
          message = "Reset link is invalid or has expired. Please request a new one."
        } else if (status === 404) {
          message = "Reset link is invalid. Please request a new one."
        } else if (!err.response) {
          message =
            "Unable to reach the server. Please check your connection and try again."
        }
      }

      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormDisabled = isSubmitting || !token || Boolean(successMessage)

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

        {/* Reset Password Card */}
        <Card className="modern-card shadow-2xl border border-slate-800/50 bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-2">
              <KeyRound className="w-6 h-6 text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-white">
              Reset Password
            </CardTitle>
            <p className="text-center text-slate-400 text-sm mt-2">
              Choose a strong new password for your account.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-slate-300 font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    maxLength={MAX_PASSWORD_LEN}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    disabled={isFormDisabled}
                    className="bg-slate-800/50 border-slate-700 focus:border-green-500 focus:ring-green-500 text-white placeholder:text-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    disabled={isFormDisabled}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 disabled:opacity-50"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-slate-300 font-medium">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    maxLength={MAX_PASSWORD_LEN}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    disabled={isFormDisabled}
                    className="bg-slate-800/50 border-slate-700 focus:border-green-500 focus:ring-green-500 text-white placeholder:text-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    disabled={isFormDisabled}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 disabled:opacity-50"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-300 mb-1">
                  Password requirements
                </p>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  <li>At least {MIN_PASSWORD_LEN} characters long</li>
                  <li>Both passwords must match</li>
                </ul>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-300">
                    {successMessage} Redirecting to login...
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isFormDisabled}
                className="w-full mt-2 h-11 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </Button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-green-300 transition-colors mt-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
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
    </div>
  )
}

export default ResetPassword
