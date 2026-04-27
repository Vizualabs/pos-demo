
const fs = require("fs");
const path = "src/pages/Staff.tsx";
let content = fs.readFileSync(path, "utf-8");

// 1. Add imports
const importsToAdd = `
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllPayrolls, createPayroll, type PayrollResponseDto } from "@/lib/payrollsApi";
`;
content = content.replace("import { Link } from \"react-router-dom\";", "import { Link } from \"react-router-dom\";\n" + importsToAdd);

// 2. Add state
const stateToAdd = `
  const [payrolls, setPayrolls] = useState<PayrollResponseDto[]>([]);
  const [payrollsLoading, setPayrollsLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({ empId: "", year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString() });
  const [generateLoans, setGenerateLoans] = useState<any[]>([]);
  const [generateLoansLoading, setGenerateLoansLoading] = useState(false);
  const [generateSubmitting, setGenerateSubmitting] = useState(false);
`;
content = content.replace("const [loanNewForm, setLoanNewForm] = useState<{ loanAmount: string; loanDate: string }>({ loanAmount: \"\", loanDate: \"\" })", "const [loanNewForm, setLoanNewForm] = useState<{ loanAmount: string; loanDate: string }>({ loanAmount: \"\", loanDate: \"\" })\n" + stateToAdd);

// 3. Add functions
const functionsToAdd = `
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
      setGenerateLoans(activeLoans.map(l => ({ ...l, inputPaidAmount: "0" })));
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
      setGenerateForm({ empId: "", year: new Date().getFullYear().toString(), month: (new Date().getMonth() + 1).toString() });
      setGenerateLoans([]);
      void loadPayrolls();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) toast.error("Payroll for this employee and month already exists.");
      else if (status === 400) toast.error("Invalid payroll data (e.g. overpaying a loan).");
      else toast.error("Could not generate payroll.");
      console.error(err);
    } finally {
      setGenerateSubmitting(false);
    }
  };
`;
content = content.replace("const load = async () => {", functionsToAdd + "\n  const load = async () => {");

// 4. Modify useEffect
content = content.replace("useEffect(() => {\\n    void load();\\n  }, []);", "useEffect(() => {\\n    void load();\\n    void loadPayrolls();\\n  }, []);");

// 5. Replace render block. Find "return (" and wrap everything in <Tabs>
const renderBlockStart = content.indexOf("return (\\n    <DashboardLayout>");
if (renderBlockStart !== -1) {
  const renderPrefix = content.substring(0, renderBlockStart);
  
  const originalRender = content.substring(renderBlockStart);
  
  // Extract everything inside <DashboardLayout> ... </DashboardLayout>
  const dashboardInnerStart = originalRender.indexOf("<div className=\\"p-8 relative\\">");
  const dashboardInnerEnd = originalRender.lastIndexOf("</DashboardLayout>");
  
  if (dashboardInnerStart !== -1 && dashboardInnerEnd !== -1) {
    let innerContent = originalRender.substring(dashboardInnerStart, dashboardInnerEnd);
    
    // Now we wrap the grid and down into a TabsContent.
    // The div with class "mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" should be kept outside Tabs, but the rest inside TabsContent.
    
    // Let us just replace the whole innerContent with a customized version that wraps the right elements.
    // I will write a simple replacement that replaces the first "<div className=\\"grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8\\">"
    // with `<Tabs defaultValue="staff" className="space-y-4"><TabsList><TabsTrigger value="staff">Staff List</TabsTrigger><TabsTrigger value="payments">Employee Payments</TabsTrigger></TabsList><TabsContent value="staff" className="space-y-4"><div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">`
    // And append `</TabsContent> ... payments tab ... </Tabs>` before the closing `</div>` of the `<div className="p-8 relative">`.
    
    innerContent = innerContent.replace(
      "<div className=\\"grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8\\">",
      \`<Tabs defaultValue="staff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="staff">Staff List</TabsTrigger>
          <TabsTrigger value="payments">Employee Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">\`
    );
    
    const paymentsTab = \`
        </TabsContent>
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Generated Payrolls</CardTitle>
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
                                {emp.name} ({emp.empCode || "-"})
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
                                  <p className="text-xs text-muted-foreground">Balance: {formatCurrency(l.balance)}</p>
                                </div>
                                <div className="w-32">
                                  <Label className="text-xs">Deduct Amount</Label>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    max={l.balance} 
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
              ) : payrolls.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No payrolls generated yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Work / Leave</TableHead>
                      <TableHead>Per Day</TableHead>
                      <TableHead>Loans</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrolls.map(p => {
                      const emp = staffMembers.find(e => e.empId === p.empId);
                      const empName = emp ? emp.name : "Emp #" + p.empId;
                      return (
                        <TableRow key={p.payrollId}>
                          <TableCell>#{p.payrollId}</TableCell>
                          <TableCell className="font-medium">{empName}</TableCell>
                          <TableCell>{p.payrollYear}-{String(p.payrollMonth).padStart(2, "0")}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              P:{p.presentDays} L:{p.leaveDays} A:{p.absentDays}
                            </span>
                          </TableCell>
                          <TableCell>{formatCurrency(p.perDaySalary)}</TableCell>
                          <TableCell className="text-red-500">{p.loanDeduction > 0 ? formatCurrency(p.loanDeduction) : "-"}</TableCell>
                          <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(p.grossSalary)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    `;
    
    // We need to inject `paymentsTab` right before the last closing `</div>` of innerContent.
    // innerContent ends with `</div>` (the closing of `div className="p-8 relative"`).
    const lastDivIndex = innerContent.lastIndexOf("</div>");
    if (lastDivIndex !== -1) {
      innerContent = innerContent.substring(0, lastDivIndex) + paymentsTab + innerContent.substring(lastDivIndex);
    }
    
    content = renderPrefix + "return (\\n    <DashboardLayout>\\n      " + innerContent + "\\n    </DashboardLayout>\\n  );\\n};\\n\\nexport default Staff;\\n";
  }
}

fs.writeFileSync(path, content);
console.log("Done");

