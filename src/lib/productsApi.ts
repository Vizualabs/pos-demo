import axiosClient from "@/axios"
import axios from "axios"
import { nowIso } from "@/lib/demoPersistence"
import { getApiErrorMessage } from "@/lib/apiErrors"
import {
  getProductLocalMeta,
  removeProductLocalMeta,
  setProductLocalMeta,
} from "@/lib/productLocalMeta"
import type { Kitchen } from "@/lib/ordersApi"

export type PortionSize = "SMALL" | "MEDIUM" | "LARGE"
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
  /** Required on create — backend no longer auto-generates IDs. Must be unique and > 0. Omit on patch. */
  productId?: number
}

export type ProductPatchDto = Partial<ProductRequestDto>

function toBackendRecipeLines(lines: ProductRecipeLineRequestDto[]): Record<string, unknown>[] {
  return (lines ?? []).map((l) => ({
    // Different backends use different names for the inventory reference.
    itemId: l.itemId,
    inventoryItemId: l.itemId,
    quantity: l.quantity,
    qty: l.quantity,
  }))
}

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
  for (const k of ["SMALL", "MEDIUM", "LARGE"] as const) {
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

      const itemIdRaw =
        r.itemId ??
        r.inventoryItemId ??
        r["inventory_item_id"] ??
        r.inventoryId ??
        r["inventory_id"] ??
        // Some APIs include a per-row id; keep this as last fallback.
        r.id

      const quantityRaw =
        r.quantity ??
        r["qty"] ??
        r["amount"] ??
        r["qtyKg"] ??
        r["quantityKg"] ??
        r["quantity_kg"] ??
        0

      return {
        itemId: Number(itemIdRaw),
        itemName: r.itemName != null ? String(r.itemName) : undefined,
        quantity: Number(quantityRaw),
      } satisfies ProductRecipeLineResponseDto
    })
    .filter((r) => Number.isFinite(r.itemId) && r.itemId >= 1 && Number.isFinite(r.quantity) && r.quantity > 0)
}

const KITCHEN_API_KEYS = [
  "kitchen",
  "kitchenType",
  "kitchen_type",
  "kitchenStation",
  "kitchen_station",
  "preparationKitchen",
  "preparation_kitchen",
  "station",
  "kitchenId",
] as const

const SKIP_KOT_API_KEYS = [
  "skipKitchenTicket",
  "skip_kitchen_ticket",
  "billOnly",
  "showcaseOnly",
  "showcase",
] as const

function hasApiKitchenField(p: Record<string, unknown>): boolean {
  return KITCHEN_API_KEYS.some((k) => p[k] != null && String(p[k]).trim() !== "")
}

function hasApiSkipKitchenField(p: Record<string, unknown>): boolean {
  return SKIP_KOT_API_KEYS.some((k) => p[k] != null && String(p[k]).trim() !== "")
}

function toBackendKitchenFields(kitchen: Kitchen): Record<string, unknown> {
  const isK2 = kitchen === "KITCHEN_2"
  return {
    kitchen,
    kitchenType: kitchen,
    kitchen_type: kitchen,
    kitchenStation: kitchen,
    kitchen_station: kitchen,
    preparationKitchen: kitchen,
    preparation_kitchen: kitchen,
    station: isK2 ? 2 : 1,
    kitchenId: isK2 ? 2 : 1,
  }
}

function toBackendSkipKitchenFields(skipKitchenTicket: boolean): Record<string, unknown> {
  return {
    skipKitchenTicket,
    skip_kitchen_ticket: skipKitchenTicket,
    billOnly: skipKitchenTicket,
    showcaseOnly: skipKitchenTicket,
  }
}

function toBackendMetaFields(kitchen: Kitchen, skipKitchenTicket: boolean): Record<string, unknown> {
  return {
    ...toBackendKitchenFields(kitchen),
    ...toBackendSkipKitchenFields(skipKitchenTicket),
  }
}

function parseKitchenFromRaw(raw: unknown): Kitchen | null {
  if (raw == null) return null
  const s = String(raw).trim().toUpperCase()
  if (!s) return null
  if (s === "KITCHEN_2" || s === "KITCHEN2" || s === "2" || s.includes("KITCHEN_2") || s.includes("KITCHEN 2")) {
    return "KITCHEN_2"
  }
  if (s === "KITCHEN_1" || s === "KITCHEN1" || s === "1" || s.includes("KITCHEN_1") || s.includes("KITCHEN 1")) {
    return "KITCHEN_1"
  }
  return null
}

