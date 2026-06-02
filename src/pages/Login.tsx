import { useState, FormEvent } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, LogIn } from "lucide-react"
import type { UserRole } from "@/hooks/useAuth"

const LOGIN_API = "/api/security/login"
const USER_DETAILS_API = "/api/security/user/details"

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

              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-green-400 hover:text-green-300 hover:underline transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

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
    </div>
  )
}

export default Login
