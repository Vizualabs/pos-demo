import axiosClient from "@/axios"
import { isDemoDataEnabled } from "@/config/demoMode"
import { nowIso } from "@/lib/demoPersistence"

export interface InventoryItemResponseDto {
  itemId: number
  itemName: string
  quantity: number
  lowStockThreshold: number
  costPerUnit: number | null
  updatedAt: string
  createdAt: string
}

export interface InventoryItemRequestDto {
  itemName: string
  quantity: number
  lowStockThreshold: number
  costPerUnit?: number | null
}

export type InventoryItemPatchDto = Partial<InventoryItemRequestDto>

/** Maps backend field name `cost` → frontend `costPerUnit`. */
function normalizeItem(raw: Record<string, unknown>): InventoryItemResponseDto {
  const cost = raw.cost
  return {
    itemId: Number(raw.itemId),
    itemName: String(raw.itemName ?? ""),
    quantity: Number(raw.quantity ?? 0),
    lowStockThreshold: Number(raw.lowStockThreshold ?? 0),
    costPerUnit: typeof cost === "number" && Number.isFinite(cost) ? cost : null,
    createdAt: String(raw.createdAt ?? nowIso()),
    updatedAt: String(raw.updatedAt ?? nowIso()),
  }
}

/** Maps frontend `costPerUnit` → backend field name `cost`. */
function toBackendBody(dto: InventoryItemRequestDto): Record<string, unknown> {
  const { costPerUnit, ...rest } = dto
  return { ...rest, cost: costPerUnit ?? null }
}

function toBackendPatch(patch: InventoryItemPatchDto): Record<string, unknown> {
  if (!("costPerUnit" in patch)) return patch as Record<string, unknown>
  const { costPerUnit, ...rest } = patch
  return { ...rest, cost: costPerUnit ?? null }
}

export async function createInventoryItem(body: InventoryItemRequestDto): Promise<InventoryItemResponseDto> {
  const res = await axiosClient.post<unknown>("/inventory", toBackendBody(body))
  return normalizeItem(res.data as Record<string, unknown>)
}

export async function getAllInventoryItems(): Promise<InventoryItemResponseDto[]> {
  const res = await axiosClient.get<unknown[]>("/inventory")
  return Array.isArray(res.data) ? res.data.map((x) => normalizeItem(x as Record<string, unknown>)) : []
}

export async function getInventoryItemById(itemId: number): Promise<InventoryItemResponseDto> {
  const res = await axiosClient.get<unknown>(`/inventory/${itemId}`)
  return normalizeItem(res.data as Record<string, unknown>)
}

export async function updateInventoryItem(itemId: number, body: InventoryItemRequestDto): Promise<InventoryItemResponseDto> {
  const res = await axiosClient.put<unknown>(`/inventory/${itemId}`, toBackendBody(body))
  return normalizeItem(res.data as Record<string, unknown>)
}

export async function patchInventoryItem(itemId: number, patch: InventoryItemPatchDto): Promise<InventoryItemResponseDto> {
  const res = await axiosClient.patch<unknown>(`/inventory/${itemId}`, toBackendPatch(patch))
  return normalizeItem(res.data as Record<string, unknown>)
}

export async function deleteInventoryItem(itemId: number): Promise<void> {
  await axiosClient.delete(`/inventory/${itemId}`)
}

export type InventoryUsageDeductionLine = { itemId: number; quantity: number }

export async function applyInventoryUsageDeductions(lines: InventoryUsageDeductionLine[]): Promise<InventoryItemResponseDto[]> {
  if (isDemoDataEnabled() || lines.length === 0) return []

  const res = await axiosClient.post<unknown[]>("/inventory/deduct", { lines })
  return Array.isArray(res.data) ? res.data.map((x) => normalizeItem(x as Record<string, unknown>)) : []
}
