import axiosClient from "@/axios"

export type PortionType = "MEDIUM" | "LARGE"

export type OrderItemRequestDto = {
  orderId: number
  productId: number
  quantity: number
  portionType?: PortionType | null
  unitPrice: number
  subtotal: number
}

export type OrderItemResponseDto = OrderItemRequestDto & {
  orderItemId: number
  createdAt: string
  updatedAt: string | null
}

export type OrderItemPatchDto = Partial<
  Pick<OrderItemRequestDto, "orderId" | "productId" | "quantity" | "unitPrice" | "subtotal">
> & {
  portionType?: PortionType | null
}

function normalizePortionType(v: unknown): PortionType | null {
  const s = String(v ?? "").trim().toUpperCase()
  if (s === "MEDIUM" || s === "LARGE") return s
  return null
}

function normalizeOrderItem(x: unknown): OrderItemResponseDto {
  const r = x as Record<string, unknown>
  const portion =
    r?.portionType ??
    r?.portion_type ??
    r?.portion ??
    r?.portionSize ??
    r?.portion_size ??
    r?.portiontype

  return {
    orderItemId: Number(r?.orderItemId ?? r?.orderItemID ?? r?.id ?? r?.ID),
    orderId: Number(r?.orderId ?? r?.orderID),
    productId: Number(r?.productId ?? r?.productID),
    quantity: Number(r?.quantity),
    portionType: normalizePortionType(portion),
    unitPrice: Number(r?.unitPrice),
    subtotal: Number(r?.subtotal),
    createdAt: String(r?.createdAt ?? ""),
    updatedAt: (r?.updatedAt as string | null) ?? null,
  }
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  const d = data as Record<string, unknown> | null
  if (Array.isArray(d?.data)) return d.data as unknown[]
  if (Array.isArray(d?.content)) return d.content as unknown[]
  return []
}

export async function createOrderItem(payload: OrderItemRequestDto): Promise<OrderItemResponseDto> {
  const res = await axiosClient.post<unknown>("/order-items", payload)
  return normalizeOrderItem(res.data)
}

export async function getAllOrderItems(): Promise<OrderItemResponseDto[]> {
  const res = await axiosClient.get<unknown>("/order-items")
  return unwrapList(res.data).map(normalizeOrderItem).filter((i) => Number.isFinite(i.orderItemId))
}

export async function getOrderItemById(orderItemId: number): Promise<OrderItemResponseDto> {
  const res = await axiosClient.get<unknown>(`/order-items/${orderItemId}`)
  return normalizeOrderItem(res.data)
}

export async function updateOrderItem(orderItemId: number, payload: OrderItemRequestDto): Promise<OrderItemResponseDto> {
  const res = await axiosClient.put<unknown>(`/order-items/${orderItemId}`, payload)
  return normalizeOrderItem(res.data)
}

export async function patchOrderItem(orderItemId: number, patch: OrderItemPatchDto): Promise<OrderItemResponseDto> {
  const res = await axiosClient.patch<unknown>(`/order-items/${orderItemId}`, patch)
  return normalizeOrderItem(res.data)
}

export async function deleteOrderItem(orderItemId: number): Promise<void> {
  await axiosClient.delete(`/order-items/${orderItemId}`)
}
