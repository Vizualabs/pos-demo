import axiosClient from "@/axios"
import { nowIso } from "@/lib/demoPersistence"

export type CategoryResponseDto = {
  categoryId: number
  name: string
  iconUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export type CreateCategoryRequestDto = {
  name: string
  iconUrl: string | null
  isActive: boolean
}

export type PatchCategoryRequestDto = Partial<CreateCategoryRequestDto>

function normalizeCategory(c: unknown): CategoryResponseDto {
  const x = c as Record<string, unknown>
  return {
    categoryId: Number(x.categoryId ?? x.CategoryId ?? x.id ?? x.ID),
    name: String(x.name ?? ""),
    iconUrl: (x.iconUrl as string | null) ?? null,
    isActive: (x.isActive as boolean) ?? (x.IsActive as boolean) ?? (x.active as boolean) ?? true,
    createdAt: String(x.createdAt ?? "") || nowIso(),
    updatedAt: (x.updatedAt as string | null) ?? null,
  }
}

const categoryCache = new Map<number, CategoryResponseDto>()

export async function getAllCategories(): Promise<CategoryResponseDto[]> {
  const res = await axiosClient.get<unknown[]>("/categories")
  const list = Array.isArray(res.data) ? res.data.map(normalizeCategory).filter((c) => Number.isFinite(c.categoryId)) : []
  categoryCache.clear()
  for (const c of list) categoryCache.set(c.categoryId, c)
  return list
}

export async function getCategoryById(categoryId: number): Promise<CategoryResponseDto> {
  const cached = categoryCache.get(categoryId)
  if (cached) return cached

  const res = await axiosClient.get<unknown>(`/categories/${categoryId}`)
  const found = normalizeCategory(res.data)
  categoryCache.set(found.categoryId, found)
  return found
}

export async function createCategory(name: string): Promise<CategoryResponseDto> {
  return createCategoryFull({ name: name.trim(), iconUrl: null, isActive: true })
}

export async function createCategoryFull(body: CreateCategoryRequestDto): Promise<CategoryResponseDto> {
  const res = await axiosClient.post<unknown>("/categories", body)
  const created = normalizeCategory(res.data)
  categoryCache.set(created.categoryId, created)
  return created
}

export async function updateCategory(categoryId: number, body: CreateCategoryRequestDto): Promise<CategoryResponseDto> {
  const res = await axiosClient.put<unknown>(`/categories/${categoryId}`, body)
  const updated = normalizeCategory(res.data)
  categoryCache.set(updated.categoryId, updated)
  return updated
}

export async function patchCategory(categoryId: number, patch: PatchCategoryRequestDto): Promise<CategoryResponseDto> {
  const res = await axiosClient.patch<unknown>(`/categories/${categoryId}`, patch)
  const updated = normalizeCategory(res.data)
  categoryCache.set(updated.categoryId, updated)
  return updated
}

export async function deleteCategory(categoryId: number): Promise<void> {
  await axiosClient.delete(`/categories/${categoryId}`)
  categoryCache.delete(categoryId)
}
