/** True when running inside the packaged Electron POS desktop app. */
export function isElectronApp(): boolean {
  if (typeof window === "undefined") return false
  if (window.electronAPI?.isElectron) return true
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("Electron")) return true
  const proto = window.location.protocol
  return proto === "file:" || proto === "app:"
}
