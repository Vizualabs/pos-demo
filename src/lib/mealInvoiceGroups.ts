const STORAGE_KEY = "posMealInvoiceGroups"

export type MealInvoiceGroupRecord = {
  groupId: string
  invoiceIds: number[]
  createdAt: string
}

type Store = Record<string, MealInvoiceGroupRecord>

function readStore(): Store {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function saveMealInvoiceGroup(record: MealInvoiceGroupRecord): void {
  const store = readStore()
  store[record.groupId] = record
  writeStore(store)
}

export function removeMealInvoiceGroup(groupId: string): void {
  const store = readStore()
  delete store[groupId]
  writeStore(store)
}

export function loadAllMealInvoiceGroups(): MealInvoiceGroupRecord[] {
  return Object.values(readStore())
}

export function findGroupIdForInvoiceId(invoiceId: number): string | null {
  for (const g of loadAllMealInvoiceGroups()) {
    if (g.invoiceIds.includes(invoiceId)) return g.groupId
  }
  return null
}
