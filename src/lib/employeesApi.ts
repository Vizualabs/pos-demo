import { DEMO_KEYS, loadJson, nowIso, saveJson } from "@/lib/demoPersistence"
import api from "@/axios"

export type Employee = {
  /** Server business identifier (optional) */
  empCode?: string
  /** Server numeric id (empId / id) if available */
  empId?: number
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
    empCode: e.empCode !== undefined && e.empCode !== null ? String(e.empCode) : undefined,
    empId: typeof e.empId === 'number' && Number.isFinite(e.empId) ? e.empId : undefined,
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

/**
 * Fetch all employees from remote API and map to local Employee shape.
 * Throws on network/HTTP errors.
 */
export async function getAllEmployeesRemote(): Promise<Employee[]> {
  const resp = await api.get('/employees')
  const data = resp?.data ?? []
  if (!Array.isArray(data)) throw new Error('Invalid employees response')

  const mapped = data.map((d: any) => {
    const employeeId = d?.empCode ?? d?.employeeId ?? (d?.id != null ? String(d.id) : `EMP-${Date.now()}`)
    const empId = d?.empId ?? d?.id ?? d?.emp_id ?? undefined
    return normalizeEmployee({
      employeeId: String(employeeId),
      empCode: d?.empCode ?? d?.emp_code ?? undefined,
      empId: empId != null ? Number(empId) : undefined,
      name: d?.name ?? '',
      role: d?.role ?? '',
      paymentPerDay: Number(d?.paymentPerDay ?? d?.payment_per_day ?? 0),
      monthlyLoanAdvanceDeductionLkr: 0,
      createdAt: d?.createdAt ?? d?.created_at ?? nowIso(),
    })
  })

  return mapped
}

/**
 * Fetch a single employee by id (id or empCode) from remote API and map to local shape.
 */
export async function getEmployeeByIdRemote(id: string | number): Promise<Employee> {
  const resp = await api.get(`/employees/${id}`)
  const d = resp?.data ?? {}
  const employeeId = d?.empCode ?? d?.employeeId ?? (d?.id != null ? String(d.id) : String(id))
    const empId = d?.empId ?? d?.id ?? d?.emp_id ?? undefined
    return normalizeEmployee({
      employeeId: String(employeeId),
      empCode: d?.empCode ?? d?.emp_code ?? undefined,
      empId: empId != null ? Number(empId) : undefined,
      name: d?.name ?? '',
      role: d?.role ?? '',
      paymentPerDay: Number(d?.paymentPerDay ?? d?.payment_per_day ?? 0),
      monthlyLoanAdvanceDeductionLkr: 0,
      createdAt: d?.createdAt ?? d?.created_at ?? nowIso(),
    })
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

/**
 * Create employee using remote API. Sends only the fields present on the Add Employee popup.
 * On success the returned employee is normalized and persisted to demo storage so the UI updates.
 * On failure the error is thrown (no fallback to demo behavior).
 */
export async function createEmployeeRemote(
  input: Omit<Employee, "employeeId" | "createdAt" | "monthlyLoanAdvanceDeductionLkr"> & {
    monthlyLoanAdvanceDeductionLkr?: number
  },
): Promise<Employee> {
  const payload = {
    name: input.name.trim(),
    role: input.role.trim(),
    paymentPerDay: Number(input.paymentPerDay),
  }

  const resp = await api.post('/employees', payload)
  const data = resp?.data ?? {}

  const employeeId = data?.empCode ?? data?.employeeId ?? (data?.id != null ? String(data.id) : `EMP-${Date.now()}`)
  const name = data?.name ?? payload.name
  const role = data?.role ?? payload.role
  const paymentPerDay = Number(data?.paymentPerDay ?? data?.payment_per_day ?? payload.paymentPerDay ?? 0)
  const createdAt = data?.createdAt ?? data?.created_at ?? nowIso()
  const empCode = data?.empCode ?? data?.emp_code ?? undefined
  const empId = data?.empId ?? data?.id ?? data?.emp_id ?? undefined

  const row = normalizeEmployee({
    employeeId: String(employeeId),
    empCode,
    empId: empId != null ? Number(empId) : undefined,
    name,
    role,
    paymentPerDay,
    createdAt,
  })

  // Persist locally so the existing UI (which reads demo storage) will show the new entry.
  const list = readAll()
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

/**
 * Patch employee via remote API. Sends only provided keys to `/employees/{id}` and
 * returns the normalized employee. Persists the updated row to demo storage on success.
 */
export async function patchEmployeeRemote(
  employeeKey: string | number,
  patch: Record<string, unknown>,
): Promise<Employee> {
  // Resolve numeric empId to use in the route
  const resolveEmpId = (key: string | number): number => {
    if (typeof key === 'number' && Number.isFinite(key)) return key
    const s = String(key)
    if (/^[0-9]+$/.test(s)) return Number(s)
    const list = readAll()
    const found = list.find((e) => e.employeeId === s || e.empCode === s)
    if (found && typeof found.empId === 'number') return found.empId
    throw new Error(`Could not resolve empId for ${s}`)
  }

  const empId = resolveEmpId(employeeKey)

  // Only send fields allowed for update from the UI
  const allowed = ['name', 'role', 'paymentPerDay']
  const payload: Record<string, unknown> = {}
  for (const k of allowed) {
    if ((patch as any)[k] !== undefined) payload[k] = (patch as any)[k]
  }
  if (Object.keys(payload).length === 0) throw new Error('No updatable fields provided')

  const resp = await api.patch(`/employees/${empId}`, payload)
  const data = resp?.data ?? {}

  const resolvedId = data?.empCode ?? data?.employeeId ?? (data?.id != null ? String(data.id) : String(empId))
  const empIdResolved = data?.empId ?? data?.id ?? data?.emp_id ?? empId
  const row = normalizeEmployee({
    employeeId: String(resolvedId),
    empCode: data?.empCode ?? data?.emp_code ?? undefined,
    empId: empIdResolved != null ? Number(empIdResolved) : undefined,
    name: data?.name ?? (payload?.name as string) ?? '',
    role: data?.role ?? (payload?.role as string) ?? '',
    paymentPerDay: Number(data?.paymentPerDay ?? data?.payment_per_day ?? (payload?.paymentPerDay as number) ?? 0),
    monthlyLoanAdvanceDeductionLkr:
      Number(data?.monthlyLoanAdvanceDeductionLkr ?? data?.monthly_loan_advance_deduction_lkr ?? 0),
    createdAt: data?.createdAt ?? data?.created_at ?? nowIso(),
  })

  const list = readAll()
  const idx = list.findIndex((e) => e.employeeId === row.employeeId || (row.empCode && e.empCode === row.empCode) || (row.empId && e.empId === row.empId))
  if (idx >= 0) list[idx] = row
  else list.unshift(row)
  writeAll(list)

  return row
}

/**
 * Delete employee via remote API. Removes the employee from demo storage on success.
 */
export async function deleteEmployeeRemote(employeeKey: string | number): Promise<void> {
  const resolveEmpId = (key: string | number): number => {
    if (typeof key === 'number' && Number.isFinite(key)) return key
    const s = String(key)
    if (/^[0-9]+$/.test(s)) return Number(s)
    const list = readAll()
    const found = list.find((e) => e.employeeId === s || e.empCode === s)
    if (found && typeof found.empId === 'number') return found.empId
    throw new Error(`Could not resolve empId for ${s}`)
  }

  const empId = resolveEmpId(employeeKey)

  const resp = await api.delete(`/employees/${empId}`)
  const data = resp?.data ?? null

  const removeEmpId = data && typeof data === 'object' ? (data?.empId ?? data?.id ?? data?.emp_id ?? empId) : empId
  const removeEmpCode = data && typeof data === 'object' ? (data?.empCode ?? data?.emp_code ?? undefined) : undefined

  const list = readAll()
  const next = list.filter((e) => e.empId !== Number(removeEmpId) && e.empCode !== removeEmpCode && e.employeeId !== String(removeEmpId))
  writeAll(next)
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  const list = readAll()
  const next = list.filter((e) => e.employeeId !== employeeId)
  if (next.length === list.length) throw new Error("Employee not found")
  writeAll(next)
}
