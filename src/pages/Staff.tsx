import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, DollarSign, Calendar, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllPayrolls, createPayroll, type PayrollResponseDto } from "@/lib/payrollsApi";
import {
  createEmployeeRemote,
  deleteEmployeeRemote,
  getAllEmployeesRemote,
  patchEmployeeRemote,
  PAID_LEAVE_DAYS_PER_MONTH,
  type Employee,
} from "@/lib/employeesApi";
import {
  getLoansByEmployee,
  updateLoan,
  patchLoan,
  deleteLoan,
  addLoanPayment,
  createLoan,
} from "@/lib/loanApi"

/** Rough calendar-month payroll if every paid day matched a worked or paid-leave day (see Attendance). */
const ASSUMED_WORK_DAYS_PER_MONTH = 22;

const Staff = () => {
  const [staffMembers, setStaffMembers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const [newStaff, setNewStaff] = useState({
    empCode: "",
    name: "",
    role: "",
    paymentPerDay: "",
  });

  const [detailStaff, setDetailStaff] = useState<Employee | null>(null);
  const [detailForm, setDetailForm] = useState({
    empCode: "",
    name: "",
    role: "",
    paymentPerDay: "",
  });
  const [detailSaving, setDetailSaving] = useState(false);
  const [loanOpenFor, setLoanOpenFor] = useState<Employee | null>(null)
  const [loans, setLoans] = useState<any[]>([])
  const [loansLoading, setLoansLoading] = useState(false)
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null)
  const [loanEditForm, setLoanEditForm] = useState<{ loanAmount: string; loanDate: string; paidAmount: string; type: string }>({ loanAmount: '', loanDate: '', paidAmount: '', type: '' })
  const [loanNewForm, setLoanNewForm] = useState<{ loanAmount: string; loanDate: string; type: string }>({ loanAmount: '', loanDate: '', type: 'LOAN' })
  const [payrolls, setPayrolls] = useState<PayrollResponseDto[]>([]);
  const [payrollsLoading, setPayrollsLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({ empId: '', year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString() });
  const [generateLoans, setGenerateLoans] = useState<any[]>([]);
  const [generateLoansLoading, setGenerateLoansLoading] = useState(false);
  const [generateSubmitting, setGenerateSubmitting] = useState(false);
  const [payrollsFilter, setPayrollsFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAllEmployeesRemote();
      setStaffMembers(list);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load employees from server', err)
      toast.error('Could not load employees from server.')
      setStaffMembers([])
    } finally {
      setLoading(false);
    }
  };

  const openLoansFor = async (emp: Employee) => {
    // need numeric empId
    const empId = emp.empId
    if (!empId) {
      toast.error('Employee has no numeric empId; cannot load loans')
      return
    }
    setLoanOpenFor(emp)
    setLoansLoading(true)
    try {
      const list = await getLoansByEmployee(empId)
      setLoans(list)
    } catch (err) {
      console.error(err)
      toast.error('Could not load loans')
      setLoans([])
    } finally {
      setLoansLoading(false)
    }
  }

  const closeLoans = () => {
    setLoanOpenFor(null)
    setLoans([])
    setEditingLoanId(null)
  }

  const handleDeleteLoan = async (loanId: number) => {
    if (!window.confirm('Delete this loan?')) return
    try {
      // optimistic UI update
      setLoans((prev) => prev.filter((x) => x.loanId !== loanId))
      await deleteLoan(loanId)
      toast.success('Loan deleted')
      // ensure fresh data from server
      if (loanOpenFor?.empId) {
        try {
          const list = await getLoansByEmployee(loanOpenFor.empId)
          setLoans(list)
        } catch (err) {
          // keep optimistic removal if refresh failed
          console.error('Could not refresh loans after delete', err)
        }
      }
    } catch (err) {
      console.error(err)
      toast.error('Could not delete loan')
    }
  }

  const handleAddPayment = async (loanId: number) => {
    const input = window.prompt('Payment amount (LKR)')
    if (!input) return
    const amt = Number.parseFloat(input)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    try {
      await addLoanPayment(loanId, amt)
      toast.success('Payment added')
      if (loanOpenFor?.empId) {
        const list = await getLoansByEmployee(loanOpenFor.empId)
        setLoans(list)
      }
    } catch (err) {
      console.error(err)
      toast.error('Could not add payment')
    }
  }

  const handleCreateLoan = async () => {
    if (!loanOpenFor?.empId) {
      toast.error('Employee has no numeric empId; cannot create loan')
      return
    }
    const loanAmount = Number.parseFloat(loanNewForm.loanAmount)
    const paidAmount = 0
    const loanDate = loanNewForm.loanDate
    if (!loanDate || !Number.isFinite(loanAmount) || loanAmount <= 0) {
      toast.error('Provide a valid date and loan amount')
      return
    }
    try {
      await createLoan({ empId: loanOpenFor.empId, loanDate, loanAmount, paidAmount, type: loanNewForm.type })
      toast.success('Loan created')
      const list = await getLoansByEmployee(loanOpenFor.empId)
      setLoans(list)
      setLoanNewForm({ loanAmount: '', loanDate: '' })
    } catch (err) {
      console.error(err)
      toast.error('Could not create loan')
    }
  }

  const startEditLoan = (l: any) => {
    setEditingLoanId(l.loanId)
    setLoanEditForm({ loanAmount: String(l.loanAmount), loanDate: l.loanDate ?? '', paidAmount: String(l.paidAmount ?? 0), type: l.type ?? 'LOAN' })
  }

  const saveEditedLoan = async (loanId: number) => {
    const payload = {
      empId: loanOpenFor?.empId ?? 0,
      loanDate: loanEditForm.loanDate,
      loanAmount: Number(loanEditForm.loanAmount),
      paidAmount: Number(loanEditForm.paidAmount),
      type: loanEditForm.type,
    }
    try {
      await updateLoan(loanId, payload)
      toast.success('Loan updated')
      if (loanOpenFor?.empId) {
        const list = await getLoansByEmployee(loanOpenFor.empId)
        setLoans(list)
      }
      setEditingLoanId(null)
    } catch (err) {
      console.error(err)
      toast.error('Could not update loan')
    }
  }

  const loadPayrolls = async () => {
    setPayrollsLoading(true);
    try {
      const data = await getAllPayrolls();
      setPayrolls(data);
    } catch (err) {
      console.error(err);
      toast.error("Could not load payrolls.");
    } finally {
      setPayrollsLoading(false);
    }
  };

  const handleSelectGenerateEmployee = async (empIdStr: string) => {
    setGenerateForm(s => ({ ...s, empId: empIdStr }));
    const empId = Number(empIdStr);
    if (!empId) {
      setGenerateLoans([]);
      return;
    }
    setGenerateLoansLoading(true);
    try {
      const empLoans = await getLoansByEmployee(empId);
      const activeLoans = empLoans.filter(l => (l.balance ?? 0) > 0);
      setGenerateLoans(activeLoans.map(l => ({ ...l, inputPaidAmount: '0' })));
    } catch (err) {
      console.error(err);
      toast.error("Could not load loans for employee.");
    } finally {
      setGenerateLoansLoading(false);
    }
  }

  const handleGeneratePayroll = async () => {
    const empId = Number(generateForm.empId);
    const year = Number(generateForm.year);
    const month = Number(generateForm.month);
    
    if (!empId || !year || !month) {
      toast.error("Employee, Year, and Month are required.");
      return;
    }

    const loanPayments = generateLoans
      .map(l => ({ loanId: l.loanId, paidAmount: Number(l.inputPaidAmount) }))
      .filter(l => l.paidAmount > 0);

    setGenerateSubmitting(true);
    try {
      await createPayroll({
        empId,
        payrollYear: year,
        payrollMonth: month,
        loans: loanPayments.length > 0 ? loanPayments : undefined
      });
      toast.success("Payroll generated successfully.");
      setGenerateOpen(false);
      setGenerateForm({ empId: '', year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString() });
      setGenerateLoans([]);
      void loadPayrolls();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) toast.error("Payroll for this employee and month already exists.");
      else if (status === 400) toast.error("Invalid payroll data (e.g. overpaying a loan).");
      else toast.error("Could not generate payroll.");
      console.error(err);
    } finally {
      setGenerateSubmitting(false);
    }
  };

  useEffect(() => {
    void load();
    void loadPayrolls();
  }, []);

  const estimatedMonthlyPayroll = useMemo(() => {
    return staffMembers.reduce((sum, e) => sum + e.paymentPerDay * ASSUMED_WORK_DAYS_PER_MONTH, 0);
  }, [staffMembers]);

  const filteredPayrolls = useMemo(() => {
    if (!payrollsFilter) return payrolls;
    const [y, m] = payrollsFilter.split('-');
    return payrolls.filter(p => p.payrollYear === Number(y) && p.payrollMonth === Number(m));
  }, [payrolls, payrollsFilter]);

  const payrollStats = useMemo(() => {
    return filteredPayrolls.reduce(
      (acc, p) => {
        acc.totalGross += (p.grossSalary ?? 0);
        acc.totalDeductions += (p.loanDeductionAmount ?? 0);
        acc.count += 1;
        return acc;
      },
      { totalGross: 0, totalDeductions: 0, count: 0 }
    );
  }, [filteredPayrolls]);

  const handleAddStaff = async () => {
    const rate = Number.parseFloat(newStaff.paymentPerDay);
    if (!newStaff.name.trim() || !newStaff.role.trim() || !Number.isFinite(rate) || rate < 0) return;
    try {
      await createEmployeeRemote({
        empCode: newStaff.empCode.trim(),
        name: newStaff.name.trim(),
        role: newStaff.role.trim(),
        paymentPerDay: rate,
      });
      setNewStaff({ empCode: "", name: "", role: "", paymentPerDay: "" });
      await load();
      setAddOpen(false);
      toast.success("Employee created")
    } catch (err) {
      // Prefer specific messages from HTTP status where possible
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.response?.status
      if (status === 409) toast.error("Employee code already exists.")
      else if (status === 400) toast.error("Invalid employee data.")
      else if (status === 401) toast.error("Authentication required.")
      else toast.error("Could not create employee.")
      console.error(err)
    }
  };

  const handleRemove = async (id: string | number) => {
    if (!window.confirm("Remove this employee? Attendance history for this ID stays in local storage.")) return;
    try {
      await deleteEmployeeRemote(id)
      if (
        detailStaff?.employeeId === String(id) ||
        detailStaff?.empCode === String(id) ||
        (typeof id === 'number' && detailStaff?.empId === id)
      ) setDetailStaff(null)
      await load()
      toast.success('Employee removed')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.response?.status
      if (status === 404) toast.error('Employee not found')
      else if (status === 401) toast.error('Authentication required.')
      else toast.error('Could not remove employee.')
      console.error(err)
    }
  };

  const openEmployeeDetail = (e: Employee) => {
    setDetailStaff(e);
    setDetailForm({
      empCode: e.empCode || "",
      name: e.name,
      role: e.role,
      paymentPerDay: String(e.paymentPerDay),
    });
  };

  const handleSaveEmployeeDetail = async () => {
    if (!detailStaff) return;
    const rate = Number.parseFloat(detailForm.paymentPerDay);
    if (!detailForm.name.trim() || !detailForm.role.trim() || !Number.isFinite(rate) || rate < 0) {
      toast.error("Name, role, and a valid daily rate are required.");
      return;
    }
    setDetailSaving(true);
    try {
      const targetId = detailStaff.empId ?? detailStaff.employeeId
      const updated = await patchEmployeeRemote(targetId, {
        name: detailForm.name.trim(),
        role: detailForm.role.trim(),
        paymentPerDay: rate,
      })
      await load()
      setDetailStaff(null)
      toast.success("Employee updated.")
    } catch (err) {
      console.error(err)
      toast.error("Could not save employee.")
    } finally {
      setDetailSaving(false)
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 relative">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Staff &amp; HR Management</h1>
            <p className="text-muted-foreground mt-1">
              Add employees with <strong>daily pay</strong> and <strong>role</strong>. Click an employee&apos;s{" "}
              <strong>name</strong> to set <strong>loan / advance deductions</strong> (manual amount per month). Each staff
              member gets up to <strong>{PAID_LEAVE_DAYS_PER_MONTH} paid leave days per month</strong>; extra leave is{" "}
              <strong>unpaid</strong>. Record daily status and download salary slips from{" "}
              <Link to="/attendance" className="text-primary font-medium underline underline-offset-2">
                Attendance
              </Link>
              .
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shrink-0">
                <UserPlus className="w-4 h-4" />
                Add employee
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add employee</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="staff-fullname">Name</Label>
                  <Input
                    id="staff-fullname"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="staff-role">Role</Label>
                  <Input
                    id="staff-role"
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    placeholder="e.g. Head Chef, Cashier"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="staff-day">Payment per day (LKR)</Label>
                  <Input
                    id="staff-day"
                    type="number"
                    min="0"
                    step="1"
                    value={newStaff.paymentPerDay}
                    onChange={(e) => setNewStaff({ ...newStaff, paymentPerDay: e.target.value })}
                    placeholder="e.g. 4500"
                  />
                </div>
                <p className="text-xs text-muted-foreground rounded-md border border-muted p-3 leading-relaxed">
                  Leave pay rule: only the first <strong>{PAID_LEAVE_DAYS_PER_MONTH}</strong> leave days in a calendar month are
                  paid (same rate as a worked day). Additional leave days in that month are <strong>unpaid</strong>. Use the
                  Attendance page to mark Present / Leave / Absent per day.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={() => void handleAddStaff()}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="staff" className="space-y-4">
          <TabsList>
            <TabsTrigger value="staff" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800 dark:data-[state=active]:bg-green-900/40 dark:data-[state=active]:text-green-400">Staff List</TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800 dark:data-[state=active]:bg-green-900/40 dark:data-[state=active]:text-green-400">Employee Payments</TabsTrigger>
          </TabsList>
          
          <TabsContent value="staff" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Employees</p>
                  <p className="text-3xl font-bold mt-1">{loading ? "—" : staffMembers.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Synced with Attendance</p>
                </div>
                <UserPlus className="w-10 h-10 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Est. monthly payroll (demo)</p>
                  <p className="text-3xl font-bold mt-1">
                    {loading ? "—" : formatCurrencyCompact(estimatedMonthlyPayroll)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ~{ASSUMED_WORK_DAYS_PER_MONTH} paid days × daily rate (before attendance & loan deductions)
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid leave / month</p>
                  <p className="text-3xl font-bold mt-1">{PAID_LEAVE_DAYS_PER_MONTH} days</p>
                  <p className="text-sm text-muted-foreground mt-1">More leave days unpaid</p>
                </div>
                <Calendar className="w-10 h-10 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Employees</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
            ) : (
              <div className="space-y-4">
                {staffMembers.map((staff) => (
                  <div
                    key={staff.empId ?? staff.employeeId}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg flex-wrap gap-3"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                      <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm">
                        {staff.name
                          .split(" ")
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <button
                          type="button"
                          className="font-semibold text-left hover:underline decoration-primary underline-offset-2 text-primary"
                          onClick={() => openEmployeeDetail(staff)}
                        >
                          {staff.name}
                        </button>
                        <div className="mt-1 mb-1">
                          {staff.empCode ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 border border-green-200 dark:border-green-800">
                              {staff.empCode}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-800">
                              -
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{staff.role}</p>
                        {staff.monthlyLoanAdvanceDeductionLkr > 0 ? (
                          <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                            Monthly deduction: {formatCurrency(staff.monthlyLoanAdvanceDeductionLkr ?? 0)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Per day</p>
                        <p className="font-semibold">{formatCurrency(staff.paymentPerDay ?? 0)}</p>
                      </div>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        Attendance linked
                      </Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void handleRemove(staff.empId ?? staff.employeeId)}
                      >
                        Remove
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => void openLoansFor(staff)}
                      >
                        Loan
                      </Button>
                    </div>
                  </div>
                ))}
                {staffMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No employees yet. Add your first team member.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={detailStaff !== null} onOpenChange={(open) => !open && setDetailStaff(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Employee details</DialogTitle>
            </DialogHeader>
            {detailStaff && (
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="det-fullname">Name</Label>
                  <Input
                    id="det-fullname"
                    value={detailForm.name}
                    onChange={(e) => setDetailForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="det-role">Role</Label>
                  <Input
                    id="det-role"
                    value={detailForm.role}
                    onChange={(e) => setDetailForm((f) => ({ ...f, role: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="det-day">Payment per day (LKR)</Label>
                  <Input
                    id="det-day"
                    type="number"
                    min="0"
                    step="1"
                    value={detailForm.paymentPerDay}
                    onChange={(e) => setDetailForm((f) => ({ ...f, paymentPerDay: e.target.value }))}
                  />
                </div>
                {/* Monthly loan / advance deduction removed from details popup per request */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDetailStaff(null)} disabled={detailSaving}>
                    Close
                  </Button>
                  <Button type="button" onClick={() => void handleSaveEmployeeDetail()} disabled={detailSaving}>
                    {detailSaving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={loanOpenFor !== null} onOpenChange={(open) => !open && closeLoans()}>
          <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Loans {loanOpenFor ? `— ${loanOpenFor.name}` : ''}</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Card className="mb-4 border border-green-200 bg-green-50 dark:bg-green-900/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-green-700 dark:text-green-200">Add loan</p>
                      <p className="text-sm text-muted-foreground">Create a new loan record for this employee.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                    <div className="grid gap-1">
                      <Label>Loan date</Label>
                      <Input type="date" value={loanNewForm.loanDate} onChange={(e) => setLoanNewForm((s) => ({ ...s, loanDate: e.target.value }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label>Loan type</Label>
                      <Select value={loanNewForm.type} onValueChange={(value) => setLoanNewForm({ ...loanNewForm, type: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOAN">Loan</SelectItem>
                          <SelectItem value="ADVANCE">Advance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label>Loan amount</Label>
                      <Input type="number" value={loanNewForm.loanAmount} onChange={(e) => setLoanNewForm((s) => ({ ...s, loanAmount: e.target.value }))} />
                    </div>
                    {/* Paid amount removed from add form; default to 0 on create */}
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                    <Button variant="outline" onClick={() => setLoanNewForm({ loanAmount: '', loanDate: '', type: 'LOAN' })}>Clear</Button>
                    <Button onClick={() => void handleCreateLoan()}>Add loan</Button>
                  </div>
                </CardContent>
              </Card>
              {loansLoading ? (
                <p className="text-sm text-muted-foreground py-4">Loading loans…</p>
              ) : loans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No loans for this employee.</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="max-h-[56vh] overflow-y-auto">
                    <table className="min-w-[700px] w-full table-auto">
                      <thead>
                        <tr className="text-left">
                          <th className="px-4 py-2">Loan date</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">Amount</th>
                          <th className="px-4 py-2">Paid</th>
  <th className="px-4 py-2">Balance</th>
  <th className="px-4 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loans.map((l) => (
                          <tr key={l.loanId} className="border-b">
                            <td className="px-4 py-3">{l.loanDate}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                l.type === 'LOAN'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
                              }`}>
                                {l.type}
                              </span>
                            </td>
                            <td className="px-4 py-3">{formatCurrency(l.loanAmount ?? 0)}</td>
                            <td className="px-4 py-3">{formatCurrency(l.paidAmount ?? 0)}</td>
                            <td className="px-4 py-3">{formatCurrency(l.balance ?? 0)}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button size="sm" variant="destructive" onClick={() => void handleDeleteLoan(l.loanId)}>Delete</Button>
                                <Button size="sm" onClick={() => void handleAddPayment(l.loanId)}>Pay</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => closeLoans()}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Attendance portal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Daily <strong className="text-foreground">Present</strong>, <strong className="text-foreground">Leave</strong>, or{" "}
              <strong className="text-foreground">Absent</strong> marks drive the monthly payroll table. Leave days beyond{" "}
              {PAID_LEAVE_DAYS_PER_MONTH} per month do not add to paid days.
            </p>
            <Button asChild variant="default">
              <Link to="/attendance">Open Attendance</Link>
            </Button>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Payrolls in period</p>
                  <p className="text-3xl font-bold mt-1">{payrollStats.count}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Total Gross Payroll</p>
                  <p className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">{formatCurrencyCompact(payrollStats.totalGross)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">Total Loan Deductions</p>
                  <p className="text-3xl font-bold mt-1 text-red-500">{formatCurrencyCompact(payrollStats.totalDeductions)}</p>
                </CardContent>
              </Card>
            </div>
             <Card>
               <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                 <div>
                   <CardTitle>Generated Payrolls</CardTitle>
                 </div>
                 <div className="flex items-center gap-3 flex-wrap">
                   <div className="flex items-center gap-2">
                     <Label className="whitespace-nowrap">Filter Period:</Label>
                     <Input 
                       type="month" 
                       value={payrollsFilter} 
                       onChange={e => setPayrollsFilter(e.target.value)} 
                       className="w-auto h-9"
                     />
                     {payrollsFilter && (
                       <Button variant="ghost" size="sm" onClick={() => setPayrollsFilter('')}>Clear</Button>
                     )}
                   </div>
                  </div>
                 <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                   <DialogTrigger asChild>
                     <Button className="gap-2">
                       <DollarSign className="w-4 h-4" />
                       Generate Payroll
                     </Button>
                   </DialogTrigger>
                   <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Generate Employee Payroll</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Employee</Label>
                            <Select value={generateForm.empId} onValueChange={handleSelectGenerateEmployee}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select employee" />
                              </SelectTrigger>
                              <SelectContent>
                                {staffMembers.map(emp => (
                                  <SelectItem key={emp.empId} value={String(emp.empId)}>
                                    {emp.name} ({emp.empCode || '-'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Year</Label>
                            <Input type="number" value={generateForm.year} onChange={e => setGenerateForm(s => ({ ...s, year: e.target.value }))} />
                          </div>
                          <div className="grid gap-2">
                            <Label>Month (1-12)</Label>
                            <Input type="number" min="1" max="12" value={generateForm.month} onChange={e => setGenerateForm(s => ({ ...s, month: e.target.value }))} />
                          </div>
                        </div>

                        {generateForm.empId && (
                          <div className="mt-4 border rounded-md p-4 bg-muted/50">
                            <h4 className="font-semibold mb-2">Loan Deductions</h4>
                            {generateLoansLoading ? (
                              <p className="text-sm text-muted-foreground">Loading loans...</p>
                            ) : generateLoans.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No active loans for this employee.</p>
                            ) : (
                              <div className="space-y-3">
                                {generateLoans.map((l, i) => (
                                  <div key={l.loanId} className="flex items-center gap-4 bg-background p-3 rounded border">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">Loan #{l.loanId} - {l.loanDate}</p>
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          l.type === 'LOAN'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
                                        }`}>
                                          {l.type}
                                        </span>
                                        <p className="text-xs text-muted-foreground">Balance: {formatCurrency(l.balance ?? 0)}</p>
                                      </div>
                                    </div>
                                    <div className="w-32">
                                      <Label className="text-xs">Deduct Amount</Label>
                                      <Input 
                                        type="number" 
                                        min="0" 
                                        max={l.balance ?? 0} 
                                        value={l.inputPaidAmount}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setGenerateLoans(prev => {
                                            const copy = [...prev];
                                            copy[i].inputPaidAmount = val;
                                            return copy;
                                          })
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
                        <Button onClick={() => void handleGeneratePayroll()} disabled={generateSubmitting}>
                          {generateSubmitting ? "Generating..." : "Generate & Save"}
                        </Button>
                      </div>
                   </DialogContent>
                 </Dialog>
               </CardHeader>
               <CardContent>
                 {payrollsLoading ? (
                   <p className="text-sm text-muted-foreground py-8 text-center">Loading payrolls...</p>
                 ) : filteredPayrolls.length === 0 ? (
                   <p className="text-sm text-muted-foreground py-8 text-center">No payrolls found.</p>
                 ) : (
                   <div className="overflow-x-auto">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead>ID</TableHead>
                           <TableHead>Employee</TableHead>
                           <TableHead>Period</TableHead>
                           <TableHead className="text-center">Present</TableHead>
                           <TableHead className="text-center">Leave</TableHead>
                           <TableHead className="text-center">Absent</TableHead>
                           <TableHead>Per Day</TableHead>
                           <TableHead>Loan Payments</TableHead>
                           <TableHead className="text-right">Gross</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {filteredPayrolls.map(p => {
                           const emp = staffMembers.find(e => e.empId === p.empId);
                           const empName = emp ? emp.name : `Emp #${p.empId}`;
                           return (
                             <TableRow key={p.payrollId}>
                               <TableCell>#{p.payrollId}</TableCell>
                               <TableCell className="font-medium">{empName}</TableCell>
                               <TableCell>{p.payrollYear}-{String(p.payrollMonth).padStart(2, '0')}</TableCell>
                               <TableCell className="text-center">
                                 <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                   {p.presentDays ?? 0}
                                 </span>
                               </TableCell>
                               <TableCell className="text-center">
                                 <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                   {p.leaveDays ?? 0}
                                 </span>
                               </TableCell>
                               <TableCell className="text-center">
                                 <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                                   {p.absentDays ?? 0}
                                 </span>
                               </TableCell>
                               <TableCell>{formatCurrency(p.perDaySalaryAmount ?? 0)}</TableCell>
                               <TableCell className="text-red-500">{(p.loanDeductionAmount ?? 0) > 0 ? formatCurrency(p.loanDeductionAmount ?? 0) : '-'}</TableCell>
                               <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                                 {formatCurrency(p.grossSalary ?? 0)}
                               </TableCell>
                             </TableRow>
                           );
                         })}
                       </TableBody>
                     </Table>
                   </div>
                 )}
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Staff;
