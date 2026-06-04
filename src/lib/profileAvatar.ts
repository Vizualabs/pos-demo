import { resolveApiUrl } from "@/lib/apiClient"
import { getAuthToken } from "@/lib/authSession"

export const PROFILE_AVATAR_STORAGE_KEY = "posProfileAvatar"
export const PROFILE_AVATAR_CHANGED = "profile-avatar-changed"

const DEFAULT_AVATAR = "/Admin.png"
const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function normalizeProfileImageUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return DEFAULT_AVATAR
  if (trimmed.startsWith("data:") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  if (trimmed.startsWith("/api/")) return resolveApiUrl(trimmed)
  if (trimmed.startsWith("/files/")) return resolveApiUrl(`/api${trimmed}`)
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

export function extractProfileImageFromUser(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const u = data as Record<string, unknown>
  const keys = [
    "profileImageUrl",
    "profilePictureUrl",
    "profilePicture",
    "avatarUrl",
    "avatar",
    "imageUrl",
    "photoUrl",
    "pictureUrl",
  ]
  for (const key of keys) {
    const value = u[key]
    if (typeof value === "string" && value.trim()) {
      return normalizeProfileImageUrl(value)
    }
  }
  return null
}

export function getStoredProfileAvatar(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PROFILE_AVATAR_STORAGE_KEY)
    return raw?.trim() ? normalizeProfileImageUrl(raw) : null
  } catch {
    return null
  }
}

export function setStoredProfileAvatar(url: string): void {
  localStorage.setItem(PROFILE_AVATAR_STORAGE_KEY, url)
  window.dispatchEvent(new Event(PROFILE_AVATAR_CHANGED))
}

export function resolveProfileAvatarUrl(userData?: unknown): string {
  const fromUser = userData ? extractProfileImageFromUser(userData) : null
  if (fromUser) return fromUser
  return getStoredProfileAvatar() ?? DEFAULT_AVATAR
}

export function validateProfileImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Please choose a JPG, PNG, or WebP image."
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 2MB or smaller."
  }
  return null
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Failed to read image file"))
    reader.readAsDataURL(file)
  })
}

function parseUploadResponse(data: unknown): string | null {
  if (!data) return null
  if (typeof data === "string" && data.trim()) return normalizeProfileImageUrl(data)
  if (typeof data !== "object") return null
  const direct = extractProfileImageFromUser(data)
  if (direct) return direct
  const rec = data as Record<string, unknown>
  if (rec.data) return parseUploadResponse(rec.data)
  if (rec.user) return parseUploadResponse(rec.user)
  return null
}

const UPLOAD_ATTEMPTS: { path: string; field: string }[] = [
  { path: "/api/security/user/profile-picture", field: "image" },
  { path: "/api/security/user/profile-picture", field: "file" },
  { path: "/api/security/user/image", field: "image" },
  { path: "/api/security/user/avatar", field: "image" },
]

/** Upload to Spring Boot if available; otherwise save locally for this browser */
export async function uploadProfileAvatar(file: File): Promise<{ url: string; savedOnServer: boolean }> {
  const validationError = validateProfileImageFile(file)
  if (validationError) throw new Error(validationError)

  const token = getAuthToken()
  const authHeaders: Record<string, string> = {}
  if (token) authHeaders.Authorization = `Bearer ${token}`

  for (const { path, field } of UPLOAD_ATTEMPTS) {
    const form = new FormData()
    form.append(field, file)
    try {
      const res = await fetch(resolveApiUrl(path), {
        method: "POST",
        credentials: "include",
        headers: authHeaders,
        body: form,
      })
      if (!res.ok) continue
      const data = await res.json().catch(() => null)
      const url = parseUploadResponse(data)
      if (url) {
        if (!url.startsWith("data:")) setStoredProfileAvatar(url)
        return { url, savedOnServer: true }
      }
    } catch {
      continue
    }
  }

  const dataUrl = await readFileAsDataUrl(file)
  setStoredProfileAvatar(dataUrl)
  return { url: dataUrl, savedOnServer: false }
}
