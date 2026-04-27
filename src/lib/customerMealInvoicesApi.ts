import axiosClient from "@/axios"
import { nowIso } from "@/lib/demoPersistence"

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER"
export type InvoiceStatus = "PAID" | "UNPAID"

export type CustomerMealInvoiceRequestDto = {
  /** Either customerId OR customerName must be provided. */
  customerId?: number | null
  customerName?: string | null
  mealType: MealType
  quantity: number
  unitPrice: number
}

export type CustomerMealInvoiceResponseDto = {
  invoiceId: number
  invoiceNo: string
  customerId: number | null
  customerName: string
  mealType: MealType
  quantity: number
  unitPrice: number
  total: number
  status: InvoiceStatus
  paidAt: string | null
  createdAt: string
  updatedAt: string | null
}

export type CustomerMealInvoicePatchDto = Partial<CustomerMealInvoiceRequestDto> & {
  status?: InvoiceStatus
}

function normalizeInvoice(raw: unknown): CustomerMealInvoiceResponseDto {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    invoiceId: Number(r.invoiceId ?? r.id),
    invoiceNo: String(r.invoiceNo ?? r.invoiceNumber ?? ""),
    customerId: r.customerId == null ? null : Number(r.customerId),
    customerName: String(r.customerName ?? ""),
    mealType: String(r.mealType ?? "LUNCH") as MealType,
    quantity: Number(r.quantity ?? 0),
    unitPrice: Number(r.unitPrice ?? 0),
    total: Number(r.total ?? 0),
    status: String(r.status ?? "UNPAID") as InvoiceStatus,
    paidAt: (r.paidAt as string | null) ?? null,
    createdAt: String(r.createdAt ?? "") || nowIso(),
    updatedAt: (r.updatedAt as string | null) ?? null,
  }
}

export async function createCustomerMealInvoice(
  body: CustomerMealInvoiceRequestDto,
): Promise<CustomerMealInvoiceResponseDto> {
  const res = await axiosClient.post<unknown>("/customer-meal-invoices", body)
  return normalizeInvoice(res.data)
}

export async function getAllCustomerMealInvoices(): Promise<CustomerMealInvoiceResponseDto[]> {
  const res = await axiosClient.get<unknown[]>("/customer-meal-invoices")
  return Array.isArray(res.data) ? res.data.map(normalizeInvoice) : []
}

export async function getCustomerMealInvoiceById(invoiceId: number): Promise<CustomerMealInvoiceResponseDto> {
  const res = await axiosClient.get<unknown>(`/customer-meal-invoices/${invoiceId}`)
  return normalizeInvoice(res.data)
}

export async function updateCustomerMealInvoice(
  invoiceId: number,
  body: CustomerMealInvoiceRequestDto,
): Promise<CustomerMealInvoiceResponseDto> {
  const res = await axiosClient.put<unknown>(`/customer-meal-invoices/${invoiceId}`, body)
  return normalizeInvoice(res.data)
}

export async function patchCustomerMealInvoice(
  invoiceId: number,
  patch: CustomerMealInvoicePatchDto,
): Promise<CustomerMealInvoiceResponseDto> {
  const res = await axiosClient.patch<unknown>(`/customer-meal-invoices/${invoiceId}`, patch)
  return normalizeInvoice(res.data)
}

export async function deleteCustomerMealInvoice(invoiceId: number): Promise<void> {
  await axiosClient.delete(`/customer-meal-invoices/${invoiceId}`)
}
