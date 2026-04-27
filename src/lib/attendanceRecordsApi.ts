import api from "@/axios"
import { PAID_LEAVE_DAYS_PER_MONTH } from "@/lib/employeesApi"

export type AttendanceStatus = "PRESENT" | "LEAVE" | "ABSENT"

export type AttendanceRecord = {
  attendanceId: number
  empId: number
  attendanceDate: string
  status: AttendanceStatus
  createdAt: string
  updatedAt?: string
}

export type AttendanceFilterParams = {
  empId?: number
  startDate?: string
  endDate?: string
  status?: AttendanceStatus
  page?: number
  size?: number
}

function toStatus(raw: unknown): AttendanceStatus {
  const value = String(raw ?? "").toUpperCase()
  if (value === "LEAVE") return "LEAVE"
  if (value === "ABSENT") return "ABSENT"
  return "PRESENT"
}

function normalizeRecord(raw: any): AttendanceRecord {
  return {
    attendanceId: Number(raw?.attendanceId ?? raw?.id ?? 0),
    empId: Number(raw?.empId ?? raw?.employeeId ?? 0),
    attendanceDate: String(raw?.attendanceDate ?? raw?.date ?? ""),
    status: toStatus(raw?.status),
    createdAt: String(raw?.createdAt ?? ""),
    updatedAt: raw?.updatedAt != null ? String(raw.updatedAt) : undefined,
  }
}

export async function getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
  const resp = await api.get("/attendance/filter")
  const payload = Array.isArray(resp?.data) ? resp.data : []
  return payload.map(normalizeRecord)
}

export async function getAttendanceById(id: number): Promise<AttendanceRecord> {
  const resp = await api.get(`/attendance/${id}`)
  return normalizeRecord(resp?.data)
}

export async function createAttendanceRecord(input: {
  empId: number
  attendanceDate: string
  status: AttendanceStatus
}): Promise<AttendanceRecord> {
  const payload = {
    empId: Number(input.empId),
    attendanceDate: String(input.attendanceDate).trim(),
    status: toStatus(input.status),
  }
  console.log("Creating attendance record with payload:", payload)
  const resp = await api.post("/attendance", payload)
  return normalizeRecord(resp?.data)
}

export async function updateAttendanceRecord(
  id: number,
  input: {
    empId: number
    attendanceDate: string
    status: AttendanceStatus
  },
): Promise<AttendanceRecord> {
  const payload = {
    empId: Number(input.empId),
    attendanceDate: String(input.attendanceDate).trim(),
    status: toStatus(input.status),
  }
  const resp = await api.put(`/attendance/${id}`, payload)
  return normalizeRecord(resp?.data)
}

export async function deleteAttendanceRecord(id: number): Promise<void> {
  await api.delete(`/attendance/${id}`)
}

export async function filterAttendanceRecords(params: AttendanceFilterParams): Promise<AttendanceRecord[]> {
  const qp: Record<string, string | number> = {}
  if (params.empId != null && Number.isFinite(params.empId)) qp.empId = params.empId
  if (params.startDate) qp.startDate = params.startDate.trim()
  if (params.endDate) qp.endDate = params.endDate.trim()
  if (params.status) qp.status = params.status
  if (params.page != null) qp.page = params.page
  if (params.size != null) qp.size = params.size
  const resp = await api.get("/attendance/filter", { params: qp })
  const payload = Array.isArray(resp?.data) ? resp.data : []
  return payload.map(normalizeRecord)
}

/** yyyy-mm for month key */
export function yearMonthFromDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export async function upsertAttendanceForDay(
  empId: number,
  attendanceDate: string,
  status: AttendanceStatus,
): Promise<AttendanceRecord> {
  const cleanDate = String(attendanceDate).trim()

  // Some backends reject startDate/endDate filter combinations with 400.
  // Query by employee first, then match day client-side.
  try {
    const existingForEmployee = await filterAttendanceRecords({ empId })
    const sameDay = existingForEmployee.find((r) => String(r.attendanceDate).trim() === cleanDate)
    if (sameDay) {
      return updateAttendanceRecord(sameDay.attendanceId, { empId, attendanceDate: cleanDate, status })
    }
  } catch {
    // Continue with create fallback below.
  }

  try {
    return createAttendanceRecord({ empId, attendanceDate: cleanDate, status })
  } catch (error: any) {
    const code = Number(error?.response?.status)
    // If create fails due duplicate/conflict semantics, retry update path.
    if (code === 409 || code === 400) {
      const existingForEmployee = await filterAttendanceRecords({ empId })
      const sameDay = existingForEmployee.find((r) => String(r.attendanceDate).trim() === cleanDate)
      if (sameDay) {
        return updateAttendanceRecord(sameDay.attendanceId, { empId, attendanceDate: cleanDate, status })
      }
    }
    throw error
  }
}

export function summarizeMonth(records: AttendanceRecord[], empId: number, ym: string) {
  const rows = records.filter((r) => r.empId === empId && r.attendanceDate.startsWith(ym))
  let present = 0
  let leave = 0
  let absent = 0
  for (const r of rows) {
    if (r.status === "PRESENT") present++
    else if (r.status === "LEAVE") leave++
    else absent++
  }
  const paidLeaveDays = Math.min(leave, PAID_LEAVE_DAYS_PER_MONTH)
  const unpaidLeaveDays = Math.max(0, leave - PAID_LEAVE_DAYS_PER_MONTH)
  const paidDays = present + paidLeaveDays
  return { present, leave, absent, paidLeaveDays, unpaidLeaveDays, paidDays }
}

export function payrollForMonth(paymentPerDay: number, summary: ReturnType<typeof summarizeMonth>) {
  return Math.round(summary.paidDays * paymentPerDay * 100) / 100
}

export type MonthPayrollBreakdown = {
  grossLkr: number
  deductionLkr: number
  netLkr: number
}

/** Gross from attendance × daily rate, minus manual loan/advance recovery (per employee, per month in settings). */
export function netPayrollForMonth(
  paymentPerDay: number,
  monthlyDeductionLkr: number,
  summary: ReturnType<typeof summarizeMonth>,
): MonthPayrollBreakdown {
  const grossLkr = payrollForMonth(paymentPerDay, summary)
  const deductionLkr = Math.max(0, monthlyDeductionLkr)
  const netLkr = Math.max(0, Math.round((grossLkr - deductionLkr) * 100) / 100)
  return { grossLkr, deductionLkr, netLkr }
}
