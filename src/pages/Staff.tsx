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
    username: "",
    fullName: "",
    role: "",
    paymentPerDay: "",
  });

  const [detailStaff, setDetailStaff] = useState<Employee | null>(null);
  const [detailForm, setDetailForm] = useState({
    username: "",
    fullName: "",
    role: "",
    paymentPerDay: "",
  });
  const [detailSaving, setDetailSaving] = useState(false);
  const [loanOpenFor, setLoanOpenFor] = useState<Employee | null>(null)
  const [loans, setLoans] = useState<any[]>([])
  const [loansLoading, setLoansLoading] = useState(false)
  const [editingLoanId, setEditingLoanId] = useState<number | null>(null)
  const [loanEditForm, setLoanEditForm] = useState<{ loanAmount: string; loanDate: string; paidAmount: string }>({ loanAmount: '', loanDate: '', paidAmount: '' })
  const [loanNewForm, setLoanNewForm] = useState<{ loanAmount: string; loanDate: string }>({ loanAmount: '', loanDate: '' })

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
      await createLoan({ empId: loanOpenFor.empId, loanDate, loanAmount, paidAmount })
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
    setLoanEditForm({ loanAmount: String(l.loanAmount), loanDate: l.loanDate ?? '', paidAmount: String(l.paidAmount ?? 0) })
  }

  const saveEditedLoan = async (loanId: number) => {
    const payload = {
      empId: loanOpenFor?.empId ?? 0,
      loanDate: loanEditForm.loanDate,
      loanAmount: Number(loanEditForm.loanAmount),
      paidAmount: Number(loanEditForm.paidAmount),
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

  useEffect(() => {
    void load();
  }, []);

  const estimatedMonthlyPayroll = useMemo(() => {
    return staffMembers.reduce((sum, e) => sum + e.paymentPerDay * ASSUMED_WORK_DAYS_PER_MONTH, 0);
  }, [staffMembers]);

  const handleAddStaff = async () => {
    const rate = Number.parseFloat(newStaff.paymentPerDay);
    if (!newStaff.name.trim() || !newStaff.role.trim() || !Number.isFinite(rate) || rate < 0) return;
    try {
      await createEmployeeRemote({
        name: newStaff.name.trim(),
        role: newStaff.role.trim(),
        paymentPerDay: rate,
      });
      setNewStaff({ name: "", role: "", paymentPerDay: "" });
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
      username: e.username,
      fullName: e.fullName,
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
                  <Label htmlFor="staff-username">Username</Label>
                  <Input
                    id="staff-username"
                    value={newStaff.username}
                    onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                    placeholder="e.g. john.doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="staff-fullname">Full name</Label>
                  <Input
                    id="staff-fullname"
                    value={newStaff.fullName}
                    onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
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
                    disabled
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
                    key={staff.employeeId}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg flex-wrap gap-3"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                      <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm">
                        {staff.fullName
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
                          {staff.fullName}
                        </button>
                        <p className="text-sm text-muted-foreground">@{staff.username}</p>
                        <p className="text-sm text-muted-foreground">{staff.role}</p>
                        {staff.empCode ? (
                          <p className="text-xs text-muted-foreground font-mono">{staff.empCode}</p>
                        ) : null}
                        {staff.monthlyLoanAdvanceDeductionLkr > 0 ? (
                          <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                            Monthly deduction: {formatCurrency(staff.monthlyLoanAdvanceDeductionLkr)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Per day</p>
                        <p className="font-semibold">{formatCurrency(staff.paymentPerDay)}</p>
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
                  <Label htmlFor="det-username">Username</Label>
                  <Input
                    id="det-username"
                    value={detailForm.username}
                    onChange={(e) => setDetailForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="e.g. john.doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="det-fullname">Full name</Label>
                  <Input
                    id="det-fullname"
                    value={detailForm.fullName}
                    onChange={(e) => setDetailForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="det-role">Role</Label>
                  <Input
                    id="det-role"
                    value={detailForm.role}
                    onChange={(e) => setDetailForm((f) => ({ ...f, role: e.target.value }))}
                    disabled
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
                      <Label>Loan amount</Label>
                      <Input type="number" value={loanNewForm.loanAmount} onChange={(e) => setLoanNewForm((s) => ({ ...s, loanAmount: e.target.value }))} />
                    </div>
                    {/* Paid amount removed from add form; default to 0 on create */}
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                    <Button variant="outline" onClick={() => setLoanNewForm({ loanAmount: '', loanDate: '', paidAmount: '' })}>Clear</Button>
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
                            <td className="px-4 py-3">{formatCurrency(l.loanAmount)}</td>
                            <td className="px-4 py-3">{formatCurrency(l.paidAmount)}</td>
                            <td className="px-4 py-3">{formatCurrency(l.balance)}</td>
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
      </div>
    </DashboardLayout>
  );
};

export default Staff;
