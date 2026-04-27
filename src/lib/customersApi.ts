import { apiFetch } from "@/lib/apiClient"
import { nowIso } from "@/lib/demoPersistence"

export type CustomerRequestDto = {
  name: string
  phone: string
  email: string
  pointsBalance: number
}

export type CustomerResponseDto = {
  customerId: number
  name: string
  phone: string
  email: string
  pointsBalance: number
  createdAt: string
  updatedAt: string | null
}

export type CustomerPatchDto = Partial<CustomerRequestDto>

function normalizeCustomer(raw: unknown): CustomerResponseDto {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    customerId: Number(r.customerId ?? r.id),
    name: String(r.name ?? ""),
    phone: String(r.phone ?? ""),
    email: String(r.email ?? ""),
    pointsBalance: Number(r.pointsBalance ?? 0),
    createdAt: String(r.createdAt ?? "") || nowIso(),
    updatedAt: (r.updatedAt as string | null) ?? null,
  }
}

export async function createCustomer(body: CustomerRequestDto): Promise<CustomerResponseDto> {
  const raw = await apiFetch<unknown>("/api/customers", {
    method: "POST",
    body,
  })
  return normalizeCustomer(raw)
}

export async function getAllCustomers(): Promise<CustomerResponseDto[]> {
  const raw = await apiFetch<unknown[]>("/api/customers", { method: "GET" })
  return Array.isArray(raw) ? raw.map(normalizeCustomer) : []
}

export async function getCustomerById(customerId: number): Promise<CustomerResponseDto> {
  const raw = await apiFetch<unknown>(`/api/customers/${customerId}`, { method: "GET" })
  return normalizeCustomer(raw)
}

export async function updateCustomer(customerId: number, body: CustomerRequestDto): Promise<CustomerResponseDto> {
  const raw = await apiFetch<unknown>(`/api/customers/${customerId}`, {
    method: "PUT",
    body,
  })
  return normalizeCustomer(raw)
}

export async function patchCustomer(customerId: number, patch: CustomerPatchDto): Promise<CustomerResponseDto> {
  const raw = await apiFetch<unknown>(`/api/customers/${customerId}`, {
    method: "PATCH",
    body: patch,
  })
  return normalizeCustomer(raw)
}

export async function deleteCustomer(customerId: number): Promise<void> {
  await apiFetch<void>(`/api/customers/${customerId}`, { method: "DELETE" })
}
