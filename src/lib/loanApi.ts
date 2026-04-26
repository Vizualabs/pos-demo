import api from "@/axios"

export type Loan = {
  loanId: number
  empId: number
  loanAmount: number
  loanDate: string
  paidAmount: number
  balance?: number
  createdAt?: string
  updatedAt?: string
}

function normalizeLoan(d: any): Loan {
  const loanId = d?.loanId ?? d?.id ?? d?.loan_id
  const empId = d?.empId ?? d?.emp_id ?? d?.employeeId ?? d?.employee_id
  const loanAmount = Number(d?.loanAmount ?? d?.loan_amount ?? 0)
  const paidAmount = Number(d?.paidAmount ?? d?.paid_amount ?? 0)
  const balance = Number(d?.balance ?? (loanAmount - paidAmount))
  return {
    loanId: Number(loanId),
    empId: Number(empId),
    loanAmount,
    loanDate: d?.loanDate ?? d?.loan_date ?? String(d?.loanDate ?? ""),
    paidAmount,
    balance,
    createdAt: d?.createdAt ?? d?.created_at,
    updatedAt: d?.updatedAt ?? d?.updated_at,
  }
}

export async function getAllLoans(): Promise<Loan[]> {
  const resp = await api.get('/loans')
  const data = resp?.data ?? []
  if (!Array.isArray(data)) throw new Error('Invalid loans response')
  return data.map(normalizeLoan)
}

export async function getLoansByEmployee(empId: number): Promise<Loan[]> {
  const resp = await api.get(`/loans/employee/${empId}`)
  const data = resp?.data ?? []
  if (!Array.isArray(data)) throw new Error('Invalid loans response')
  return data.map(normalizeLoan)
}

export async function getLoanById(id: number): Promise<Loan> {
  const resp = await api.get(`/loans/${id}`)
  const data = resp?.data ?? {}
  return normalizeLoan(data)
}

export async function updateLoan(id: number, payload: { empId: number; loanDate: string; loanAmount: number; paidAmount: number }): Promise<Loan> {
  const resp = await api.put(`/loans/${id}`, payload)
  const data = resp?.data ?? {}
  return normalizeLoan(data)
}

export async function patchLoan(id: number, patch: Record<string, unknown>): Promise<Loan> {
  const resp = await api.patch(`/loans/${id}`, patch)
  const data = resp?.data ?? {}
  return normalizeLoan(data)
}

export async function deleteLoan(id: number): Promise<void> {
  await api.delete(`/loans/${id}`)
}

export async function addLoanPayment(id: number, receivedAmount: number): Promise<Loan> {
  const resp = await api.post(`/loans/${id}/payments`, { receivedAmount })
  const data = resp?.data ?? {}
  return normalizeLoan(data)
}

export async function createLoan(payload: { empId: number; loanDate: string; loanAmount: number; paidAmount?: number }): Promise<Loan> {
  const body = {
    empId: payload.empId,
    loanDate: payload.loanDate,
    loanAmount: payload.loanAmount,
    paidAmount: payload.paidAmount ?? 0,
  }
  const resp = await api.post('/loans', body)
  const data = resp?.data ?? {}
  return normalizeLoan(data)
}

export default {
  getAllLoans,
  getLoansByEmployee,
  getLoanById,
  updateLoan,
  patchLoan,
  deleteLoan,
  addLoanPayment,
  createLoan,
}
