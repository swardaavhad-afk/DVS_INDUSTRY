import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import {
  Plus, Download, RefreshCw, Wifi, WifiOff, Clock, CheckCircle2, AlertTriangle, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, KPICard, Card, CardHeader, Btn, DataTable, TabBar } from "../shared/UI";
import { WorkforceManagement } from "./WorkforceManagement";
import { getProductionKPIs, getWorkOrders, transitionStatus, type ProductionKPIs, type WorkOrderDto } from "../../../lib/services/production.service";

const companyPerf = {
  today: { expected: 420, actual: 401, efficiency: 95.5, attendance: 97.0, scrap: 4.3, loss: 19, target: 95.5 },
  week: { expected: 2940, actual: 2810, efficiency: 95.6, attendance: 96.5, scrap: 4.1, loss: 130, target: 96.0 },
  month: { expected: 12600, actual: 11830, efficiency: 93.9, attendance: 95.8, scrap: 4.8, loss: 770, target: 95.0 },
};

const deptComparison = [
  { dept: "Cutting", efficiency: 91.2, attendance: 96, scrap: 8.2 },
  { dept: "Welding", efficiency: 97.4, attendance: 98, scrap: 2.1 },
  { dept: "Pressing", efficiency: 94.1, attendance: 95, scrap: 5.3 },
  { dept: "Assembly", efficiency: 98.2, attendance: 99, scrap: 1.2 },
  { dept: "Finishing", efficiency: 95.8, attendance: 97, scrap: 3.1 },
];

const weeklyTrend = [
  { week: "W1", actual: 2710, expected: 2940 }, { week: "W2", actual: 2830, expected: 2940 },
  { week: "W3", actual: 2760, expected: 2940 }, { week: "W4", actual: 2810, expected: 2940 },
];

const workers = [
  { id: "EMP-001", name: "Arjun Mehta", dept: "Cutting", role: "Sr. Operator", shift: "Morning", joining: "14 Mar 2021", salary: "₹28,500", attendance: "96%", productivity: "93%", skill: 4, parts: 112, expected: 120, efficiency: "93.3%", leave: 2, overtime: 6, status: "active", fatigue: "low" },
  { id: "EMP-002", name: "Priya Sharma", dept: "Welding", role: "Welder", shift: "Morning", joining: "02 Jan 2022", salary: "₹24,000", attendance: "99%", productivity: "97%", skill: 5, parts: 98, expected: 100, efficiency: "98.0%", leave: 0, overtime: 2, status: "active", fatigue: "low" },
  { id: "EMP-003", name: "Suresh Kumar", dept: "Pressing", role: "Press Operator", shift: "Evening", joining: "15 Aug 2020", salary: "₹22,000", attendance: "91%", productivity: "88%", skill: 3, parts: 84, expected: 95, efficiency: "88.4%", leave: 5, overtime: 0, status: "active", fatigue: "high" },
  { id: "EMP-004", name: "Kavitha Nair", dept: "Assembly", role: "Sr. Assembler", shift: "Morning", joining: "10 Jun 2019", salary: "₹31,000", attendance: "98%", productivity: "99%", skill: 5, parts: 145, expected: 146, efficiency: "99.3%", leave: 1, overtime: 8, status: "active", fatigue: "low" },
  { id: "EMP-005", name: "Ravi Patel", dept: "Finishing", role: "QC Inspector", shift: "Morning", joining: "25 Nov 2021", salary: "₹27,000", attendance: "94%", productivity: "94%", skill: 4, parts: 128, expected: 136, efficiency: "94.1%", leave: 3, overtime: 4, status: "active", fatigue: "medium" },
  { id: "EMP-006", name: "Deepak Singh", dept: "Cutting", role: "Operator", shift: "Night", joining: "08 Sep 2023", salary: "₹19,500", attendance: "89%", productivity: "82%", skill: 2, parts: 78, expected: 95, efficiency: "82.1%", leave: 7, overtime: 0, status: "on-leave", fatigue: "high" },
];

const attendanceData = [
  { date: "Mon 09", present: 334, absent: 14, late: 8, leave: 10 },
  { date: "Tue 10", present: 341, absent: 8, late: 6, leave: 9 },
  { date: "Wed 11", present: 328, absent: 18, late: 10, leave: 12 },
  { date: "Thu 12", present: 347, absent: 4, late: 5, leave: 7 },
];

