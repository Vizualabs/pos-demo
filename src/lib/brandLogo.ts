/** Restaurant logo for receipts and PDFs — place file in `public/` */

export const BRAND_LOGO_PATHS = ["/madara-logo.jpg", "/madara-restaurant-logo.png", "/Admin.png"] as const

export type BrandLogoAsset = {
  dataUrl: string
  format: "JPEG" | "PNG"
}

let cachedLogo: BrandLogoAsset | null | undefined

async function loadBrandLogo(): Promise<BrandLogoAsset | null> {
  for (const path of BRAND_LOGO_PATHS) {
    try {
      const response = await fetch(path)
      if (!response.ok) continue
      const blob = await response.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Failed to read logo"))
        reader.readAsDataURL(blob)
      })
      const format = path.endsWith(".png") ? "PNG" : "JPEG"
      return { dataUrl, format }
    } catch {
      continue
    }
  }
  return null
}

/** Cached base64 logo for print HTML (iframe / thermal). */
export async function getBrandLogoForEmbed(): Promise<BrandLogoAsset | null> {
  if (cachedLogo === undefined) {
    cachedLogo = await loadBrandLogo()
  }
  return cachedLogo
}

/** First path for on-screen preview (`<img src="...">`). */
export function getBrandLogoPreviewPath(): string {
  return BRAND_LOGO_PATHS[0]
}

export function clearBrandLogoCache(): void {
  cachedLogo = undefined
}