function resolveKitchen(p: Record<string, unknown>, productId: number): Kitchen {
  const fromApi =
    parseKitchenFromRaw(p.kitchen) ??
    parseKitchenFromRaw(p.kitchenType) ??
    parseKitchenFromRaw(p.kitchen_type) ??
    parseKitchenFromRaw(p.kitchenStation) ??
    parseKitchenFromRaw(p.kitchen_station) ??
    parseKitchenFromRaw(p.preparationKitchen) ??
    parseKitchenFromRaw(p.preparation_kitchen) ??
    parseKitchenFromRaw(p.station) ??
    parseKitchenFromRaw(p.kitchenId)

  if (fromApi) return fromApi
  if (hasApiKitchenField(p)) return "KITCHEN_1"

  const meta = getProductLocalMeta(productId)
  if (meta?.kitchen) return meta.kitchen

  return "KITCHEN_1"
}

function parseSkipKitchenTicket(raw: unknown): boolean | null {
  if (raw == null) return null
  if (raw === true || raw === 1) return true
  if (raw === false || raw === 0) return false
  const s = String(raw).trim().toLowerCase()
  if (!s) return null
  if (s === "true" || s === "1" || s === "yes" || s.includes("showcase") || s.includes("bill_only")) return true
  if (s === "false" || s === "0" || s === "no") return false
  return null
}

function resolveSkipKitchenTicket(p: Record<string, unknown>, productId: number): boolean {
  const fromApi =
    parseSkipKitchenTicket(p.skipKitchenTicket) ??
    parseSkipKitchenTicket(p.skip_kitchen_ticket) ??
    parseSkipKitchenTicket(p.billOnly) ??
    parseSkipKitchenTicket(p.showcaseOnly) ??
    parseSkipKitchenTicket(p.showcase)

  if (fromApi != null) return fromApi
  if (hasApiSkipKitchenField(p)) return false

  const meta = getProductLocalMeta(productId)
  if (meta?.skipKitchenTicket != null) return meta.skipKitchenTicket

  return false
}

function resolveNameSinhala(p: Record<string, unknown>, productId: number): string | null {
  const candidates = [p.nameSinhala, p.name_sinhala, p.sinhalaName, p.kotNameSi, p.kitchenNameSi]
  for (const raw of candidates) {
    if (raw == null) continue
    const s = String(raw).trim()
    if (s.length > 0) return s
  }

  const meta = getProductLocalMeta(productId)
  if (meta?.nameSinhala != null && String(meta.nameSinhala).trim().length > 0) {
    return String(meta.nameSinhala).trim()
  }

  return null
}

function toBackendNameSinhalaFields(nameSinhala: string | null | undefined): Record<string, unknown> {
  const value = nameSinhala != null && String(nameSinhala).trim().length > 0 ? String(nameSinhala).trim() : null
  return {
    nameSinhala: value,
    name_sinhala: value,
    sinhalaName: value,
    kotNameSi: value,
    kitchenNameSi: value,
  }
}

function normalizeProduct(raw: unknown): ProductResponseDto {
  const p = (raw ?? {}) as Record<string, unknown>
  const productId = Number(p.productId ?? p.id)
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

  const kitchen = resolveKitchen(p, productId)
  const nameSinhala = resolveNameSinhala(p, productId)

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
    skipKitchenTicket: resolveSkipKitchenTicket(p, productId),
    createdAt: String(p.createdAt ?? "") || nowIso(),
    updatedAt: (p.updatedAt as string | null) ?? null,
  }
}

function toBackendProductRequest(payload: ProductRequestDto, skipPortionPrices = false, skipRecipe = false): Record<string, unknown> {
  const base: Record<string, unknown> = {
    categoryId: payload.categoryId,
    name: payload.name,
    ...toBackendNameSinhalaFields(payload.nameSinhala),
    description: payload.description,
    costPrice: payload.costPrice,
    sellingPrice: payload.sellingPrice,
    imageUrl: payload.imageUrl,
    isAvailable: payload.isAvailable,
    ...toBackendMetaFields(payload.kitchen, payload.skipKitchenTicket ?? false),
  }
  if (!skipPortionPrices) {
    base.hasPortionPricing = payload.hasPortionPricing
    base.portionPrices = payload.portionPrices
  }
  if (!skipRecipe) {
    base.recipe = toBackendRecipeLines(payload.recipe)
    base.recipeLines = toBackendRecipeLines(payload.recipe)
  }
  if (payload.productId != null) base.productId = payload.productId
  return base
}

