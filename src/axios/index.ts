import axiosClient from './client'

export function setAuthToken(token?: string | null) {
  if (token) {
    localStorage.setItem('auth_token', token)
    axiosClient.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    localStorage.removeItem('auth_token')
    delete axiosClient.defaults.headers.common['Authorization']
  }
}

export function clearAuthToken() {
  setAuthToken(null)
}

export default axiosClient
