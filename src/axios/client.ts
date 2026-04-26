import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

const axiosClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
})

const refreshClient = axios.create({ baseURL })

axiosClient.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token')
    if (token && config.headers) {
      (config.headers as any).Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

axiosClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error?.config
    if (error?.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
      ;(originalRequest as any)._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const resp = await refreshClient.post('/auth/refresh', { refresh_token: refreshToken })
          const accessToken = resp?.data?.access_token || resp?.data?.token
          if (accessToken) {
            localStorage.setItem('auth_token', accessToken)
            axiosClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
            }
            return axiosClient(originalRequest)
          }
        } catch (e) {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('refresh_token')
        }
      }
    }
    return Promise.reject(error)
  }
)

export default axiosClient
