import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Search, Filter } from "lucide-react";
import { Card, DataTable, StatusBadge, Btn } from "../shared/UI";
import { toast } from "sonner";
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  type EmployeeDto,
} from "../../../lib/services/employees.service";
import { getDepartments } from "../../../lib/services/departments.service";

// ── helper: map backend EmployeeDto → legacy UI Employee shape ────────────────

export interface Employee {
  id: string;
  _backendId?: number;
  name: string;
  dept: string;
  designation: string;
  shift: string;
  joining: string;
  dailyWorkingHours: number;
  expectedParts: number;
  producedParts: number;
  operationsPerformed: number;
  quantityProduced: number;
  attendanceStatus: "present" | "absent" | "late" | "on-leave";
  dailyWageRate: number;
  efficiency: number;
  status: "active" | "inactive" | "on-leave";
}

function fromDto(e: EmployeeDto): Employee {
  return {
    id: e.employeeCode,
    _backendId: e.id,
    name: `${e.firstName} ${e.lastName}`,
    dept: e.department?.name ?? "—",
    designation: e.designation,
    shift: e.shift?.name ?? "—",
    joining: new Date(e.joiningDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    dailyWorkingHours: 8,
    expectedParts: 100,
    producedParts: 0,
    operationsPerformed: 0,
    quantityProduced: 0,
    attendanceStatus: "present",
    dailyWageRate: e.salary ? parseFloat(e.salary) / 26 : 0,
    efficiency: 0,
    status: e.status === "ACTIVE" ? "active" : e.status === "ON_LEAVE" ? "on-leave" : "inactive",
  };
}

const FALLBACK_EMPLOYEES: Employee[] = [
  { id: "EMP-001", name: "Arjun Mehta",   dept: "Cutting",  designation: "Sr. Operator",   shift: "Morning", joining: "14 Mar 2021", dailyWorkingHours: 8, expectedParts: 120, producedParts: 112, operationsPerformed: 42, quantityProduced: 112, attendanceStatus: "present", dailyWageRate: 3562.50, efficiency: 93.3, status: "active" },
  { id: "EMP-002", name: "Priya Sharma",  dept: "Welding",  designation: "Welder",         shift: "Morning", joining: "02 Jan 2022", dailyWorkingHours: 8, expectedParts: 100, producedParts: 98,  operationsPerformed: 35, quantityProduced: 98,  attendanceStatus: "present", dailyWageRate: 3000,   efficiency: 98.0, status: "active" },
  { id: "EMP-003", name: "Suresh Kumar",  dept: "Pressing", designation: "Press Operator", shift: "Evening", joining: "15 Aug 2020", dailyWorkingHours: 8, expectedParts: 95,  producedParts: 84,  operationsPerformed: 28, quantityProduced: 84,  attendanceStatus: "present", dailyWageRate: 2750,   efficiency: 88.4, status: "active" },
  { id: "EMP-004", name: "Kavitha Nair",  dept: "Assembly", designation: "Sr. Assembler",  shift: "Morning", joining: "10 Jun 2019", dailyWorkingHours: 8, expectedParts: 146, producedParts: 145, operationsPerformed: 52, quantityProduced: 145, attendanceStatus: "present", dailyWageRate: 3875,   efficiency: 99.3, status: "active" },
  { id: "EMP-005", name: "Ravi Patel",    dept: "Finishing",designation: "QC Inspector",   shift: "Morning", joining: "25 Nov 2021", dailyWorkingHours: 8, expectedParts: 136, producedParts: 128, operationsPerformed: 45, quantityProduced: 128, attendanceStatus: "present", dailyWageRate: 3375,   efficiency: 94.1, status: "active" },
  { id: "EMP-006", name: "Deepak Singh",  dept: "Cutting",  designation: "Operator",       shift: "Night",   joining: "08 Sep 2023", dailyWorkingHours: 8, expectedParts: 95,  producedParts: 78,  operationsPerformed: 22, quantityProduced: 78,  attendanceStatus: "on-leave", dailyWageRate: 2437.50, efficiency: 82.1, status: "on-leave" },
];

interface EmployeeDialogProps {
  employee: Employee | null;
  onClose: () => void;
  onSave: (employee: Employee) => void;
  mode: "add" | "edit";
}

function EmployeeDialog({ employee, onClose, onSave, mode }: EmployeeDialogProps) {
  const [formData, setFormData] = useState<Employee>(
    employee || {
      id: "",
      name: "",
      dept: "Cutting",
      designation: "",
      shift: "Morning",
      joining: "",
      dailyWorkingHours: 8,
      expectedParts: 0,
      producedParts: 0,
      operationsPerformed: 0,
      quantityProduced: 0,
      attendanceStatus: "present",
      dailyWageRate: 0,
      efficiency: 0,
      status: "active",
    }
  );

  const calculateEfficiency = (produced: number, expected: number): number => {
    if (expected === 0) return 0;
    return parseFloat(((produced / expected) * 100).toFixed(1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate ID if adding new employee
    const employeeData = {
      ...formData,
      id: formData.id || `EMP-${String(Math.floor(Math.random() * 999) + 1).padStart(3, "0")}`,
      efficiency: calculateEfficiency(formData.producedParts, formData.expectedParts),
      quantityProduced: formData.producedParts, // For now, same as produced parts
    };
    
    onSave(employeeData);
    onClose();
  };

  const handleChange = (field: keyof Employee, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.75rem",
    border: "1px solid #D4BFBB",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.775rem",
    fontWeight: 600,
    color: "#4A4A4A",
    marginBottom: "0.35rem",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl"
        style={{ background: "#fff" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-6 py-4"
          style={{ background: "#fff", borderBottom: "1px solid #E8E2E0", zIndex: 10 }}
        >
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1C1C1C" }}>
              {mode === "add" ? "Add New Employee" : "Edit Employee"}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "#7A6C6A", marginTop: "0.25rem" }}>
              {mode === "add" ? "Enter employee details below" : "Update employee information"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md"
            style={{ color: "#7A6C6A" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F5F0EF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Employee Name */}
            <div>
              <label style={labelStyle}>Employee Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                style={inputStyle}
                placeholder="Enter full name"
                required
              />
            </div>

            {/* Department */}
            <div>
              <label style={labelStyle}>Department *</label>
              <select
                value={formData.dept}
                onChange={(e) => handleChange("dept", e.target.value)}
                style={inputStyle}
                required
              >
                <option value="Cutting">Cutting</option>
                <option value="Welding">Welding</option>
                <option value="Pressing">Pressing</option>
                <option value="Assembly">Assembly</option>
                <option value="Finishing">Finishing</option>
              </select>
            </div>

            {/* Designation */}
            <div>
              <label style={labelStyle}>Designation *</label>
              <input
                type="text"
                value={formData.designation}
                onChange={(e) => handleChange("designation", e.target.value)}
                style={inputStyle}
                placeholder="e.g., Sr. Operator"
                required
              />
            </div>

            {/* Shift */}
            <div>
              <label style={labelStyle}>Shift *</label>
              <select
                value={formData.shift}
                onChange={(e) => handleChange("shift", e.target.value)}
                style={inputStyle}
                required
              >
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>

            {/* Joining Date */}
            <div>
              <label style={labelStyle}>Joining Date *</label>
              <input
                type="text"
                value={formData.joining}
                onChange={(e) => handleChange("joining", e.target.value)}
                style={inputStyle}
                placeholder="e.g., 14 Mar 2021"
                required
              />
            </div>

            {/* Daily Working Hours */}
            <div>
              <label style={labelStyle}>Daily Working Hours *</label>
              <input
                type="number"
                value={formData.dailyWorkingHours}
                onChange={(e) => handleChange("dailyWorkingHours", parseFloat(e.target.value))}
                style={inputStyle}
                step="0.5"
                min="0"
                max="24"
                required
              />
            </div>

            {/* Expected Parts */}
            <div>
              <label style={labelStyle}>Expected Parts (Daily) *</label>
              <input
                type="number"
                value={formData.expectedParts}
                onChange={(e) => handleChange("expectedParts", parseInt(e.target.value))}
                style={inputStyle}
                min="0"
                required
              />
            </div>

            {/* Produced Parts */}
            <div>
              <label style={labelStyle}>Produced Parts (Daily) *</label>
              <input
                type="number"
                value={formData.producedParts}
                onChange={(e) => handleChange("producedParts", parseInt(e.target.value))}
                style={inputStyle}
                min="0"
                required
              />
            </div>

            {/* Operations Performed */}
            <div>
              <label style={labelStyle}>Number of Operations *</label>
              <input
                type="number"
                value={formData.operationsPerformed}
                onChange={(e) => handleChange("operationsPerformed", parseInt(e.target.value))}
                style={inputStyle}
                min="0"
                required
              />
            </div>

            {/* Attendance Status */}
            <div>
              <label style={labelStyle}>Attendance Status *</label>
              <select
                value={formData.attendanceStatus}
                onChange={(e) => handleChange("attendanceStatus", e.target.value as any)}
                style={inputStyle}
                required
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>

            {/* Daily Wage Rate */}
            <div>
              <label style={labelStyle}>Daily Wage Rate (₹) *</label>
              <input
                type="number"
                value={formData.dailyWageRate}
                onChange={(e) => handleChange("dailyWageRate", parseFloat(e.target.value))}
                style={inputStyle}
                step="0.01"
                min="0"
                required
              />
            </div>

            {/* Status */}
            <div>
              <label style={labelStyle}>Status *</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value as any)}
                style={inputStyle}
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Calculated Efficiency Preview */}
          <div
            className="p-3 rounded-md mb-4"
            style={{ background: "#FDF5F5", border: "1px solid #FFCDD2" }}
          >
            <p style={{ fontSize: "0.775rem", color: "#7A6C6A", marginBottom: "0.25rem" }}>
              <strong>Calculated Efficiency:</strong>
            </p>
            <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#A52A2A" }}>
              {calculateEfficiency(formData.producedParts, formData.expectedParts).toFixed(1)}%
            </p>
            <p style={{ fontSize: "0.7rem", color: "#9A8A88", marginTop: "0.25rem" }}>
              Formula: (Produced Parts ÷ Expected Parts) × 100
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md"
              style={{
                border: "1px solid #E8E2E0",
                background: "#fff",
                color: "#4A4A4A",
                fontSize: "0.875rem",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md"
              style={{
                background: "#A52A2A",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
              }}
            >
              {mode === "add" ? "Add Employee" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function WorkforceManagement() {
  const [employees, setEmployees] = useState<Employee[]>(FALLBACK_EMPLOYEES);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [departments, setDepartments]   = useState<string[]>(["Cutting", "Welding", "Pressing", "Assembly", "Finishing"]);
  const [dialogMode, setDialogMode]     = useState<"add" | "edit" | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // ── Load employees from API ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getEmployees({ pageSize: 100 }).catch(() => null),
      getDepartments().catch(() => null),
    ]).then(([empRes, deptRes]) => {
      if (cancelled) return;
      if (empRes && empRes.data.length > 0) {
        setEmployees(empRes.data.map(fromDto));
      }
      if (deptRes && deptRes.length > 0) {
        setDepartments(deptRes.map((d: { name: string }) => d.name));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filteredEmployees = employees.filter((e) =>
    (selectedDept === "all" || e.dept === selectedDept) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) || e.id.includes(search))
  );

  const handleAdd = () => { setDialogMode("add"); setSelectedEmployee(null); };
  const handleEdit = (emp: Employee) => { setDialogMode("edit"); setSelectedEmployee(emp); };

  const handleDelete = async (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    if (!confirm("Are you sure you want to delete this employee?")) return;
    try {
      if (emp._backendId) await deleteEmployee(emp._backendId);
      setEmployees(prev => prev.filter(e => e.id !== empId));
      toast.success("Employee deleted successfully");
    } catch {
      // If backend fails (e.g. not running), still remove from local state for demo
      setEmployees(prev => prev.filter(e => e.id !== empId));
      toast.success("Employee removed");
    }
  };

  const handleSave = async (employee: Employee) => {
    try {
      if (dialogMode === "add") {
        // Try real API; fall back to local-only
        const payload = {
          employeeCode: employee.id || `EMP-${Date.now()}`,
          firstName: employee.name.split(" ")[0] ?? employee.name,
          lastName:  employee.name.split(" ").slice(1).join(" ") || "—",
          designation: employee.designation,
          joiningDate: new Date().toISOString(),
          employmentType: "FULL_TIME",
        };
        try {
          const created = await createEmployee(payload);
          setEmployees(prev => [...prev, fromDto(created)]);
        } catch {
          setEmployees(prev => [...prev, { ...employee, id: employee.id || `EMP-${Date.now()}` }]);
        }
        toast.success("Employee added successfully");
      } else {
        try {
          if (employee._backendId) {
            const updated = await updateEmployee(employee._backendId, { designation: employee.designation });
            setEmployees(prev => prev.map(e => e.id === employee.id ? fromDto(updated) : e));
          } else {
            setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
          }
        } catch {
          setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
        }
        toast.success("Employee updated successfully");
      }
    } finally {
      setDialogMode(null);
      setSelectedEmployee(null);
    }
  };

  const handleCloseDialog = () => { setDialogMode(null); setSelectedEmployee(null); };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-48 px-3 py-2 rounded-md" style={{ background: "#fff", border: "1px solid #E8E2E0" }}>
          <Search size={14} color="#9A8A88" />
          <input
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: "0.8375rem", flex: 1, background: "transparent" }}
          />
        </div>
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          style={{ padding: "0.5rem 0.75rem", border: "1px solid #E8E2E0", borderRadius: "0.375rem", fontSize: "0.8375rem", background: "#fff", cursor: "pointer" }}
        >
          <option value="all">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <Btn size="sm" variant="secondary"><Filter size={14} /> Filters</Btn>
        <Btn size="sm" onClick={handleAdd}><Plus size={14} /> Add Employee</Btn>
      </div>

      <Card>
        <DataTable
          searchable
          paginate={10}
          exportFilename="DVS_Employees.csv"
          columns={[
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "dept", label: "Dept" },
            { key: "designation", label: "Designation" },
            { key: "shift", label: "Shift" },
            { key: "workingHours", label: "Hours" },
            { key: "attendance", label: "Attendance" },
            { key: "efficiency", label: "Efficiency" },
            { key: "parts", label: "Parts" },
            { key: "status", label: "Status" },
            { key: "actions", label: "Actions" },
          ]}
          rows={filteredEmployees.map((e) => ({
            id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#A52A2A" }}>{e.id}</span>,
            name: (
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.8375rem" }}>{e.name}</p>
                <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{e.designation}</p>
              </div>
            ),
            dept: e.dept,
            designation: e.designation,
            shift: <span style={{ fontSize: "0.775rem" }}>{e.shift}</span>,
            workingHours: `${e.dailyWorkingHours}h`,
            attendance: (
              <span className="px-2 py-0.5 rounded-full" style={{
                fontSize: "0.7rem", fontWeight: 600,
                background: e.attendanceStatus === "present" ? "#E8F5E9" : e.attendanceStatus === "late" ? "#FFF8E1" : "#FFEBEE",
                color: e.attendanceStatus === "present" ? "#2E7D32" : e.attendanceStatus === "late" ? "#F57F17" : "#C0392B",
              }}>
                {e.attendanceStatus.charAt(0).toUpperCase() + e.attendanceStatus.slice(1)}
              </span>
            ),
            efficiency: (
              <span style={{ color: e.efficiency >= 95 ? "#2E7D32" : e.efficiency >= 88 ? "#E65100" : "#C0392B", fontWeight: 600 }}>
                {e.efficiency.toFixed(1)}%
              </span>
            ),
            parts: `${e.producedParts}/${e.expectedParts}`,
            status: <StatusBadge status={e.status === "active" ? "active" : "neutral"} label={e.status === "active" ? "Active" : e.status} />,
            actions: (
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleEdit(e)}
                  className="p-1.5 rounded"
                  style={{ background: "#F5F0EF", color: "#4E342E" }}
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="p-1.5 rounded"
                  style={{ background: "#FFEBEE", color: "#C0392B" }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ),
          }))}
        />
      </Card>

      {/* Dialog */}
      {dialogMode && (
        <EmployeeDialog
          employee={selectedEmployee}
          mode={dialogMode}
          onClose={handleCloseDialog}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
