import { useState, FormEvent, useEffect } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, LogIn } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { resolveApiUrl } from "@/lib/apiClient"
import {
  clearAuthSession,
  getRoleFromStoredUser,
  persistAuthSession,
  userFromLoginResponse,
} from "@/lib/authSession"
import { isElectronApp } from "@/lib/isElectron"
import { electronFetchAsResponse, shouldRouteApiViaElectronMain } from "@/lib/electronFetch"
import { AuthBackground } from "@/components/Auth/AuthBackground"

const LOGIN_API = "/api/security/login"
const USER_DETAILS_API = "/api/security/user/details"

const MAX_USERNAME_LEN = 50
const MAX_PASSWORD_LEN = 128

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, markAuthenticated } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const from = (location.state as { from?: unknown } | null)?.from
    // Web: force fresh sign-in when opening login directly. Electron: keep saved session.
    if (!isElectronApp() && !from && !isAuthenticated) {
      clearAuthSession()
    }
  }, [location.state, isAuthenticated])

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
      const loginUrl = resolveApiUrl(LOGIN_API)
      const loginInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include" as RequestCredentials,
        body: JSON.stringify({ username: u, password: p }),
      }
      const response = shouldRouteApiViaElectronMain()
        ? await electronFetchAsResponse(loginUrl, loginInit)
        : await fetch(loginUrl, loginInit)

      if (!response.ok) {
        const message = (await response.json().catch(() => ({})))?.message
        setError(message || "Invalid username or password.")
        return
      }

      const data = await response.json().catch(() => ({}))
      const token =
        (typeof data.token === "string" && data.token) ||
        (typeof data.access_token === "string" && data.access_token) ||
        null
      if (token) {
        localStorage.setItem("token", token)
        localStorage.setItem("auth_token", token)
      }

      const detailsHeaders: Record<string, string> = {
        Accept: "application/json",
      }
      if (token) detailsHeaders.Authorization = `Bearer ${token}`

      const detailsUrl = resolveApiUrl(USER_DETAILS_API)
      const detailsInit = {
        method: "GET",
        headers: detailsHeaders,
        credentials: "include" as RequestCredentials,
      }
      const detailsResponse = shouldRouteApiViaElectronMain()
        ? await electronFetchAsResponse(detailsUrl, detailsInit)
        : await fetch(detailsUrl, detailsInit)

      const user = detailsResponse.ok
        ? await detailsResponse.json().catch(() => userFromLoginResponse(data))
        : userFromLoginResponse(data)
      const role = getRoleFromStoredUser(user)

      if (role === "GUEST") {
        setError("Login succeeded, but no valid user role was found.")
        localStorage.removeItem("isLoggedIn")
        localStorage.removeItem("user")
        localStorage.removeItem("token")
        localStorage.removeItem("auth_token")
        return
      }

      persistAuthSession(user, token)
      markAuthenticated()

      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      const target = from || "/pos"
      if (isElectronApp()) {
        window.location.hash = `#${target}`
        return
      }
      navigate(target, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed"
      setError(`Login failed: ${msg}`)
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

        {/* Login Card */}
        <Card className="modern-card shadow-modern-lg border border-border bg-card">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-foreground">Welcome To Madara Resturant </CardTitle>
            <p className="text-center text-muted-foreground text-sm mt-2">Sign in to access your POS system</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground font-medium">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={(e) => setUsername(e.target.value.trim())}
                  maxLength={MAX_USERNAME_LEN}
                  placeholder="Enter your username"
                  autoComplete="username"
                  className="bg-background border-input focus:border-primary focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={(e) => setPassword(e.target.value.trim())}
                  maxLength={MAX_PASSWORD_LEN}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="bg-background border-input focus:border-primary focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="auth-cta-glow w-full mt-6 h-11 rounded-lg gradient-primary hover:opacity-90 text-primary-foreground font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                <LogIn className="w-4 h-4 mr-2" />
                {isSubmitting ? "Signing in..." : "Sign In"}
              </Button>

              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              <p className="text-center text-muted-foreground text-xs mt-4">
                Secure authentication • Your credentials are encrypted
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-muted-foreground/70 text-xs">
            © 2026 DineMate. All rights reserved.
          </p>
          <p className="text-muted-foreground/70 text-xs">
            Powered by{" "}
            <a
              href="https://vizualabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 hover:underline transition-colors font-medium"
            >
              vizualabs.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login