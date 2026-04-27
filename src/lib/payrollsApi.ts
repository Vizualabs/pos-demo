import api from "@/axios";

export interface LoanPaymentRequestDto {
  loanId: number;
  paidAmount: number;
}

export interface PayrollRequestDto {
  empId: number;
  payrollYear: number;
  payrollMonth: number;
  loans?: LoanPaymentRequestDto[];
}

export interface LoanPaymentResponseDto {
  loanId: number;
  paidAmount: number;
  remainingBalance: number;
}

export interface PayrollResponseDto {
  payrollId: number;
  empId: number;
  payrollYear: number;
  payrollMonth: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  perDaySalaryAmount: number;
  loanDeductionAmount: number;
  grossSalary: number;
  loansPaid: LoanPaymentResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export async function createPayroll(data: PayrollRequestDto): Promise<PayrollResponseDto> {
  const payload = {
    empId: data.empId,
    payrollYear: data.payrollYear,
    payrollMonth: data.payrollMonth,
    loanPayments: data.loans?.map(loan => ({
      loanId: loan.loanId,
      receivedAmount: loan.paidAmount
    }))
  };
  const response = await api.post('/payrolls', payload);
  return response.data;
}

export async function getAllPayrolls(): Promise<PayrollResponseDto[]> {
  const response = await api.get('/payrolls');
  return response.data;
}

export async function getPayrollById(id: number): Promise<PayrollResponseDto> {
  const response = await api.get(`/payrolls/${id}`);
  return response.data;
}

export async function deletePayroll(id: number): Promise<void> {
  await api.delete(`/payrolls/${id}`);
}
