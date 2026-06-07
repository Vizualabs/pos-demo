import type { PortionSize } from "@/lib/productsApi"

/** Short portion labels for bills, KOT, and POS (S / M / L). */
export function portionLabelShort(size: PortionSize | null | undefined): string | undefined {
  if (size === "SMALL") return "S"
  if (size === "MEDIUM") return "M"
  if (size === "LARGE") return "L"
  return undefined
}