const aiReco = [
  { severity: "critical", text: "Cutting Dept scrap rate at 8.2% — 4.1% above target. Recalibrate press blade #4; review EMP-006 technique. Estimated ₹3,800 daily loss." },
  { severity: "warning", text: "Morning shift productivity 12% below weekly average. 3 of 6 Cutting operators below 90% efficiency. Recommend shift-lead review today." },
  { severity: "warning", text: "EMP-003 (Suresh Kumar) efficiency dropped from 92% → 88.4% over 3 consecutive days. Ergonomic assessment recommended." },
  { severity: "info", text: "Assembly dept efficiency at 99.3% — 2.1% above company target. Document Kavitha Nair's workflow as best practice for cross-dept training." },
  { severity: "info", text: "Steel Tube 4mm inventory at 38% of reorder threshold. Based on 3-day production rate, reorder within 2 days to avoid line stoppage." },
  { severity: "info", text: "4 workers overdue for quarterly skill assessment (EMP-003, 006, 005, 002). Schedule evaluations within 7 working days per HR policy." },
];

export function ProductionPage() {
  const [tab, setTab]         = useState("performance");
  const [period, setPeriod]   = useState<"today" | "week" | "month">("today");
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");
  const [lastSync]            = useState("Today, 08:47 AM");
  const [workerSearch, setWorkerSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  // ── API state ──────────────────────────────────────────────────────────────
  const [kpis, setKpis]       = useState<ProductionKPIs | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getProductionKPIs().catch(() => null),
      getWorkOrders({ pageSize: 20, status: 'all', sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => null),
    ]).then(([kpiRes, woRes]) => {
      if (cancelled) return;
      if (kpiRes) setKpis(kpiRes);
      if (woRes)  setWorkOrders(woRes.data);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSync = () => {
    setSyncStatus("syncing");
    setTimeout(() => {
      setSyncStatus("synced");
      toast.success("Attendance data synced from Face Recognition System");
    }, 2200);
  };

  const perf = companyPerf[period];
  const filteredWorkers = workers.filter((w) =>
    (selectedDept === "all" || w.dept === selectedDept) &&
    (w.name.toLowerCase().includes(workerSearch.toLowerCase()) || w.id.includes(workerSearch))
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Production & Workforce Management"
        subtitle="Monitor output, workforce efficiency, and attendance across all departments"
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={() => toast.success("Production report exported")}><Download size={14} /> Export Report</Btn>
            <Btn size="sm" onClick={() => setTab("workforce")}><Plus size={14} /> Add Worker</Btn>
          </div>
        }
      />

      <TabBar
        tabs={[
          { id: "performance", label: "Company Performance" },
          { id: "workforce", label: "Workforce Management" },
          { id: "attendance", label: "Attendance" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {/* ── PERFORMANCE TAB ── */}
        {tab === "performance" && (
          <div>
            {/* Period selector */}
            <div className="flex gap-2 mb-5">
              {(["today", "week", "month"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "0.35rem 0.875rem", borderRadius: "0.35rem", fontSize: "0.775rem",
                    background: period === p ? "#A52A2A" : "#fff", color: period === p ? "#fff" : "#4A4A4A",
                    border: `1px solid ${period === p ? "#A52A2A" : "#E8E2E0"}`, cursor: "pointer",
                  }}
                >
                  {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <KPICard label="Active Work Orders"    value={kpis ? String(kpis.activeWorkOrders)    : String(perf.expected)} sub={kpis ? `${kpis.completedThisMonth} completed this month` : "units"} />
              <KPICard label="Produced (This Month)" value={kpis ? kpis.totalProducedQty : String(perf.actual)} trend={kpis ? kpis.overallCompletionRate : `${perf.efficiency.toFixed(1)}%`} trendDir="up" accent="#2E7D32" />
              <KPICard label="Completion Rate"       value={kpis ? kpis.overallCompletionRate : `${((perf.actual / perf.expected) * 100).toFixed(1)}%`} accent="#1565C0" />
              <KPICard label="Rejection Rate"        value={kpis ? kpis.rejectionRate : `${perf.scrap}%`} sub={kpis ? `${kpis.overdueWorkOrders} overdue WOs` : `₹${perf.loss.toLocaleString()} loss`} accent="#E65100" trendDir="down" />
            </div>

            {/* Live Work Orders table from API */}
            {workOrders.length > 0 && (
              <Card className="mb-5">
                <CardHeader title="Recent Work Orders" subtitle={`${workOrders.length} orders loaded`} />
                <DataTable
                  columns={[
                    { key: "wo", label: "WO #" }, { key: "product", label: "Product" },
                    { key: "dept", label: "Department" }, { key: "target", label: "Target" },
                    { key: "produced", label: "Produced" }, { key: "rate", label: "Completion" },
                    { key: "priority", label: "Priority" }, { key: "status", label: "Status" },
                  ]}
                  rows={workOrders.map((wo) => ({
                    wo: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#A52A2A", fontWeight: 600 }}>{wo.workOrderNumber}</span>,
                    product: <span style={{ fontWeight: 500, fontSize: "0.8rem" }}>{wo.product}</span>,
                    dept: <span style={{ fontSize: "0.8rem" }}>{wo.departmentName ?? "—"}</span>,
                    target: <span style={{ fontSize: "0.8rem" }}>{wo.targetQuantity} {wo.unit}</span>,
                    produced: <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{wo.producedQty}</span>,
                    rate: <span style={{ fontSize: "0.8rem", fontWeight: 700, color: parseFloat(wo.completionRate) >= 90 ? "#2E7D32" : "#E65100" }}>{wo.completionRate}</span>,
                    priority: <span className="px-2 py-0.5 rounded-full" style={{ fontSize: "0.68rem", fontWeight: 600, background: wo.priority === "URGENT" ? "#FFEBEE" : wo.priority === "HIGH" ? "#FFF3E0" : "#F5F5F5", color: wo.priority === "URGENT" ? "#C0392B" : wo.priority === "HIGH" ? "#E65100" : "#7A6C6A" }}>{wo.priority}</span>,
                    status: <span className="px-2 py-0.5 rounded-full" style={{ fontSize: "0.68rem", fontWeight: 600, background: wo.status === "COMPLETED" ? "#E8F5E9" : wo.status === "IN_PROGRESS" ? "#FFF3E0" : "#F5F5F5", color: wo.status === "COMPLETED" ? "#2E7D32" : wo.status === "IN_PROGRESS" ? "#E65100" : "#7A6C6A" }}>{wo.status.replace("_", " ")}</span>,
                  }))}
                  paginate={8}
                  searchable
                />
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <Card>
                <CardHeader title="Weekly Production Trend" />
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                      <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                      <Area id="prod-area-target" type="monotone" dataKey="expected" stroke="#D4BFBB" fill="#F7F3F2" strokeWidth={1.5} name="Target" />
                      <Area id="prod-area-actual" type="monotone" dataKey="actual" stroke="#A52A2A" fill="#FDF5F5" strokeWidth={2} name="Actual" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader title="Department Efficiency %" />
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deptComparison}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                      <XAxis dataKey="dept" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9A8A88" }} axisLine={false} tickLine={false} domain={[80, 100]} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                      <Bar dataKey="efficiency" fill="#A52A2A" radius={[3, 3, 0, 0]} name="Efficiency %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card>
              <CardHeader
                title="AI-Driven Recommendations"
                subtitle="Generated from live production, workforce, and inventory data"
                actions={
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "#E8F5E9", border: "1px solid #C8E6C9" }}>
                    <Zap size={11} color="#2E7D32" />
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#2E7D32" }}>AI Active</span>
                  </div>
                }
              />
              <div className="p-5 flex flex-col gap-3">
                {aiReco.map((r, i) => {
                  const sev = r.severity;
                  const bg = sev === "critical" ? "#FFEBEE" : sev === "warning" ? "#FFF8E1" : "#F3F8FF";
                  const border = sev === "critical" ? "#FFCDD2" : sev === "warning" ? "#FFE082" : "#BBDEFB";
                  const iconColor = sev === "critical" ? "#C0392B" : sev === "warning" ? "#F57F17" : "#1565C0";
                  const Icon = sev === "critical" ? AlertTriangle : sev === "warning" ? AlertTriangle : CheckCircle2;
                  return (
                    <div key={i} className="flex gap-3 p-3.5 rounded-xl" style={{ background: bg, border: `1px solid ${border}` }}>
                      <Icon size={15} color={iconColor} style={{ flexShrink: 0, marginTop: "0.15rem" }} />
                      <p style={{ fontSize: "0.8rem", color: "#1C1C1C", lineHeight: 1.6 }}>{r.text}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── WORKFORCE TAB ── */}
        {tab === "workforce" && (
          <WorkforceManagement />
        )}

        {/* ── ATTENDANCE TAB ── */}
        {tab === "attendance" && (
          <div>
            {/* Face Recognition Sync Banner */}
            <div
              className="flex flex-wrap items-center gap-4 px-5 py-4 rounded-xl mb-5"
              style={{
                background: syncStatus === "error" ? "#FFEBEE" : "#E8F5E9",
                border: `1px solid ${syncStatus === "error" ? "#FFCDD2" : "#C8E6C9"}`,
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                {syncStatus === "syncing" ? (
                  <RefreshCw size={18} color="#1565C0" className="animate-spin" />
                ) : syncStatus === "synced" ? (
                  <Wifi size={18} color="#2E7D32" />
                ) : (
                  <WifiOff size={18} color="#C0392B" />
                )}
                <div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: syncStatus === "error" ? "#C0392B" : "#1C1C1C" }}>
                    {syncStatus === "syncing" ? "Syncing with Face Recognition System…" : syncStatus === "synced" ? "Synced from Face Recognition Attendance System" : "Sync Error — Face Recognition System Unreachable"}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} color="#7A6C6A" />
                      <span style={{ fontSize: "0.72rem", color: "#7A6C6A" }}>Last sync: {lastSync}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: syncStatus === "synced" ? "#2E7D32" : syncStatus === "syncing" ? "#1565C0" : "#C0392B" }} />
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: syncStatus === "synced" ? "#2E7D32" : syncStatus === "syncing" ? "#1565C0" : "#C0392B" }}>
                        {syncStatus === "synced" ? "Connected" : syncStatus === "syncing" ? "Syncing" : "Disconnected"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleSync}
                disabled={syncStatus === "syncing"}
                className="flex items-center gap-2"
                style={{
                  padding: "0.4rem 1rem", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: 600,
                  background: syncStatus === "syncing" ? "#D4BFBB" : "#2E7D32", color: "#fff",
                  border: "none", cursor: syncStatus === "syncing" ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                <RefreshCw size={13} className={syncStatus === "syncing" ? "animate-spin" : ""} />
                {syncStatus === "syncing" ? "Syncing…" : "Sync Now"}
              </button>
            </div>

            {/* Integration Architecture Note */}
            <div className="mb-5 p-4 rounded-xl" style={{ background: "#F7F3F2", border: "1px solid #E8E2E0" }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#7A6C6A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Integration Architecture
              </p>
              <div className="flex flex-wrap items-center gap-2" style={{ fontSize: "0.775rem", color: "#4A4A4A" }}>
                {["Face Recognition Device", "→", "Attendance API", "→", "Integration Layer", "→", "DVS Workforce Module"].map((step, i) => (
                  <span
                    key={i}
                    style={{
                      padding: step === "→" ? "0" : "0.2rem 0.625rem",
                      borderRadius: step === "→" ? "0" : "0.3rem",
                      background: step === "→" ? "transparent" : "#fff",
                      border: step === "→" ? "none" : "1px solid #D4BFBB",
                      fontWeight: step === "→" ? 400 : 600,
                      color: step === "DVS Workforce Module" ? "#A52A2A" : "#4A4A4A",
                    }}
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <KPICard label="Present Today" value={kpis ? String(kpis.activeWorkOrders > 0 ? "Live" : "347") : "347"} trend="97.0%" trendDir="up" accent="#2E7D32" />
              <KPICard label="Absent" value="4" accent="#C0392B" />
              <KPICard label="Late Arrival" value="7" accent="#E65100" />
              <KPICard label="On Leave" value="7" accent="#1565C0" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <Card>
                <CardHeader title="Daily Attendance Trend" subtitle="Last 4 working days — face recognition data" />
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                      <Area id="att-area-present" type="monotone" dataKey="present" stroke="#2E7D32" fill="#E8F5E9" strokeWidth={2} name="Present" />
                      <Area id="att-area-absent" type="monotone" dataKey="absent" stroke="#C0392B" fill="#FFEBEE" strokeWidth={1.5} name="Absent" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader title="Department Attendance Rate" />
                <div className="p-5">
                  {deptComparison.map((d) => (
                    <div key={d.dept} className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span style={{ fontSize: "0.8125rem", color: "#4A4A4A" }}>{d.dept}</span>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: d.attendance >= 97 ? "#2E7D32" : d.attendance >= 94 ? "#E65100" : "#C0392B" }}>
                          {d.attendance}%
                        </span>
                      </div>
                      <div style={{ height: "6px", background: "#F0ECEB", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ width: `${d.attendance}%`, height: "100%", background: d.attendance >= 97 ? "#2E7D32" : d.attendance >= 94 ? "#E65100" : "#C0392B", borderRadius: "999px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Today's Attendance Detail */}
            <Card>
              <CardHeader
                title="Today's Attendance Log"
                subtitle="Synced from Face Recognition System — 14 Jul 2026"
                actions={<Btn variant="secondary" size="sm"><Download size={13} /> Export CSV</Btn>}
              />
              <DataTable
                columns={[
                  { key: "emp", label: "Employee" },
                  { key: "dept", label: "Department" },
                  { key: "status", label: "Status" },
                  { key: "checkIn", label: "Check-In" },
                  { key: "checkOut", label: "Check-Out" },
                  { key: "hours", label: "Hours Worked" },
                  { key: "shift", label: "Shift" },
                ]}
                rows={[
                  { id: "EMP-001", name: "Arjun Mehta", dept: "Cutting", status: "present", checkIn: "08:54", checkOut: "17:02", hours: 8.1, shift: "Morning" },
                  { id: "EMP-002", name: "Priya Sharma", dept: "Welding", status: "present", checkIn: "08:58", checkOut: "17:05", hours: 8.1, shift: "Morning" },
                  { id: "EMP-003", name: "Suresh Kumar", dept: "Pressing", status: "late", checkIn: "09:42", checkOut: "17:30", hours: 7.8, shift: "Morning" },
                  { id: "EMP-004", name: "Kavitha Nair", dept: "Assembly", status: "present", checkIn: "08:51", checkOut: "17:03", hours: 8.2, shift: "Morning" },
                  { id: "EMP-005", name: "Ravi Patel", dept: "Finishing", status: "present", checkIn: "08:59", checkOut: "17:00", hours: 8.0, shift: "Morning" },
                  { id: "EMP-006", name: "Deepak Singh", dept: "Cutting", status: "leave", checkIn: null, checkOut: null, hours: 0, shift: "Night" },
                ].map((row) => ({
                  emp: (
                    <div>
                      <p style={{ fontSize: "0.8375rem", fontWeight: 600 }}>{row.name}</p>
                      <p style={{ fontSize: "0.7rem", color: "#9A8A88", fontFamily: "JetBrains Mono, monospace" }}>{row.id}</p>
                    </div>
                  ),
                  dept: <span style={{ fontSize: "0.8125rem" }}>{row.dept}</span>,
                  status: (() => {
                    const cfg = {
                      present: { bg: "#E8F5E9", color: "#2E7D32", label: "Present" },
                      late: { bg: "#FFF8E1", color: "#F57F17", label: "Late" },
                      leave: { bg: "#E3F2FD", color: "#1565C0", label: "On Leave" },
                      absent: { bg: "#FFEBEE", color: "#C0392B", label: "Absent" },
                    }[row.status];
                    return (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color, fontSize: "0.72rem", fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                    );
                  })(),
                  checkIn: <span style={{ fontSize: "0.8125rem", fontFamily: "JetBrains Mono, monospace" }}>{row.checkIn ?? "—"}</span>,
                  checkOut: <span style={{ fontSize: "0.8125rem", fontFamily: "JetBrains Mono, monospace" }}>{row.checkOut ?? "—"}</span>,
                  hours: (
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: row.hours >= 8 ? "#2E7D32" : row.hours > 0 ? "#E65100" : "#9A8A88" }}>
                      {row.hours > 0 ? `${row.hours}h` : "—"}
                    </span>
                  ),
                  shift: <span style={{ fontSize: "0.8125rem" }}>{row.shift}</span>,
                }))}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}