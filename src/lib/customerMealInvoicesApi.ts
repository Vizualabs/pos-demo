import axiosClient from "@/axios"
import { nowIso } from "@/lib/demoPersistence"
import { loadAllMealInvoiceGroups, removeMealInvoiceGroup, saveMealInvoiceGroup } from "@/lib/mealInvoiceGroups"

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

export type CustomerMealInvoiceLineDto = {
  mealType: MealType
  quantity: number
  unitPrice: number
  lineTotal: number
}

/** One customer invoice in the UI — may include several meal lines (one backend row per line). */
export type CustomerMealInvoiceDocument = {
  groupId: string
  invoiceIds: number[]
  invoiceId: number
  invoiceNo: string
  customerId: number | null
  customerName: string
  lines: CustomerMealInvoiceLineDto[]
  total: number
  status: InvoiceStatus
  paidAt: string | null
  createdAt: string
  updatedAt: string | null
}

export type CreateCustomerMealInvoiceDocumentInput = {
  customerId?: number
  customerName?: string
  lines: Omit<CustomerMealInvoiceLineDto, "lineTotal">[]
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function lineTotal(qty: number, unit: number): number {
  return roundMoney(qty * unit)
}

function normalizeLineFromRaw(raw: unknown): CustomerMealInvoiceLineDto | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const mealType = String(r.mealType ?? r.meal_type ?? "LUNCH").toUpperCase() as MealType
  const quantity = Number(r.quantity ?? r.qty ?? 0)
  const unitPrice = Number(r.unitPrice ?? r.unit_price ?? 0)
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return null
  return { mealType, quantity, unitPrice, lineTotal: lineTotal(quantity, unitPrice) }
}

function rowsToLines(rows: CustomerMealInvoiceResponseDto[]): CustomerMealInvoiceLineDto[] {
  return rows.map((r) => ({
    mealType: r.mealType,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    lineTotal: Number(r.total) || lineTotal(r.quantity, r.unitPrice),
  }))
}

export function mergeRowsToDocument(
  rows: CustomerMealInvoiceResponseDto[],
  groupId?: string,
): CustomerMealInvoiceDocument {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const first = sorted[0]
  const lines = rowsToLines(sorted)
  const total = roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0))
  const allPaid = sorted.every((r) => r.status === "PAID")
  const gid =
    groupId ??
    (sorted.length > 1
      ? typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `grp-${Date.now()}`
      : `single-${first.invoiceId}`)

  return {
    groupId: gid,
    invoiceIds: sorted.map((r) => r.invoiceId),
    invoiceId: first.invoiceId,
    invoiceNo: first.invoiceNo,
    customerId: first.customerId,
    customerName: first.customerName,
    lines,
    total: total > 0 ? total : Number(first.total) || 0,
    status: allPaid ? "PAID" : "UNPAID",
    paidAt: sorted.find((r) => r.paidAt)?.paidAt ?? null,
    createdAt: first.createdAt,
    updatedAt: sorted.find((r) => r.updatedAt)?.updatedAt ?? first.updatedAt,
  }
}

function normalizeDocumentFromResponse(raw: unknown): CustomerMealInvoiceDocument | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const lineRaws = r.lines ?? r.items ?? r.mealLines ?? r.invoiceLines ?? r.lineItems
  if (Array.isArray(lineRaws) && lineRaws.length > 0) {
    const lines = lineRaws.map(normalizeLineFromRaw).filter((x): x is CustomerMealInvoiceLineDto => x != null)
    if (lines.length === 0) return null
    const total = Number(r.total) || roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0))
    const invoiceId = Number(r.invoiceId ?? r.id ?? 0)
    return {
      groupId: `single-${invoiceId || crypto.randomUUID()}`,
      invoiceIds: invoiceId > 0 ? [invoiceId] : [],
      invoiceId,
      invoiceNo: String(r.invoiceNo ?? r.invoiceNumber ?? ""),
      customerId: r.customerId == null ? null : Number(r.customerId),
      customerName: String(r.customerName ?? ""),
      lines,
      total,
      status: String(r.status ?? "UNPAID") as InvoiceStatus,
      paidAt: (r.paidAt as string | null) ?? null,
      createdAt: String(r.createdAt ?? "") || nowIso(),
      updatedAt: (r.updatedAt as string | null) ?? null,
    }
  }
  const single = normalizeInvoice(raw)
  if (!Number.isFinite(single.invoiceId)) return null
  return mergeRowsToDocument([single])
}

