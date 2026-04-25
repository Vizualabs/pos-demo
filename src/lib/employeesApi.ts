import { DEMO_KEYS, loadJson, nowIso, saveJson } from "@/lib/demoPersistence"

export type Employee = {
  employeeId: string
  username: string
  fullName: string
  role: string
  paymentPerDay: number
  /** Manually set monthly recovery (loans / salary advance); subtracted from gross in payroll. */
  monthlyLoanAdvanceDeductionLkr: number
  createdAt: string
}

const PAID_LEAVE_DAYS_PER_MONTH = 4

export { PAID_LEAVE_DAYS_PER_MONTH }

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    employeeId: "EMP-DEMO-1",
    username: "nperera",
    fullName: "Nishantha Perera",
    role: "Head Chef",
    paymentPerDay: 4500,
    monthlyLoanAdvanceDeductionLkr: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    employeeId: "EMP-DEMO-2",
    username: "swickrama",
    fullName: "Sanduni Wickramasinghe",
    role: "Cashier",
    paymentPerDay: 3200,
    monthlyLoanAdvanceDeductionLkr: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]

function normalizeEmployee(e: Partial<Employee> & { employeeId: string }): Employee {
  const ded = e.monthlyLoanAdvanceDeductionLkr
  return {
    employeeId: String(e.employeeId),
    username: String(e.username ?? "").trim() || "unnamed_user",
    fullName: String(e.fullName ?? "").trim() || "Unnamed",
    role: String(e.role ?? "").trim() || "—",
    paymentPerDay: Math.max(0, Number(e.paymentPerDay ?? 0)),
    monthlyLoanAdvanceDeductionLkr:
      typeof ded === "number" && Number.isFinite(ded) ? Math.max(0, ded) : 0,
    createdAt: String(e.createdAt ?? nowIso()),
  }
}

/** One-time: old seeded Sinhala demo names → English (only if name still matches). */
const LEGACY_SINHALA_TO_ENGLISH: Record<string, { from: string; to: string }> = {
  "EMP-DEMO-1": { from: "නිශාන්ත පෙරේරා", to: "Nishantha Perera" },
  "EMP-DEMO-2": { from: "සඳුනි වික්‍රමසිංහ", to: "Sanduni Wickramasinghe" },
}

function readAll(): Employee[] {
  const raw = loadJson<Employee[]>(DEMO_KEYS.employees, [])
  if (!Array.isArray(raw) || raw.length === 0) {
    saveJson(DEMO_KEYS.employees, DEFAULT_EMPLOYEES)
    return [...DEFAULT_EMPLOYEES]
  }
  let changed = false
  const migrated = raw.map((e: any) => {
    const leg = LEGACY_SINHALA_TO_ENGLISH[e.employeeId]
    // Handle legacy migration from Sinhala to English
    if (leg && e.fullName === leg.from) {
      changed = true
      return { ...e, fullName: leg.to }
    }
    // Migrate old 'name' field to 'fullName'
    if (e.name && !e.fullName) {
      changed = true
      return { ...e, fullName: e.name }
    }
    // Generate username from fullName if missing
    if (!e.username && e.fullName) {
      changed = true
      const username = e.fullName
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .join(".")
      return { ...e, username }
    }
    return e
  })
  const normalized = migrated.map((e) => normalizeEmployee(e as Partial<Employee> & { employeeId: string }))
  const needSchemaUpgrade =
    raw.some((e: any) => (e as { monthlyLoanAdvanceDeductionLkr?: number }).monthlyLoanAdvanceDeductionLkr == null) ||
    raw.some((e: any) => !e.username || !e.fullName)
  if (changed || needSchemaUpgrade) saveJson(DEMO_KEYS.employees, normalized)
  return normalized
}

function writeAll(list: Employee[]) {
  saveJson(DEMO_KEYS.employees, list)
}

export async function getAllEmployees(): Promise<Employee[]> {
  return readAll()
}

export async function createEmployee(
  input: Omit<Employee, "employeeId" | "createdAt" | "monthlyLoanAdvanceDeductionLkr"> & {
    monthlyLoanAdvanceDeductionLkr?: number
  },
): Promise<Employee> {
  const list = readAll()
  const row = normalizeEmployee({
    employeeId: `EMP-${Date.now()}`,
    username: input.username.trim(),
    fullName: input.fullName.trim(),
    role: input.role.trim(),
    paymentPerDay: Math.max(0, input.paymentPerDay),
    monthlyLoanAdvanceDeductionLkr:
      typeof input.monthlyLoanAdvanceDeductionLkr === "number" && Number.isFinite(input.monthlyLoanAdvanceDeductionLkr)
        ? Math.max(0, input.monthlyLoanAdvanceDeductionLkr)
        : 0,
    createdAt: nowIso(),
  })
  writeAll([row, ...list])
  return row
}

export async function patchEmployee(
  employeeId: string,
  patch: Partial<Pick<Employee, "username" | "fullName" | "role" | "paymentPerDay" | "monthlyLoanAdvanceDeductionLkr">>,
): Promise<Employee> {
  const list = readAll().map((e) => normalizeEmployee(e))
  const idx = list.findIndex((e) => e.employeeId === employeeId)
  if (idx < 0) throw new Error("Employee not found")
  const cur = list[idx]
  const next = normalizeEmployee({
    ...cur,
    username: patch.username !== undefined ? patch.username : cur.username,
    fullName: patch.fullName !== undefined ? patch.fullName : cur.fullName,
    role: patch.role !== undefined ? patch.role : cur.role,
    paymentPerDay: patch.paymentPerDay !== undefined ? patch.paymentPerDay : cur.paymentPerDay,
    monthlyLoanAdvanceDeductionLkr:
      patch.monthlyLoanAdvanceDeductionLkr !== undefined
        ? patch.monthlyLoanAdvanceDeductionLkr
        : cur.monthlyLoanAdvanceDeductionLkr,
  })
  list[idx] = next
  writeAll(list)
  return next
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  const list = readAll()
  const next = list.filter((e) => e.employeeId !== employeeId)
  if (next.length === list.length) throw new Error("Employee not found")
  writeAll(next)
}