function toBackendProductPatch(patch: ProductPatchDto): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (patch.categoryId != null) out.categoryId = patch.categoryId
  if (patch.kitchen != null) Object.assign(out, toBackendKitchenFields(patch.kitchen))
  if (patch.skipKitchenTicket != null) Object.assign(out, toBackendSkipKitchenFields(patch.skipKitchenTicket))
  if (patch.name != null) out.name = patch.name
  if (patch.nameSinhala !== undefined) Object.assign(out, toBackendNameSinhalaFields(patch.nameSinhala))
  if (patch.description != null) out.description = patch.description
  if (patch.costPrice != null) out.costPrice = patch.costPrice
  if (patch.sellingPrice != null) out.sellingPrice = patch.sellingPrice
  if (patch.imageUrl !== undefined) out.imageUrl = patch.imageUrl
  if (patch.isAvailable != null) out.isAvailable = patch.isAvailable
  if (patch.hasPortionPricing != null) out.hasPortionPricing = patch.hasPortionPricing
  if (patch.portionPrices != null) out.portionPrices = patch.portionPrices
  if (patch.recipe != null) {
    out.recipe = toBackendRecipeLines(patch.recipe)
    out.recipeLines = toBackendRecipeLines(patch.recipe)
  }
  if (patch.productId != null) out.productId = patch.productId
  return out
}

async function fetchProductById(productId: number): Promise<ProductResponseDto> {
  const res = await axiosClient.get<unknown>(`/products/${productId}`)
  return normalizeProduct(res.data)
}

/** Second PATCH so kitchen / showcase / Sinhala KOT name persist on backends that ignore them in the main body. */
async function syncProductMetaOnBackend(
  productId: number,
  meta: { kitchen: Kitchen; skipKitchenTicket: boolean; nameSinhala?: string | null },
): Promise<void> {
  await axiosClient.patch(`/products/${productId}`, {
    ...toBackendMetaFields(meta.kitchen, meta.skipKitchenTicket),
    ...toBackendNameSinhalaFields(meta.nameSinhala),
  })
}

function finalizeSavedProduct(
  product: ProductResponseDto,
  productId: number,
  expected: { kitchen: Kitchen; skipKitchenTicket: boolean; nameSinhala?: string | null },
): ProductResponseDto {
  const expectedSi =
    expected.nameSinhala != null && String(expected.nameSinhala).trim().length > 0
      ? String(expected.nameSinhala).trim()
      : null
  const kitchenOk = product.kitchen === expected.kitchen
  const skipOk = product.skipKitchenTicket === expected.skipKitchenTicket
  const sinhalaOk = (product.nameSinhala ?? null) === expectedSi

  if (kitchenOk && skipOk && sinhalaOk) {
    persistProductMeta(productId, {
      kitchen: expected.kitchen,
      skipKitchenTicket: expected.skipKitchenTicket,
      nameSinhala: expectedSi,
    })
    return product
  }

  persistProductMeta(productId, {
    kitchen: expected.kitchen,
    skipKitchenTicket: expected.skipKitchenTicket,
    nameSinhala: expectedSi,
  })
  return {
    ...product,
    kitchen: expected.kitchen,
    skipKitchenTicket: expected.skipKitchenTicket,
    nameSinhala: expectedSi ?? product.nameSinhala,
  }
}

export async function getAllProducts(): Promise<ProductResponseDto[]> {
  const res = await axiosClient.get<unknown[]>("/products")
  return Array.isArray(res.data) ? res.data.map((raw) => normalizeProduct(raw)) : []
}

export async function getProductById(productId: number): Promise<ProductResponseDto> {
  return fetchProductById(productId)
}

function persistProductMeta(
  productId: number,
  meta: { kitchen: Kitchen; skipKitchenTicket: boolean; nameSinhala?: string | null },
): void {
  setProductLocalMeta(productId, meta)
}

