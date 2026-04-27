import axiosClient from "@/axios"
import { nowIso } from "@/lib/demoPersistence"

export interface InventoryItemResponseDto {
  itemId: number
  itemName: string
  quantity: number
  lowStockThreshold: number
  /** LKR per kg (or per litre for liquids) — used for recipe cost. */
  costPerUnit: number
  updatedAt: string
  createdAt: string
}

export interface InventoryItemRequestDto {
  itemName: string
  quantity: number
  lowStockThreshold: number
  costPerUnit: number
}

export type InventoryItemPatchDto = Partial<InventoryItemRequestDto>

function normalizeItem(raw: Partial<InventoryItemResponseDto> & { costPerUnit?: number }): InventoryItemResponseDto {
  return {
    itemId: Number(raw.itemId),
    itemName: String(raw.itemName ?? ""),
    quantity: Number(raw.quantity ?? 0),
    lowStockThreshold: Number(raw.lowStockThreshold ?? 0),
    costPerUnit: typeof raw.costPerUnit === "number" && Number.isFinite(raw.costPerUnit) ? raw.costPerUnit : 120,
    createdAt: String(raw.createdAt ?? nowIso()),
    updatedAt: String(raw.updatedAt ?? nowIso()),
  }
}

export async function createInventoryItem(body: InventoryItemRequestDto): Promise<InventoryItemResponseDto> {
  const res = await axiosClient.post<unknown>("/inventory", body)
  return normalizeItem(res.data as Partial<InventoryItemResponseDto>)
}

export async function getAllInventoryItems(): Promise<InventoryItemResponseDto[]> {
  const res = await axiosClient.get<unknown[]>("/inventory")
  return Array.isArray(res.data) ? res.data.map((x) => normalizeItem(x as Partial<InventoryItemResponseDto>)) : []
}

export async function getInventoryItemById(itemId: number): Promise<InventoryItemResponseDto> {
  const res = await axiosClient.get<unknown>(`/inventory/${itemId}`)
  return normalizeItem(res.data as Partial<InventoryItemResponseDto>)
}

export async function updateInventoryItem(itemId: number, body: InventoryItemRequestDto): Promise<InventoryItemResponseDto> {
  const res = await axiosClient.put<unknown>(`/inventory/${itemId}`, body)
  return normalizeItem(res.data as Partial<InventoryItemResponseDto>)
}

export async function patchInventoryItem(itemId: number, patch: InventoryItemPatchDto): Promise<InventoryItemResponseDto> {
  const res = await axiosClient.patch<unknown>(`/inventory/${itemId}`, patch)
  return normalizeItem(res.data as Partial<InventoryItemResponseDto>)
}

export async function deleteInventoryItem(itemId: number): Promise<void> {
  await axiosClient.delete(`/inventory/${itemId}`)
}

export type InventoryUsageDeductionLine = { itemId: number; quantity: number }

export async function applyInventoryUsageDeductions(lines: InventoryUsageDeductionLine[]): Promise<InventoryItemResponseDto[]> {
  const res = await axiosClient.post<unknown[]>("/inventory/deduct", { lines })
  return Array.isArray(res.data) ? res.data.map((x) => normalizeItem(x as Partial<InventoryItemResponseDto>)) : []
}
