import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download, FileDown } from "lucide-react";
import { generatePDF, generateSalarySlipPdf } from "@/lib/pdfUtils";
import { ReportPdfShell } from "@/components/reports/ReportPdfShell";
import { toast } from "sonner";
import { StatCard } from "@/components/Dashboard/StatCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { getAllEmployeesRemote, PAID_LEAVE_DAYS_PER_MONTH, type Employee } from "@/lib/employeesApi";
import {
  filterAttendanceRecords,
  getAllAttendanceRecords,
  upsertAttendanceForDay,
  summarizeMonth,
  netPayrollForMonth,
  type AttendanceStatus,
} from "@/lib/attendanceRecordsApi";

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const statusLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  LEAVE: "Leave",
  ABSENT: "Absent",
};

const statusHighlightClasses: Record<AttendanceStatus, string> = {
  PRESENT: "border-emerald-300 bg-emerald-50 text-emerald-700",
  LEAVE: "border-amber-300 bg-amber-50 text-amber-700",
  ABSENT: "border-rose-300 bg-rose-50 text-rose-700",
};

const statusRowHighlightClasses: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-50/40",
  LEAVE: "bg-amber-50/40",
  ABSENT: "bg-rose-50/40",
};

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const Attendance = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getAllAttendanceRecords>>>([]);
  const [selectedDate, setSelectedDate] = useState(todayISODate);
  const [payrollMonth, setPayrollMonth] = useState(currentYearMonth);
  const [rangeStartDate, setRangeStartDate] = useState(daysAgoISO(6));
  const [rangeEndDate, setRangeEndDate] = useState(todayISODate);
  const [rangeEmpId, setRangeEmpId] = useState<string>("all");
  const [rangeStatus, setRangeStatus] = useState<string>("all");
  const [rangeRows, setRangeRows] = useState<Awaited<ReturnType<typeof filterAttendanceRecords>>>([]);
  const [isRangeLoading, setIsRangeLoading] = useState(false);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  const load = async () => {
    const [employeesResult, attendanceResult] = await Promise.allSettled([
      getAllEmployeesRemote(),
      getAllAttendanceRecords(),
    ]);

    if (employeesResult.status === "fulfilled") {
      setEmployees(employeesResult.value);
    } else {
      console.error("Could not load employees", employeesResult.reason);
      setEmployees([]);
      toast.error("Could not load employees from Staff & HR.");
    }

    if (attendanceResult.status === "fulfilled") {
      setRecords(attendanceResult.value);
    } else {
      console.error("Could not load attendance records", attendanceResult.reason);
      setRecords([]);
      toast.error("Could not load attendance records.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const employeeNumericId = (employee: Employee): number | null => {
    if (typeof employee.empId === "number" && Number.isFinite(employee.empId)) return employee.empId;
    const parsed = Number.parseInt(employee.employeeId, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const employeeRenderKey = (employee: Employee, index: number, scope: string) => {
    const base = employee.empId ?? employee.empCode ?? employee.employeeId;
    return `${scope}-${String(base)}-${index}`;
  };

  const statusFor = (empId: number | null, date: string): AttendanceStatus => {
    if (empId == null) return "PRESENT";
    const r = records.find((x) => x.empId === empId && x.attendanceDate === date);
    return r?.status ?? "PRESENT";
  };

  const attendanceFor = (empId: number | null, date: string) => {
    if (empId == null) return undefined;
    return records.find((x) => x.empId === empId && x.attendanceDate === date);
  };

  const rowKey = (empId: number | null, date: string) => `${String(empId ?? "na")}::${date}`;

  const selectedStatusFor = (empId: number | null, date: string): AttendanceStatus => {
    const key = rowKey(empId, date);
    return draftStatuses[key] ?? statusFor(empId, date);
  };

  const setDraftStatus = (empId: number | null, date: string, status: AttendanceStatus) => {
    const key = rowKey(empId, date);
    setDraftStatuses((prev) => ({ ...prev, [key]: status }));
  };

  const hasStatusChanges = (empId: number | null, date: string): boolean => {
    return selectedStatusFor(empId, date) !== statusFor(empId, date);
  };

  const refreshRange = async () => {
    setIsRangeLoading(true);
    try {
      const empId = rangeEmpId === "all" ? undefined : Number(rangeEmpId);
      let rows = await filterAttendanceRecords({
        empId,
        startDate: rangeStartDate,
        endDate: rangeEndDate,
        status: rangeStatus === "all" ? undefined : (rangeStatus as AttendanceStatus),
      });

      // Client-side fallback if backend doesn't support status or empId filter
      if (rangeStatus !== "all") {
        rows = rows.filter((r) => r.status === rangeStatus);
      }
      if (rangeEmpId !== "all") {
        const numericEmpId = Number(rangeEmpId);
        rows = rows.filter((r) => r.empId === numericEmpId);
      }

      setRangeRows(rows);
    } catch (error) {
      console.error("Could not load attendance range", error);
      toast.error("Could not load attendance range.");
    } finally {
      setIsRangeLoading(false);
    }
  };

  useEffect(() => {
    void refreshRange();
  }, [rangeStartDate, rangeEndDate, rangeEmpId, rangeStatus]);

  const handleSaveAttendance = async (empId: number | null, date: string) => {
    if (empId == null) {
      toast.error("Employee is missing a numeric empId required by attendance API.");
      return;
    }
    const key = rowKey(empId, date);
    const status = selectedStatusFor(empId, date);
    setSavingRows((prev) => ({ ...prev, [key]: true }));
    try {
      const saved = await upsertAttendanceForDay(empId, date, status);
      setRecords((prev) => {
        const others = prev.filter((r) => !(r.empId === empId && r.attendanceDate === date));
        return [saved, ...others];
      });
      setRangeRows((prev) => {
        const others = prev.filter((r) => !(r.empId === empId && r.attendanceDate === date));
        return [saved, ...others].sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate));
      });
      setDraftStatuses((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success("Attendance saved.");
    } catch (error) {
      console.error("Could not save attendance", error);
      toast.error("Could not save attendance.");
    } finally {
      setSavingRows((prev) => ({ ...prev, [key]: false }));
    }
  };

  const presentToday = useMemo(() => {
    return records.filter((r) => r.attendanceDate === selectedDate && r.status === "PRESENT").length;
  }, [records, selectedDate]);

  const leaveToday = useMemo(() => {
    return records.filter((r) => r.attendanceDate === selectedDate && r.status === "LEAVE").length;
  }, [records, selectedDate]);

  const payrollRows = useMemo(() => {
    return employees.map((emp) => {
      const empId = employeeNumericId(emp);
      const sum = summarizeMonth(records, empId ?? -1, payrollMonth);
      const pay = netPayrollForMonth(emp.paymentPerDay, emp.monthlyLoanAdvanceDeductionLkr, sum);
      return { emp, empId, sum, ...pay };
    });
  }, [employees, records, payrollMonth]);

  const downloadSlip = (row: (typeof payrollRows)[number]) => {
    try {
      generateSalarySlipPdf({
        employeeName: row.emp.name,
        employeeId: row.emp.employeeId,
        role: row.emp.role,
        periodYm: payrollMonth,
        paymentPerDay: row.emp.paymentPerDay,
        present: row.sum.present,
        leave: row.sum.leave,
        absent: row.sum.absent,
        paidLeaveDays: row.sum.paidLeaveDays,
        unpaidLeaveDays: row.sum.unpaidLeaveDays,
        paidDays: row.sum.paidDays,
        grossLkr: row.grossLkr,
        deductionLkr: row.deductionLkr,
        netLkr: row.netLkr,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportReport = async () => {
    try {
      await generatePDF("attendance-content", "RestaurantOS-attendance-report.pdf", { marginMm: 12 });
      toast.success("PDF downloaded.");
    } catch (error) {
      console.error("Error exporting report:", error);
      toast.error("Could not export PDF.");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 relative">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Attendance</h1>
            <p className="text-muted-foreground mt-2">
              Employees come from <strong className="text-foreground">Staff &amp; HR</strong>. Mark daily status per employee. Up to{" "}
              {PAID_LEAVE_DAYS_PER_MONTH} leave days per month count as paid; extra leave is unpaid.
            </p>
          </div>
          <Button variant="outline" onClick={() => void handleExportReport()}>
            <Download className="w-4 h-4 mr-2" />
            Export report
          </Button>
        </div>

        <div id="attendance-content" className="mx-auto w-full max-w-7xl">
          <ReportPdfShell
            title="Attendance & payroll report"
            subtitle={`Selected date: ${selectedDate} · Payroll month: ${payrollMonth} · Paid leave cap: ${PAID_LEAVE_DAYS_PER_MONTH} days/month`}
            footer="Demo data stored locally. Switch tabs before export to include daily marking or payroll table in the capture."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Present (selected day)" value={String(presentToday)} change="—" icon={Calendar} trend="up" />
              <StatCard title="Leave (selected day)" value={String(leaveToday)} change="—" icon={Calendar} trend="down" />
              <StatCard title="Employees" value={String(employees.length)} change="—" icon={Calendar} trend="up" />
            </div>

            <Tabs defaultValue="daily" className="space-y-6">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
                <TabsTrigger value="daily">Daily marking</TabsTrigger>
                <TabsTrigger value="range">Date range view</TabsTrigger>
              </TabsList>

              <TabsContent value="daily">
                <Card>
                  <CardHeader>
                    <CardTitle>Record attendance</CardTitle>
                    <CardDescription>Select the date, then set status for each employee.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 max-w-xs">
                      <Label htmlFor="att-date">Date</Label>
                      <Input id="att-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                    </div>

                    <div className="w-full overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Pay / day</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.map((emp, index) => {
                            const empId = employeeNumericId(emp);
                            const currentStatus = selectedStatusFor(empId, selectedDate);
                            const existing = attendanceFor(empId, selectedDate);
                            const key = rowKey(empId, selectedDate);
                            const isSaving = Boolean(savingRows[key]);
                            return (
                              <TableRow key={employeeRenderKey(emp, index, "daily") } className={statusRowHighlightClasses[currentStatus]}>
                                <TableCell className="font-medium">{emp.name}</TableCell>
                                <TableCell>{emp.role}</TableCell>
                                <TableCell className="text-right font-mono text-sm">{formatCurrency(emp.paymentPerDay)}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <select
                                      className={`flex h-9 w-full max-w-[220px] rounded-md border px-3 py-1 text-sm ${statusHighlightClasses[currentStatus]}`}
                                      value={currentStatus}
                                      onChange={(e) =>
                                        setDraftStatus(empId, selectedDate, e.target.value as AttendanceStatus)
                                      }
                                      disabled={empId == null || isSaving}
                                    >
                                      <option value="PRESENT">{statusLabels.PRESENT}</option>
                                      <option value="LEAVE">{statusLabels.LEAVE}</option>
                                      <option value="ABSENT">{statusLabels.ABSENT}</option>
                                    </select>
                                    <Badge variant="outline" className={statusHighlightClasses[currentStatus]}>
                                      {statusLabels[currentStatus]}
                                    </Badge>
                                  </div>
                                  {empId == null && (
                                    <p className="mt-1 text-xs text-destructive">empId missing for this employee.</p>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={existing ? "outline" : "default"}
                                    onClick={() => void handleSaveAttendance(empId, selectedDate)}
                                    disabled={empId == null || isSaving || (existing != null && !hasStatusChanges(empId, selectedDate))}
                                  >
                                    {isSaving ? "Saving..." : existing ? "Update" : "Save"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {employees.length === 0 && <p className="text-sm text-muted-foreground">Add employees under Staff &amp; HR first.</p>}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="range">
                <Card>
                  <CardHeader>
                    <CardTitle>Attendance by date range</CardTitle>
                    <CardDescription>Filter attendance using the backend endpoint /attendance/filter.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                      <div className="grid gap-2">
                        <Label htmlFor="range-start">Start date</Label>
                        <Input id="range-start" type="date" value={rangeStartDate} onChange={(e) => setRangeStartDate(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="range-end">End date</Label>
                        <Input id="range-end" type="date" value={rangeEndDate} onChange={(e) => setRangeEndDate(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="range-emp">Employee</Label>
                        <select
                          id="range-emp"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={rangeEmpId}
                          onChange={(e) => setRangeEmpId(e.target.value)}
                        >
                          <option value="all">All employees</option>
                          {employees
                            .filter((emp) => employeeNumericId(emp) != null)
                            .map((emp, index) => {
                              const empId = employeeNumericId(emp);
                              return (
                                <option key={employeeRenderKey(emp, index, "range") } value={String(empId)}>
                                  {emp.name}
                                </option>
                              );
                            })}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="range-status">Status</Label>
                        <select
                          id="range-status"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={rangeStatus}
                          onChange={(e) => setRangeStatus(e.target.value)}
                        >
                          <option value="all">All statuses</option>
                          <option value="PRESENT">Present</option>
                          <option value="LEAVE">Leave</option>
                          <option value="ABSENT">Absent</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <Button type="button" className="w-full" onClick={() => void refreshRange()} disabled={isRangeLoading}>
                          {isRangeLoading ? "Loading..." : "Refresh"}
                        </Button>
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rangeRows
                            .slice()
                            .sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate))
                            .map((row) => {
                              const employee = employees.find((e) => employeeNumericId(e) === row.empId);
                              return (
                                <TableRow key={row.attendanceId}>
                                  <TableCell className="font-mono text-sm">{row.attendanceDate}</TableCell>
                                  <TableCell>{employee?.name ?? `Emp #${row.empId}`}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={statusHighlightClasses[row.status]}>
                                      {statusLabels[row.status]}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          {rangeRows.length === 0 && !isRangeLoading && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                                No attendance records found for the selected filters.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            </Tabs>
          </ReportPdfShell>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Attendance;
