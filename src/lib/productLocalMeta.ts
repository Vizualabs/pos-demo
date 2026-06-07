import { loadJson, saveJson } from "@/lib/demoPersistence"
import type { Kitchen } from "@/lib/ordersApi"

const STORAGE_KEY = "pos_product_meta_v1"

export type ProductLocalMeta = {
  kitchen?: Kitchen
  /** Showcase / drinks: cashier bill only — no kitchen ticket */
  skipKitchenTicket?: boolean
  /** Sinhala name printed on kitchen tickets */
  nameSinhala?: string | null
}

type MetaMap = Record<string, ProductLocalMeta>

function loadMap(): MetaMap {
  return loadJson<MetaMap>(STORAGE_KEY, {})
}

function saveMap(map: MetaMap): void {
  saveJson(STORAGE_KEY, map)
}

export function getProductLocalMeta(productId: number): ProductLocalMeta | undefined {
  return loadMap()[String(productId)]
}

export function setProductLocalMeta(productId: number, patch: ProductLocalMeta): void {
  const map = loadMap()
  const key = String(productId)
  map[key] = { ...map[key], ...patch }
  saveMap(map)
}

export function removeProductLocalMeta(productId: number): void {
  const map = loadMap()
  delete map[String(productId)]
  saveMap(map)
}

/** @deprecated normalizeProduct + resolveKitchen already merge local fallback when API omits fields. */
export function mergeProductLocalMeta<
  T extends { productId: number; kitchen: Kitchen; skipKitchenTicket: boolean },
>(product: T): T {
  return product
}
