import { useState, FormEvent } from "react"
import { Link } from "react-router-dom"
import axios, { isAxiosError } from "axios"
import axiosClient from "@/axios/client"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, Send } from "lucide-react"
import { AuthBackground } from "@/components/Auth/AuthBackground"

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
      if (isAxiosError(err)) {
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/40 to-background px-4 relative overflow-hidden">
      <AuthBackground />

      <div className="w-full max-w-md relative z-10 auth-card-in">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <h1 className="auth-gradient-text text-4xl font-bold mb-2">
            DineMate
          </h1>
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
            <span className="auth-dot-pulse inline-block w-2 h-2 rounded-full bg-primary"></span>
            Restaurant Management System
          </p>
        </div>

        {/* Forgot Password Card */}
        <Card className="modern-card shadow-modern-lg border border-border bg-card">
          <CardHeader className="space-y-1 pb-6">
            <div className="auth-icon-pulse mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-2">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-center text-foreground">
              Forgot Password?
            </CardTitle>
            <p className="text-center text-muted-foreground text-sm mt-2">
              Enter your email and we'll send you a reset link.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">
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
                  className="bg-background border-input focus:border-primary focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-success">{successMessage}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="auth-cta-glow w-full mt-2 h-11 rounded-lg gradient-primary hover:opacity-90 text-primary-foreground font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </Button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mt-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground/70 text-xs">
            © 2026 DineMate. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
