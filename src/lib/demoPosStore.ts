import { DEMO_KEYS, loadJson, nowIso, saveJson } from "@/lib/demoPersistence"
import type { CategoryResponseDto } from "@/lib/categoriesApi"
import type { OrderItemRequestDto, OrderItemResponseDto } from "@/lib/orderItemsApi"
import type { OrderRequestDto, OrderResponseDto } from "@/lib/ordersApi"
import type { ProductResponseDto } from "@/lib/productsApi"

const ORDER_ID_KEY = "pos_demo_v1_next_order_id"
const ORDER_ITEM_ID_KEY = "pos_demo_v1_next_order_item_id"

function nextId(key: string, start: number): number {
  const n = loadJson<number>(key, start)
  saveJson(key, n + 1)
  return n
}

export const DEMO_CATEGORIES: CategoryResponseDto[] = [
  {
    categoryId: 1,
    name: "Rice & Curry",
    iconUrl: null,
    isActive: true,
    createdAt: nowIso(),
    updatedAt: null,
  },
  {
    categoryId: 2,
    name: "Kottu & Noodles",
    iconUrl: null,
    isActive: true,
    createdAt: nowIso(),
    updatedAt: null,
  },
  {
    categoryId: 3,
    name: "Beverages",
    iconUrl: null,
    isActive: true,
    createdAt: nowIso(),
    updatedAt: null,
  },
]

export const DEMO_PRODUCTS: ProductResponseDto[] = [
  {
    productId: 101,
    categoryId: 1,
    kitchen: "KITCHEN_1",
    name: "Chicken Fried Rice",
    nameSinhala: "චිකන් ෆ්‍රයිඩ් රයිස්",
    description: "Wok-fried rice with chicken and vegetables",
    costPrice: 400,
    sellingPrice: 850,
    imageUrl: null,
    isAvailable: true,
    hasPortionPricing: false,
    portionPrices: {},
    recipe: [],
    effectiveSellingPrice: 850,
    skipKitchenTicket: false,
    createdAt: nowIso(),
    updatedAt: null,
  },
  {
    productId: 102,
    categoryId: 1,
    kitchen: "KITCHEN_1",
    name: "Fish Curry & Rice",
    nameSinhala: "මාළු කරි සහ බත්",
    description: "Spiced fish curry with steamed rice",
    costPrice: 350,
    sellingPrice: 750,
    imageUrl: null,
    isAvailable: true,
    hasPortionPricing: false,
    portionPrices: {},
    recipe: [],
    effectiveSellingPrice: 750,
    skipKitchenTicket: false,
    createdAt: nowIso(),
    updatedAt: null,
  },
  {
    productId: 201,
    categoryId: 2,
    kitchen: "KITCHEN_2",
    name: "Chicken Cheese Kottu",
    nameSinhala: "චිකන් චීස් කොත්තු",
    description: "Chopped roti with chicken and cheese",
    costPrice: 500,
    sellingPrice: 950,
    imageUrl: null,
    isAvailable: true,
    hasPortionPricing: true,
    portionPrices: { SMALL: 950, MEDIUM: 1150, LARGE: 1350 },
    recipe: [],
    effectiveSellingPrice: 1150,
    skipKitchenTicket: false,
    createdAt: nowIso(),
    updatedAt: null,
  },
  {
    productId: 202,
    categoryId: 2,
    kitchen: "KITCHEN_2",
    name: "Vegetable Noodles",
    nameSinhala: "එළවලු නූඩ්ල්ස්",
    description: "Stir-fried noodles with mixed vegetables",
    costPrice: 280,
    sellingPrice: 650,
    imageUrl: null,
    isAvailable: true,
    hasPortionPricing: false,
    portionPrices: {},
    recipe: [],
    effectiveSellingPrice: 650,
    skipKitchenTicket: false,
    createdAt: nowIso(),
    updatedAt: null,
  },
  {
    productId: 301,
    categoryId: 3,
    kitchen: "KITCHEN_1",
    name: "Iced Coffee",
    nameSinhala: "අයිස් කෝපි",
    description: "Chilled coffee — bill only, no kitchen ticket",
    costPrice: 120,
    sellingPrice: 450,
    imageUrl: null,
    isAvailable: true,
    hasPortionPricing: false,
    portionPrices: {},
    recipe: [],
    effectiveSellingPrice: 450,
    skipKitchenTicket: true,
    createdAt: nowIso(),
    updatedAt: null,
  },
  {
    productId: 302,
    categoryId: 3,
    kitchen: "KITCHEN_1",
    name: "Lemon Juice",
    nameSinhala: "දෙහි ජුස්",
    description: "Fresh lime — bill only",
    costPrice: 80,
    sellingPrice: 350,
    imageUrl: null,
    isAvailable: true,
    hasPortionPricing: false,
    portionPrices: {},
    recipe: [],
    effectiveSellingPrice: 350,
    skipKitchenTicket: true,
    createdAt: nowIso(),
    updatedAt: null,
  },
]

function loadOrders(): OrderResponseDto[] {
  return loadJson<OrderResponseDto[]>(DEMO_KEYS.orders, [])
}

function saveOrders(orders: OrderResponseDto[]) {
  saveJson(DEMO_KEYS.orders, orders)
}

function loadOrderItems(): OrderItemResponseDto[] {
  return loadJson<OrderItemResponseDto[]>(DEMO_KEYS.orderItems, [])
}

function saveOrderItems(items: OrderItemResponseDto[]) {
  saveJson(DEMO_KEYS.orderItems, items)
}

export function demoGetAllCategories(): CategoryResponseDto[] {
  return [...DEMO_CATEGORIES]
}

export function demoGetAllProducts(): ProductResponseDto[] {
  return [...DEMO_PRODUCTS]
}

export function demoCreateOrder(payload: OrderRequestDto): OrderResponseDto {
  const orderId = nextId(ORDER_ID_KEY, 9001)
  const ts = nowIso()
  const order: OrderResponseDto = {
    orderId,
    tableNumber: payload.tableNumber,
    totalAmount: payload.totalAmount,
    taxAmount: payload.taxAmount,
    discountAmount: payload.discountAmount,
    paymentMethod: payload.paymentMethod,
    status: payload.status,
    orderType: payload.orderType,
    kitchen: payload.kitchen,
    orderDate: ts,
    createdAt: ts,
    updatedAt: null,
    items: payload.items,
  }
  const orders = loadOrders()
  orders.unshift(order)
  saveOrders(orders)
  return order
}

export function demoGetAllOrders(): OrderResponseDto[] {
  return loadOrders()
}

export function demoCreateOrderItem(payload: OrderItemRequestDto): OrderItemResponseDto {
  const orderItemId = nextId(ORDER_ITEM_ID_KEY, 50001)
  const ts = nowIso()
  const item: OrderItemResponseDto = {
    orderItemId,
    orderId: payload.orderId,
    productId: payload.productId,
    quantity: payload.quantity,
    portionType: payload.portionType ?? null,
    unitPrice: payload.unitPrice,
    subtotal: payload.subtotal,
    createdAt: ts,
    updatedAt: null,
  }
  const items = loadOrderItems()
  items.push(item)
  saveOrderItems(items)
  return item
}

export function demoGetAllOrderItems(): OrderItemResponseDto[] {
  return loadOrderItems()
}

export function demoDeleteOrderItem(orderItemId: number): void {
  saveOrderItems(loadOrderItems().filter((i) => i.orderItemId !== orderItemId))
}
