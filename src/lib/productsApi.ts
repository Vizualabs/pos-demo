import { apiFetch } from "@/lib/apiClient"
import { nowIso } from "@/lib/demoPersistence"
import type { Kitchen } from "@/lib/ordersApi"

export type PortionSize = "MEDIUM" | "LARGE"
export type PortionPrices = Partial<Record<PortionSize, number>>

export type ProductRecipeLineResponseDto = {
  itemId: number
  itemName?: string
  quantity: number
}

export type ProductRecipeLineRequestDto = {
  itemId: number
  quantity: number
}

export type ProductResponseDto = {
  productId: number
  categoryId: number
  /** Which kitchen station prepares this item */
  kitchen: Kitchen
  name: string
  /** Optional Sinhala name for kitchen (KOT) slips */
  nameSinhala: string | null
  description: string
  costPrice: number
  sellingPrice: number
  imageUrl: string | null
  isAvailable: boolean

  hasPortionPricing: boolean
  portionPrices: PortionPrices
  recipe: ProductRecipeLineResponseDto[]
  effectiveSellingPrice: number | null
  /** Drinks/showcase: on customer bill, not on printed kitchen tickets */
  skipKitchenTicket: boolean

  createdAt: string
  updatedAt: string | null
}

export type ProductRequestDto = {
  categoryId: number
  kitchen: Kitchen
  name: string
  nameSinhala?: string | null
  description: string
  costPrice: number
  sellingPrice: number
  imageUrl: string | null
  isAvailable: boolean

  hasPortionPricing: boolean
  portionPrices: PortionPrices
  recipe: ProductRecipeLineRequestDto[]
  /** Omit from KOT print (still billed on receipt) */
  skipKitchenTicket?: boolean
  /** Set on create only; must be unique. If omitted, next free id is used. */
  productId?: number
}

export type ProductPatchDto = Partial<ProductRequestDto>

function normalizeImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  if (s.startsWith("http://") || s.startsWith("https://")) return s
  if (s.startsWith("/")) return s
  return `/${s}`
}

function normalizePortionPrices(raw: unknown): PortionPrices {
  if (!raw || typeof raw !== "object") return {}
  const o = raw as Record<string, unknown>
  const out: PortionPrices = {}
  for (const k of ["MEDIUM", "LARGE"] as const) {
    const v = o[k]
    const n = typeof v === "number" ? v : Number(v)
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}

function normalizeRecipe(raw: unknown): ProductRecipeLineResponseDto[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      const r = x as Record<string, unknown>
      return {
        itemId: Number(r.itemId ?? r.id),
        itemName: r.itemName != null ? String(r.itemName) : undefined,
        quantity: Number(r.quantity ?? 0),
      } satisfies ProductRecipeLineResponseDto
    })
    .filter((r) => Number.isFinite(r.itemId) && r.itemId >= 1 && Number.isFinite(r.quantity))
}

function normalizeProduct(raw: unknown): ProductResponseDto {
  const p = (raw ?? {}) as Record<string, unknown>
  const portionPrices = normalizePortionPrices(p.portionPrices)
  const hasPortionPricing = Boolean(p.hasPortionPricing)
  const sellingPrice = Number(p.sellingPrice ?? 0)
  const effectiveSellingPrice =
    typeof p.effectiveSellingPrice === "number"
      ? p.effectiveSellingPrice
      : hasPortionPricing && portionPrices.MEDIUM != null
        ? portionPrices.MEDIUM
        : Number.isFinite(sellingPrice)
          ? sellingPrice
          : null

  const kitchen = (p.kitchen === "KITCHEN_2" ? "KITCHEN_2" : "KITCHEN_1") as Kitchen
  const rawSi = p.nameSinhala != null ? String(p.nameSinhala).trim() : ""
  const nameSinhala = rawSi.length > 0 ? rawSi : null

  const imageUrlRaw =
    p.imageUrl ??
    p.image_url ??
    p.imageURL ??
    p.image ??
    p.imagePath ??
    p.image_path ??
    p.fileUrl ??
    p.file_url ??
    p.filePath ??
    p.file_path

  return {
    productId: Number(p.productId ?? p.id),
    categoryId: Number(p.categoryId),
    kitchen,
    name: String(p.name ?? ""),
    nameSinhala,
    description: String(p.description ?? ""),
    costPrice: Number(p.costPrice ?? 0),
    sellingPrice,
    imageUrl: normalizeImageUrl(imageUrlRaw),
    isAvailable: p.isAvailable !== false,
    hasPortionPricing,
    portionPrices,
    recipe: normalizeRecipe(p.recipe),
    effectiveSellingPrice: Number.isFinite(effectiveSellingPrice as number) ? (effectiveSellingPrice as number) : null,
    skipKitchenTicket: p.skipKitchenTicket === true,
    createdAt: String(p.createdAt ?? "") || nowIso(),
    updatedAt: (p.updatedAt as string | null) ?? null,
  }
}

