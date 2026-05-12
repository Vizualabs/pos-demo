import axiosClient from "@/axios"
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
  const res = await axiosClient.post<unknown>("/customers", body)
  return normalizeCustomer(res.data)
}

export async function getAllCustomers(): Promise<CustomerResponseDto[]> {
  const res = await axiosClient.get<unknown[]>("/customers")
  return Array.isArray(res.data) ? res.data.map(normalizeCustomer) : []
}

export async function getCustomerById(customerId: number): Promise<CustomerResponseDto> {
  const res = await axiosClient.get<unknown>(`/customers/${customerId}`)
  return normalizeCustomer(res.data)
}

export async function updateCustomer(customerId: number, body: CustomerRequestDto): Promise<CustomerResponseDto> {
  const res = await axiosClient.put<unknown>(`/customers/${customerId}`, body)
  return normalizeCustomer(res.data)
}

export async function patchCustomer(customerId: number, patch: CustomerPatchDto): Promise<CustomerResponseDto> {
  const res = await axiosClient.patch<unknown>(`/customers/${customerId}`, patch)
  return normalizeCustomer(res.data)
}

export async function deleteCustomer(customerId: number): Promise<void> {
  await axiosClient.delete(`/customers/${customerId}`)
}