export async function createProduct(payload: ProductRequestDto): Promise<ProductResponseDto> {
  const res = await axiosClient.post<unknown>("/products", toBackendProductRequest(payload))
  const created = normalizeProduct(res.data)
  const productId = created.productId

  try {
    await syncProductMetaOnBackend(productId, {
      kitchen: payload.kitchen,
      skipKitchenTicket: !!payload.skipKitchenTicket,
      nameSinhala: payload.nameSinhala ?? null,
    })
  } catch (syncErr) {
    console.warn("Product meta sync failed after create", syncErr)
  }

  let verified = created
  try {
    verified = await fetchProductById(productId)
  } catch {
    /* use create response */
  }

  return finalizeSavedProduct(verified, productId, {
    kitchen: payload.kitchen,
    skipKitchenTicket: !!payload.skipKitchenTicket,
    nameSinhala: payload.nameSinhala ?? null,
  })
}

export async function updateProduct(productId: number, payload: ProductRequestDto, skipPortionPrices = false, skipRecipe = false): Promise<ProductResponseDto> {
  await axiosClient.patch<unknown>(
    `/products/${productId}`,
    toBackendProductRequest({ ...payload, productId }, skipPortionPrices, skipRecipe),
  )

  try {
    await syncProductMetaOnBackend(productId, {
      kitchen: payload.kitchen,
      skipKitchenTicket: !!payload.skipKitchenTicket,
      nameSinhala: payload.nameSinhala ?? null,
    })
  } catch (syncErr) {
    console.warn("Product meta sync failed after update", syncErr)
  }

  let verified: ProductResponseDto
  try {
    verified = await fetchProductById(productId)
  } catch {
    verified = normalizeProduct({ productId, ...payload })
  }

  return finalizeSavedProduct(verified, productId, {
    kitchen: payload.kitchen,
    skipKitchenTicket: !!payload.skipKitchenTicket,
    nameSinhala: payload.nameSinhala ?? null,
  })
}

export async function patchProduct(productId: number, patch: ProductPatchDto): Promise<ProductResponseDto> {
  await axiosClient.patch<unknown>(`/products/${productId}`, toBackendProductPatch(patch))

  const kitchen = patch.kitchen
  const skipKitchenTicket = patch.skipKitchenTicket
  if (kitchen != null || skipKitchenTicket != null || patch.nameSinhala !== undefined) {
    const current = await fetchProductById(productId).catch(() => null)
    const nextKitchen = kitchen ?? current?.kitchen ?? "KITCHEN_1"
    const nextSkip = skipKitchenTicket ?? current?.skipKitchenTicket ?? false
    const nextSi = patch.nameSinhala !== undefined ? patch.nameSinhala : current?.nameSinhala ?? null
    try {
      await syncProductMetaOnBackend(productId, {
        kitchen: nextKitchen,
        skipKitchenTicket: nextSkip,
        nameSinhala: nextSi,
      })
    } catch (syncErr) {
      console.warn("Product meta sync failed after patch", syncErr)
    }
  }

  const verified = await fetchProductById(productId)
  return finalizeSavedProduct(verified, productId, {
    kitchen: patch.kitchen ?? verified.kitchen,
    skipKitchenTicket: patch.skipKitchenTicket ?? verified.skipKitchenTicket,
    nameSinhala: patch.nameSinhala,
  })
}

export type DeleteProductResult = { mode: "deleted" } | { mode: "hidden" }

export async function deleteProduct(productId: number): Promise<DeleteProductResult> {
  try {
    await axiosClient.delete(`/products/${productId}`)
    removeProductLocalMeta(productId)
    return { mode: "deleted" }
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    // Backend often returns 500 when product is referenced by orders — hide from menu instead.
    if (status === 500 || status === 409 || status === 400 || status === 422) {
      try {
        await patchProduct(productId, { isAvailable: false })
        return { mode: "hidden" }
      } catch (patchErr) {
        throw new Error(getApiErrorMessage(patchErr, getApiErrorMessage(err, "Failed to delete product.")))
      }
    }
    throw new Error(getApiErrorMessage(err, "Failed to delete product."))
  }
}

export async function uploadProductImage(productId: number, file: File): Promise<ProductResponseDto> {
  const form = new FormData()
  form.append("image", file)
  const res = await axiosClient.post<unknown>(`/products/${productId}/image`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return normalizeProduct(res.data)
}
