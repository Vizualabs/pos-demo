
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
`;
content = content.replace("const load = async () => {", functionsToAdd + "\n  const load = async () => {");

// 4. Modify useEffect
content = content.replace("void load();\\n  }, []);", "void load();\\n    void loadPayrolls();\\n  }, []);");

fs.writeFileSync(path + ".tmp", content);
console.log("Done part 1");

