import axiosClient from "@/axios"
import { nowIso } from "@/lib/demoPersistence"

export type PaymentMethod = "CASH" | "CARD" | "PAYPAL" | "BANK_TRANSFER" | "CASH_ON_DELIVERY"

export type OrderStatus = "NEW" | "PAID" | "CANCELLED" | "UPDATED"

export type OrderType = "DINE_IN" | "TAKE_AWAY" | "DELIVERY"
export type Kitchen = "KITCHEN_1" | "KITCHEN_2"

export type PortionType = "MEDIUM" | "LARGE"

export type OrderItemRequestDto = {
  productId: number
  quantity: number
  /** Preferred key used by this frontend and order-items API. */
  portionType?: PortionType | null
  /** Alternate key some backends use. We send both. */
  portionSize?: PortionType | null
  /** Optional: if provided, backend can skip unit-price lookup. */
  unitPrice?: number
  /** Optional: if provided, backend can skip subtotal calculation. */
  subtotal?: number
}

export type OrderRequestDto = {
  tableNumber: number | null
  totalAmount: number
  taxAmount: number
  discountAmount: number
  paymentMethod: PaymentMethod
  status: OrderStatus
  orderType: OrderType
  kitchen: Kitchen
  items: OrderItemRequestDto[]
}

export type OrderResponseDto = Omit<OrderRequestDto, "items"> & {
  orderId: number
  orderDate: string
  createdAt: string
  updatedAt: string | null
  items?: OrderItemRequestDto[]
}

export type OrderPatchDto = Partial<Omit<OrderRequestDto, "items">> & {
  items?: OrderItemRequestDto[]
}

function normalizePortionType(v: unknown): PortionType | null {
  const s = String(v ?? "").trim().toUpperCase()
  if (s === "MEDIUM" || s === "LARGE") return s
  return null
}

function normalizeOrderItems(raw: unknown): OrderItemRequestDto[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: OrderItemRequestDto[] = []
  for (const x of raw) {
    const r = (x ?? {}) as Record<string, unknown>
    const productId = Number(r.productId ?? r.productID ?? r.id)
    const quantity = Number(r.quantity)
    if (!Number.isFinite(productId) || productId < 1) continue
    if (!Number.isFinite(quantity) || quantity <= 0) continue

    const portion = normalizePortionType(r.portionType ?? r.portionSize ?? r.portion)
    const unitPrice = Number(r.unitPrice)
    const subtotal = Number(r.subtotal ?? r.lineTotal)

    out.push({
      productId,
      quantity,
      portionType: portion,
      portionSize: portion,
      unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : undefined,
      subtotal: Number.isFinite(subtotal) && subtotal >= 0 ? subtotal : undefined,
    })
  }
  return out.length > 0 ? out : undefined
}

function normalizeOrder(raw: unknown): OrderResponseDto {
  const r = (raw ?? {}) as Record<string, unknown>
  const orderDate = String(r.orderDate ?? r.createdAt ?? "") || nowIso()
  return {
    orderId: Number(r.orderId ?? r.id),
    tableNumber: (r.tableNumber as number | null) ?? null,
    totalAmount: Number(r.totalAmount ?? 0),
    taxAmount: Number(r.taxAmount ?? 0),
    discountAmount: Number(r.discountAmount ?? 0),
    paymentMethod: (String(r.paymentMethod ?? "CASH") as PaymentMethod) ?? "CASH",
    status: (String(r.status ?? "NEW") as OrderStatus) ?? "NEW",
    orderType: (String(r.orderType ?? "DINE_IN") as OrderType) ?? "DINE_IN",
    kitchen: (r.kitchen === "KITCHEN_2" ? "KITCHEN_2" : "KITCHEN_1") as Kitchen,
    orderDate,
    createdAt: String(r.createdAt ?? orderDate),
    updatedAt: (r.updatedAt as string | null) ?? null,
    items: normalizeOrderItems(r.items ?? r.orderItems ?? r.order_items),
  }
}

function toBackendOrderRequest(payload: OrderRequestDto): Record<string, unknown> {
  const orderItems = toBackendOrderItems(payload.items)
  return {
    tableNumber: payload.tableNumber,
    totalAmount: payload.totalAmount,
    taxAmount: payload.taxAmount,
    discountAmount: payload.discountAmount,
    paymentMethod: payload.paymentMethod,
    status: payload.status,
    orderType: payload.orderType,
    kitchen: payload.kitchen,
    // Some backends expect this field name.
    items: orderItems,
    // Backend commonly expects this field name.
    orderItems,
    // Some services use snake_case.
    order_items: orderItems,
  }
}

export async function createOrder(payload: OrderRequestDto): Promise<OrderResponseDto> {
  const res = await axiosClient.post<unknown>("/orders", toBackendOrderRequest(payload))
  // Backend response may not echo items; keep the request items in memory for UI convenience.
  const created = normalizeOrder(res.data)
  return { ...created, items: payload.items }
}

export async function getAllOrders(): Promise<OrderResponseDto[]> {
  const res = await axiosClient.get<unknown[]>("/orders")
  return Array.isArray(res.data) ? res.data.map(normalizeOrder) : []
}

export async function getOrderById(orderId: number): Promise<OrderResponseDto> {
  const res = await axiosClient.get<unknown>(`/orders/${orderId}`)
  return normalizeOrder(res.data)
}

export async function updateOrder(orderId: number, payload: OrderRequestDto): Promise<OrderResponseDto> {
  const res = await axiosClient.put<unknown>(`/orders/${orderId}`, toBackendOrderRequest(payload))
  const updated = normalizeOrder(res.data)
  return { ...updated, items: payload.items }
}

export async function patchOrder(orderId: number, patch: OrderPatchDto): Promise<OrderResponseDto> {
  const body: Record<string, unknown> = { ...patch }
  if (patch.items !== undefined) {
    const orderItems = toBackendOrderItems(patch.items)
    body.items = orderItems
    body.orderItems = orderItems
    body.order_items = orderItems
  }

  const res = await axiosClient.patch<unknown>(`/orders/${orderId}`, body)
  const updated = normalizeOrder(res.data)
  // If backend doesn't return items, preserve caller-provided patch items.
  if (patch.items !== undefined) return { ...updated, items: patch.items }
  return updated
}

function toBackendOrderItems(items: OrderItemRequestDto[]): Record<string, unknown>[] {
  return items.map((it) => {
    const portion = it.portionType ?? it.portionSize ?? null
    const unitPrice = typeof it.unitPrice === "number" && Number.isFinite(it.unitPrice) ? it.unitPrice : undefined
    const subtotal = typeof it.subtotal === "number" && Number.isFinite(it.subtotal) ? it.subtotal : undefined

    const out: Record<string, unknown> = {
      productId: it.productId,
      quantity: it.quantity,
      portionType: portion,
      portionSize: portion,
    }

    if (unitPrice !== undefined) out.unitPrice = unitPrice
    if (subtotal !== undefined) {
      out.subtotal = subtotal
      out.lineTotal = subtotal
    }

    return out
  })
}

export async function deleteOrder(orderId: number): Promise<void> {
  await axiosClient.delete(`/orders/${orderId}`)
}