function toBackendProductRequest(payload: ProductRequestDto): Record<string, unknown> {
  const base: Record<string, unknown> = {
    categoryId: payload.categoryId,
    name: payload.name,
    description: payload.description,
    costPrice: payload.costPrice,
    sellingPrice: payload.sellingPrice,
    imageUrl: payload.imageUrl,
    isAvailable: payload.isAvailable,
    hasPortionPricing: payload.hasPortionPricing,
    portionPrices: payload.portionPrices,
    recipe: payload.recipe,
  }
  if (payload.productId != null) base.productId = payload.productId
  return base
}

function toBackendProductPatch(patch: ProductPatchDto): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (patch.categoryId != null) out.categoryId = patch.categoryId
  if (patch.name != null) out.name = patch.name
  if (patch.description != null) out.description = patch.description
  if (patch.costPrice != null) out.costPrice = patch.costPrice
  if (patch.sellingPrice != null) out.sellingPrice = patch.sellingPrice
  if (patch.imageUrl !== undefined) out.imageUrl = patch.imageUrl
  if (patch.isAvailable != null) out.isAvailable = patch.isAvailable
  if (patch.hasPortionPricing != null) out.hasPortionPricing = patch.hasPortionPricing
  if (patch.portionPrices != null) out.portionPrices = patch.portionPrices
  if (patch.recipe != null) out.recipe = patch.recipe
  if (patch.productId != null) out.productId = patch.productId
  return out
}

export async function getAllProducts(): Promise<ProductResponseDto[]> {
  const raw = await apiFetch<unknown[]>("/api/products", { method: "GET" })
  return Array.isArray(raw) ? raw.map(normalizeProduct) : []
}

export async function getProductById(productId: number): Promise<ProductResponseDto> {
  const raw = await apiFetch<unknown>(`/api/products/${productId}`, { method: "GET" })
  return normalizeProduct(raw)
}

export async function createProduct(payload: ProductRequestDto): Promise<ProductResponseDto> {
  const raw = await apiFetch<unknown>("/api/products", {
    method: "POST",
    body: toBackendProductRequest(payload),
  })
  const created = normalizeProduct(raw)
  // Preserve local-only UI hints (until backend supports them).
  return {
    ...created,
    kitchen: payload.kitchen,
    nameSinhala: payload.nameSinhala != null && String(payload.nameSinhala).trim().length > 0 ? String(payload.nameSinhala).trim() : null,
    skipKitchenTicket: !!payload.skipKitchenTicket,
  }
}

export async function updateProduct(productId: number, payload: ProductRequestDto): Promise<ProductResponseDto> {
  const raw = await apiFetch<unknown>(
    `/api/products/${productId}`,
    {
      method: "PUT",
      // Many backends expect the ID both in the URL and the body for PUT.
      body: toBackendProductRequest({ ...payload, productId }),
    },
  )
  const updated = normalizeProduct(raw)
  return {
    ...updated,
    kitchen: payload.kitchen,
    nameSinhala: payload.nameSinhala != null && String(payload.nameSinhala).trim().length > 0 ? String(payload.nameSinhala).trim() : null,
    skipKitchenTicket: !!payload.skipKitchenTicket,
  }
}

export async function patchProduct(productId: number, patch: ProductPatchDto): Promise<ProductResponseDto> {
  const raw = await apiFetch<unknown>(`/api/products/${productId}`, {
    method: "PATCH",
    body: toBackendProductPatch(patch),
  })
  const updated = normalizeProduct(raw)
  return {
    ...updated,
    kitchen: patch.kitchen ?? updated.kitchen,
    nameSinhala:
      patch.nameSinhala !== undefined
        ? patch.nameSinhala != null && String(patch.nameSinhala).trim().length > 0
          ? String(patch.nameSinhala).trim()
          : null
        : updated.nameSinhala,
    skipKitchenTicket: patch.skipKitchenTicket ?? updated.skipKitchenTicket,
  }
}

export async function deleteProduct(productId: number): Promise<void> {
  await apiFetch<void>(`/api/products/${productId}`, { method: "DELETE" })
}

export async function uploadProductImage(productId: number, file: File): Promise<ProductResponseDto> {
  const form = new FormData()
  form.append("image", file)
  const raw = await apiFetch<unknown>(`/api/products/${productId}/image`, {
    method: "POST",
    body: form,
    headers: {},
  })
  return normalizeProduct(raw)
}