export function buildDocumentsFromFlatRows(flat: CustomerMealInvoiceResponseDto[]): CustomerMealInvoiceDocument[] {
  const byId = new Map(flat.map((r) => [r.invoiceId, r]))
  const used = new Set<number>()
  const docs: CustomerMealInvoiceDocument[] = []

  for (const group of loadAllMealInvoiceGroups()) {
    const rows = group.invoiceIds.map((id) => byId.get(id)).filter((x): x is CustomerMealInvoiceResponseDto => !!x)
    if (rows.length === 0) continue
    rows.forEach((r) => used.add(r.invoiceId))
    docs.push(mergeRowsToDocument(rows, group.groupId))
  }

  for (const row of flat) {
    if (!used.has(row.invoiceId)) {
      docs.push(mergeRowsToDocument([row]))
    }
  }

  return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function toBackendMultiLineBody(input: CreateCustomerMealInvoiceDocumentInput): Record<string, unknown> {
  const lines = input.lines.map((l) => {
    const mealType = String(l.mealType).toUpperCase()
    const quantity = Number(l.quantity)
    const unitPrice = Number(l.unitPrice)
    return {
      mealType,
      meal_type: mealType,
      quantity,
      qty: quantity,
      unitPrice,
      unit_price: unitPrice,
    }
  })

  const out: Record<string, unknown> = { lines, items: lines, mealLines: lines, invoiceLines: lines, lineItems: lines }

  const customerId = input.customerId != null ? Number(input.customerId) : NaN
  if (Number.isFinite(customerId) && customerId > 0) {
    out.customerId = customerId
    out.customer_id = customerId
  }
  const customerName = input.customerName?.trim() ?? ""
  if (customerName) {
    out.customerName = customerName
    out.customer_name = customerName
  }
  return out
}

function toBackendCustomerMealInvoiceRequest(body: CustomerMealInvoiceRequestDto): Record<string, unknown> {
  const mealType = String(body.mealType ?? "LUNCH").toUpperCase() as MealType
  const quantity = Number(body.quantity)
  const unitPrice = Number(body.unitPrice)

  const out: Record<string, unknown> = {
    mealType,
    meal_type: mealType,
    quantity,
    qty: quantity,
    unitPrice,
    unit_price: unitPrice,
  }

  const customerId = body.customerId != null ? Number(body.customerId) : NaN
  if (Number.isFinite(customerId) && customerId > 0) {
    out.customerId = customerId
    out.customer_id = customerId
  }

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : ""
  if (customerName) {
    out.customerName = customerName
    out.customer_name = customerName
  }

  return out
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
  const res = await axiosClient.post<unknown>(
    "/customer-meal-invoices",
    toBackendCustomerMealInvoiceRequest(body),
  )
  return normalizeInvoice(res.data)
}

export async function getAllCustomerMealInvoices(): Promise<CustomerMealInvoiceResponseDto[]> {
  try {
    const res = await axiosClient.get<unknown[]>("/customer-meal-invoices")
    return Array.isArray(res.data) ? res.data.map(normalizeInvoice) : []
  } catch (err: unknown) {
    // Backend throws INVALID_REQUEST when the table is empty instead of returning [].
    // Treat any "not found" variant as an empty list.
    const msg: string =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? ""
    if (msg.toLowerCase().includes("not.found") || msg.toLowerCase().includes("not found")) {
      return []
    }
    throw err
  }
}

export async function getCustomerMealInvoiceById(invoiceId: number): Promise<CustomerMealInvoiceResponseDto> {
  const res = await axiosClient.get<unknown>(`/customer-meal-invoices/${invoiceId}`)
  return normalizeInvoice(res.data)
}

export async function updateCustomerMealInvoice(
  invoiceId: number,
  body: CustomerMealInvoiceRequestDto,
): Promise<CustomerMealInvoiceResponseDto> {
  const res = await axiosClient.put<unknown>(
    `/customer-meal-invoices/${invoiceId}`,
    toBackendCustomerMealInvoiceRequest(body),
  )
  return normalizeInvoice(res.data)
}

export async function patchCustomerMealInvoice(
  invoiceId: number,
  patch: CustomerMealInvoicePatchDto,
): Promise<CustomerMealInvoiceResponseDto> {
  const hasMealOrCustomerFields =
    patch.mealType != null ||
    patch.quantity != null ||
    patch.unitPrice != null ||
    patch.customerId != null ||
    patch.customerName != null

  let body: Record<string, unknown>
  if (hasMealOrCustomerFields) {
    body = toBackendCustomerMealInvoiceRequest({
      mealType: patch.mealType ?? "LUNCH",
      quantity: patch.quantity ?? 1,
      unitPrice: patch.unitPrice ?? 0,
      customerId: patch.customerId,
      customerName: patch.customerName,
    })
    if (patch.status) body.status = patch.status
  } else {
    body = { ...patch }
  }

  const res = await axiosClient.patch<unknown>(`/customer-meal-invoices/${invoiceId}`, body)
  return normalizeInvoice(res.data)
}

export async function deleteCustomerMealInvoice(invoiceId: number): Promise<void> {
  await axiosClient.delete(`/customer-meal-invoices/${invoiceId}`)
}

/** Create one invoice for the customer with all meal lines (tries multi-line API, else groups backend rows). */
export async function createCustomerMealInvoiceDocument(
  input: CreateCustomerMealInvoiceDocumentInput,
): Promise<CustomerMealInvoiceDocument> {
  const lines = input.lines.map((l) => ({
    mealType: l.mealType,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    lineTotal: lineTotal(l.quantity, l.unitPrice),
  }))

  const batchBody = toBackendMultiLineBody(input)
  const batchPaths = ["/customer-meal-invoices", "/customer-meal-invoices/batch", "/customer-meal-invoices/multi"]

  for (const path of batchPaths) {
    try {
      const res = await axiosClient.post<unknown>(path, batchBody)
      const doc = normalizeDocumentFromResponse(res.data)
      if (doc && doc.lines.length >= lines.length) {
        if (doc.invoiceIds.length > 1) {
          saveMealInvoiceGroup({
            groupId: doc.groupId,
            invoiceIds: doc.invoiceIds,
            createdAt: doc.createdAt,
          })
        }
        return doc
      }
    } catch {
      continue
    }
  }

  const rows: CustomerMealInvoiceResponseDto[] = []
  for (const line of input.lines) {
    const row = await createCustomerMealInvoice({
      ...(input.customerId != null ? { customerId: input.customerId } : {}),
      ...(input.customerName ? { customerName: input.customerName } : {}),
      mealType: line.mealType,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })
    rows.push(row)
  }

  const doc = mergeRowsToDocument(rows)
  if (rows.length > 1) {
    saveMealInvoiceGroup({
      groupId: doc.groupId,
      invoiceIds: doc.invoiceIds,
      createdAt: doc.createdAt,
    })
  }
  return doc
}

export async function getAllCustomerMealInvoiceDocuments(): Promise<CustomerMealInvoiceDocument[]> {
  const flat = await getAllCustomerMealInvoices()
  return buildDocumentsFromFlatRows(flat)
}

export async function markCustomerMealInvoiceDocumentPaid(
  doc: CustomerMealInvoiceDocument,
): Promise<CustomerMealInvoiceDocument> {
  const updated: CustomerMealInvoiceResponseDto[] = []
  for (const id of doc.invoiceIds) {
    updated.push(await patchCustomerMealInvoice(id, { status: "PAID" }))
  }
  return mergeRowsToDocument(updated, doc.groupId)
}

export async function deleteCustomerMealInvoiceDocument(doc: CustomerMealInvoiceDocument): Promise<void> {
  for (const id of doc.invoiceIds) {
    await deleteCustomerMealInvoice(id)
  }
  if (doc.invoiceIds.length > 1) {
    removeMealInvoiceGroup(doc.groupId)
  }
}
