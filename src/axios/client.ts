import axios, { AxiosHeaders, AxiosInstance, AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { clearAuthSession } from "@/lib/authSession"

/** Dev: same-origin `/api` via Vite proxy. Prod: set VITE_API_BASE_URL to your API host. */
function resolveAxiosBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!raw) return "/api"
  const host = raw.replace(/\/+$/, "").replace(/\/api$/i, "")
  return `${host}/api`
}

const baseURL = resolveAxiosBaseUrl()

function redirectToLogin(): void {
  if (typeof window === "undefined") return
  const path = window.location.pathname
  if (path === "/" || path === "/login") return
  clearAuthSession()
  window.location.replace("/")
}

const axiosClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
})

const refreshClient = axios.create({ baseURL })

axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("auth_token") ?? localStorage.getItem("token")
    if (token) {
      if (config.headers instanceof AxiosHeaders) {
        config.headers.set("Authorization", `Bearer ${token}`)
      } else {
        ;(config.headers as Record<string, string>).Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error),
)

axiosClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error?.config as InternalAxiosRequestConfig | undefined
    if (error?.response?.status === 401 && originalRequest && !(originalRequest as { _retry?: boolean })._retry) {
      ;(originalRequest as { _retry?: boolean })._retry = true
      const refreshToken = localStorage.getItem("refresh_token")
      if (refreshToken) {
        try {
          const resp = await refreshClient.post("/auth/refresh", { refresh_token: refreshToken })
          const accessToken = resp?.data?.access_token || resp?.data?.token
          if (accessToken) {
            localStorage.setItem("auth_token", accessToken)
            axiosClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`
            if (originalRequest.headers instanceof AxiosHeaders) {
              originalRequest.headers.set("Authorization", `Bearer ${accessToken}`)
            }
            return axiosClient(originalRequest)
          }
        } catch {
          localStorage.removeItem("auth_token")
          localStorage.removeItem("token")
          localStorage.removeItem("refresh_token")
        }
      }
      if (error?.response?.status === 401) {
        redirectToLogin()
      }
    }
    return Promise.reject(error)
  },
)

export default axiosClient
