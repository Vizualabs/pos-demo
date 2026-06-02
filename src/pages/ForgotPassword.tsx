import { useState, FormEvent } from "react"
import { Link } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, Send } from "lucide-react"

const FORGOT_PASSWORD_API = "/api/security/forgot-password"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ForgotPassword = () => {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) {
      setError("Please enter your email address.")
      return
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError("Please enter a valid email address.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await axios.post(
        FORGOT_PASSWORD_API,
        { email: trimmedEmail },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      )

      const message =
        response?.data?.message ||
        "Password reset link sent to your email."

      setSuccessMessage(message)
      toast.success(message)
      setEmail("")
    } catch (err) {
      let message = "Unable to send reset link. Please try again."
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const backendMessage = err.response?.data?.message

        if (backendMessage) {
          message = backendMessage
        } else if (status === 404) {
          message = "No account found with that email address."
        } else if (status === 429) {
          message = "Too many requests. Please try again later."
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

        {/* Forgot Password Card */}
        <Card className="modern-card shadow-2xl border border-slate-800/50 bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-2">
              <Mail className="w-6 h-6 text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-white">
              Forgot Password?
            </CardTitle>
            <p className="text-center text-slate-400 text-sm mt-2">
              Enter your email and we'll send you a reset link.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={(e) => setEmail(e.target.value.trim())}
                  maxLength={254}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                  className="bg-slate-800/50 border-slate-700 focus:border-green-500 focus:ring-green-500 text-white placeholder:text-slate-500"
                />
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
                  <p className="text-xs text-emerald-300">{successMessage}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 h-11 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Sending..." : "Send Reset Link"}
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

export default ForgotPassword
