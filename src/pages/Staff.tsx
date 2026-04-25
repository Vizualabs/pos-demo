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
  createEmployee,
  deleteEmployee,
  getAllEmployees,
  patchEmployee,
  PAID_LEAVE_DAYS_PER_MONTH,
  type Employee,
} from "@/lib/employeesApi";

/** Rough calendar-month payroll if every paid day matched a worked or paid-leave day (see Attendance). */
const ASSUMED_WORK_DAYS_PER_MONTH = 22;

const Staff = () => {
  const [staffMembers, setStaffMembers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

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
    monthlyLoanAdvanceDeductionLkr: "",
  });
  const [detailSaving, setDetailSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAllEmployees();
      setStaffMembers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const estimatedMonthlyPayroll = useMemo(() => {
    return staffMembers.reduce((sum, e) => sum + e.paymentPerDay * ASSUMED_WORK_DAYS_PER_MONTH, 0);
  }, [staffMembers]);

  const handleAddStaff = async () => {
    const rate = Number.parseFloat(newStaff.paymentPerDay);
    if (!newStaff.username.trim() || !newStaff.fullName.trim() || !newStaff.role.trim() || !Number.isFinite(rate) || rate < 0) return;
    await createEmployee({
      username: newStaff.username,
      fullName: newStaff.fullName,
      role: newStaff.role,
      paymentPerDay: rate,
    });
    setNewStaff({ username: "", fullName: "", role: "", paymentPerDay: "" });
    await load();
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("Remove this employee? Attendance history for this ID stays in local storage.")) return;
    await deleteEmployee(id);
    if (detailStaff?.employeeId === id) setDetailStaff(null);
    await load();
  };

  const openEmployeeDetail = (e: Employee) => {
    setDetailStaff(e);
    setDetailForm({
      username: e.username,
      fullName: e.fullName,
      role: e.role,
      paymentPerDay: String(e.paymentPerDay),
      monthlyLoanAdvanceDeductionLkr: String(e.monthlyLoanAdvanceDeductionLkr ?? 0),
    });
  };

  const handleSaveEmployeeDetail = async () => {
    if (!detailStaff) return;
    const rate = Number.parseFloat(detailForm.paymentPerDay);
    const ded = Number.parseFloat(detailForm.monthlyLoanAdvanceDeductionLkr);
    if (!detailForm.username.trim() || !detailForm.fullName.trim() || !detailForm.role.trim() || !Number.isFinite(rate) || rate < 0) {
      toast.error("Username, full name, role, and a valid daily rate are required.");
      return;
    }
    if (!Number.isFinite(ded) || ded < 0) {
      toast.error("Deduction must be zero or a positive number.");
      return;
    }
    setDetailSaving(true);
    try {
      const updated = await patchEmployee(detailStaff.employeeId, {
        username: detailForm.username.trim(),
        fullName: detailForm.fullName.trim(),
        role: detailForm.role.trim(),
        paymentPerDay: rate,
        monthlyLoanAdvanceDeductionLkr: ded,
      });
      setStaffMembers((prev) => prev.map((p) => (p.employeeId === updated.employeeId ? updated : p)));
      setDetailStaff(updated);
      toast.success("Employee updated. Net pay uses this deduction on Attendance → Monthly payroll.");
    } catch (err) {
      console.error(err);
      toast.error("Could not save employee.");
    } finally {
      setDetailSaving(false);
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
          <Dialog>
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
                <Button variant="outline">Cancel</Button>
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
                        <p className="text-xs text-muted-foreground font-mono">{staff.employeeId}</p>
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
                      <Button variant="destructive" size="sm" onClick={() => void handleRemove(staff.employeeId)}>
                        Remove
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
                <div className="grid gap-2">
                  <Label htmlFor="det-ded">Monthly loan / advance deduction (LKR)</Label>
                  <Input
                    id="det-ded"
                    type="number"
                    min="0"
                    step="1"
                    value={detailForm.monthlyLoanAdvanceDeductionLkr}
                    onChange={(e) => setDetailForm((f) => ({ ...f, monthlyLoanAdvanceDeductionLkr: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Enter how much to recover this month from salary (loans, advances). You choose the amount each time you
                    update it. <strong className="text-foreground">Net pay</strong> = gross (from attendance) minus this
                    figure. Download the slip from <Link to="/attendance">Attendance → Monthly payroll</Link>.
                  </p>
                </div>
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
