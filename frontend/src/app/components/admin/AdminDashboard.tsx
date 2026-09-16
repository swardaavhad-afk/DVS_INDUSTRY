import { useState, useEffect } from "react";
import {
  Factory, Users, Package, ShoppingCart, Shield, AlertTriangle, TrendingUp,
  Truck, Plus, FileText, UserPlus, CheckCircle2, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { KPICard, Card, CardHeader, StatusBadge, Btn } from "../shared/UI";
import { getDashboard, type DashboardKPIs, type DashboardCharts } from "../../../lib/services/dashboard.service";
import { getAlerts, type SecurityAlertDto } from "../../../lib/services/security.service";

// ── Fallback static data (shown while loading or if backend is unreachable) ───

const FALLBACK_PROD_TREND = [
  { day: "Mon", expected: 420, actual: 398 }, { day: "Tue", expected: 420, actual: 411 },
  { day: "Wed", expected: 420, actual: 435 }, { day: "Thu", expected: 420, actual: 389 },
  { day: "Fri", expected: 420, actual: 427 }, { day: "Sat", expected: 380, actual: 362 },
  { day: "Sun", expected: 200, actual: 188 },
];
const FALLBACK_ATT_TREND = [
  { day: "Mon", present: 334 }, { day: "Tue", present: 341 }, { day: "Wed", present: 328 },
  { day: "Thu", present: 347 }, { day: "Fri", present: 339 }, { day: "Sat", present: 298 }, { day: "Sun", present: 142 },
];
const FALLBACK_DEPT_SCRAP = [
  { dept: "Cutting", scrap: 42 }, { dept: "Welding", scrap: 18 },
  { dept: "Pressing", scrap: 31 }, { dept: "Assembly", scrap: 9 }, { dept: "Finishing", scrap: 14 },
];
const FALLBACK_ORDER_PIE = [
  { name: "Pending", value: 18, color: "#E65100" },
  { name: "In Production", value: 24, color: "#A52A2A" },
  { name: "Dispatched", value: 12, color: "#1565C0" },
  { name: "Delivered", value: 46, color: "#2E7D32" },
];
const FALLBACK_ALERTS = [
  { id: "ALT-001", type: "PPE Violation", location: "Zone B, Cam 4", severity: "high", status: "open", time: "09:14" },
  { id: "ALT-002", type: "Unauthorized Entry", location: "Gate 3", severity: "critical", status: "investigating", time: "08:47" },
  { id: "ALT-003", type: "Inventory Threshold", location: "Warehouse A", severity: "medium", status: "open", time: "08:30" },
  { id: "ALT-004", type: "Crowd Formation", location: "Zone D", severity: "low", status: "resolved", time: "07:55" },
];
const FALLBACK_ORDERS = [
  { id: "ORD-2841", client: "Reliance Eng.", product: "Steel Frames", qty: 500, status: "in-production", date: "12 Jun" },
  { id: "ORD-2842", client: "Tata Motors", product: "Pressed Panels", qty: 200, status: "dispatched", date: "11 Jun" },
  { id: "ORD-2843", client: "Mahindra Ltd.", product: "Aluminium Parts", qty: 350, status: "pending", date: "11 Jun" },
  { id: "ORD-2844", client: "L&T Ltd.", product: "Copper Wire", qty: 150, status: "approved", date: "10 Jun" },
];
const FALLBACK_AI = [
  { type: "warn",    msg: "Scrap increasing in Cutting Department — 14% above weekly average" },
  { type: "warn",    msg: "Steel sheet inventory below threshold (42 kg remaining, min 100 kg)" },
  { type: "warn",    msg: "Morning shift productivity 11% below target — 3 consecutive days" },
  { type: "info",    msg: "Security alert ALT-002 unresolved for 87 minutes — assign investigator" },
  { type: "success", msg: "Supplier SteelCorp PO-2847 delivery confirmed for today 14:00" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminDashboard({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [kpis,    setKpis]   = useState<DashboardKPIs | null>(null);
  const [charts,  setCharts] = useState<DashboardCharts | null>(null);
  const [alerts,  setAlerts] = useState<SecurityAlertDto[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDashboard().catch(() => null),
      getAlerts({ status: "ACTIVE", pageSize: 5, sortBy: "severity", sortOrder: "desc" }).catch(() => null),
    ]).then(([dash, alertRes]) => {
      if (cancelled) return;
      if (dash) { setKpis(dash.kpis); setCharts(dash.charts); }
      if (alertRes) setAlerts(alertRes.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Derived chart data ─────────────────────────────────────────────────────

  const attTrend = charts?.attendanceTrend?.map(e => ({
    day: e.date,
    present: e.present,
  })) ?? FALLBACK_ATT_TREND;

  const scrapTrend = charts?.scrapByDepartment?.slice(0, 6).map(e => ({
    dept: e.dept,
    scrap: e.kg,
  })) ?? FALLBACK_DEPT_SCRAP;

  const orderPie = charts?.orderStatusPie && charts.orderStatusPie.length > 0
    ? charts.orderStatusPie
    : FALLBACK_ORDER_PIE;

  const recentOrders = charts?.recentOrders?.map(o => ({
    id: o.orderNumber,
    client: o.client,
    product: o.product,
    qty: o.qty,
    status: o.status,
    date: o.date,
  })) ?? FALLBACK_ORDERS;

  const liveAlerts = alerts?.slice(0, 4).map(a => ({
    id: a.alertNumber,
    type: a.type.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    location: a.location ?? "—",
    severity: a.severity.toLowerCase(),
    status: a.status.toLowerCase(),
    time: fmtTime(a.createdAt),
  })) ?? FALLBACK_ALERTS;

  // AI insights derived from KPIs
  const aiInsights = kpis ? [
    kpis.lowStockCount > 0
      ? { type: "warn", msg: `${kpis.lowStockCount} material(s) below minimum stock level — check inventory` }
      : { type: "success", msg: "All inventory levels within safe thresholds" },
    kpis.overdueWorkOrders > 0
      ? { type: "warn", msg: `${kpis.overdueWorkOrders} work order(s) past scheduled end — review production` }
      : { type: "success", msg: "All work orders on schedule" },
    kpis.criticalAlerts !== undefined && Number(kpis.criticalAlerts ?? 0) > 0
      ? { type: "warn", msg: `${kpis.criticalAlerts} critical security alert(s) active — immediate attention required` }
      : { type: "info", msg: "No critical security alerts active" },
    { type: "info", msg: `Order fulfillment rate: ${kpis.orderFulfillmentRate} · Production: ${kpis.productionCompletionRate}` },
    kpis.attendanceTodayRate
      ? { type: kpis.attendanceTodayPresent < kpis.activeEmployees * 0.8 ? "warn" : "success", msg: `Today's attendance rate: ${kpis.attendanceTodayRate} (${kpis.attendanceTodayPresent} present)` }
      : { type: "info", msg: "Attendance data not yet recorded today" },
  ] : FALLBACK_AI;

  // ── KPI values (real or fallback) ──────────────────────────────────────────

  const prodWOs        = kpis?.activeWorkOrders ?? 24;
  const prodRate       = kpis?.productionCompletionRate ?? "94.7%";
  const workersPresent = kpis?.attendanceTodayPresent ?? 347;
  const workersTotal   = kpis?.activeEmployees ?? 358;
  const invValue       = kpis?.totalInventoryValue
    ? fmt(parseFloat(kpis.totalInventoryValue))
    : "₹48.2L";
  const activeOrders   = kpis?.activeClientOrders ?? 54;
  const pendingPOs     = kpis?.pendingPurchaseOrders ?? 12;
  const activeAlertCnt = kpis ? String(Number((kpis as unknown as { activeAlerts?: number }).activeAlerts ?? 0) + Number(kpis.criticalIncidents ?? 0)) : "6";
  const totalScrap     = kpis?.totalScrapThisMonth ? `${parseFloat(kpis.totalScrapThisMonth).toFixed(1)} kg` : "18.4 kg";

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1C1C1C" }}>Operations Dashboard</h1>
          <p style={{ fontSize: "0.8375rem", color: "#7A6C6A" }}>
            DVS Industries ·{" "}
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {loading && <span style={{ color: "#B0A0A0", marginLeft: "0.5rem" }}>Loading…</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {(["today", "week", "month"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: "0.375rem 0.875rem", borderRadius: "0.375rem",
                fontSize: "0.775rem", fontWeight: 500, cursor: "pointer", textTransform: "capitalize",
                background: period === p ? "#A52A2A" : "#fff",
                color:      period === p ? "#fff"    : "#4A4A4A",
                border: `1px solid ${period === p ? "#A52A2A" : "#E8E2E0"}`,
              }}
            >
              {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Active Work Orders" value={String(prodWOs)} sub={`Completion: ${prodRate}`} icon={Factory} />
        <KPICard label="Production Rate" value={prodRate} icon={TrendingUp} accent="#2E7D32" />
        <KPICard label="Workers Present" value={String(workersPresent)} sub={`of ${workersTotal} active`} icon={Users} accent="#1565C0" />
        <KPICard label="Inventory Value" value={invValue} sub={`${kpis?.lowStockCount ?? 0} low stock`} icon={Package} accent="#4E342E" />
        <KPICard label="Active Orders" value={String(activeOrders)} sub={`${kpis?.pendingClientOrders ?? 0} pending`} icon={ShoppingCart} accent="#E65100" />
        <KPICard label="Pending POs" value={String(pendingPOs)} icon={Truck} accent="#C0392B" />
        <KPICard label="Security Alerts" value={activeAlertCnt} sub={`${kpis?.criticalIncidents ?? 0} critical`} icon={Shield} accent="#C0392B" />
        <KPICard label="Scrap This Month" value={totalScrap} icon={AlertTriangle} accent="#E65100" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Production trend — use scrap trend as proxy for real data until prod trend endpoint added */}
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader title="Production vs Target" subtitle="Expected vs Actual units produced" />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={FALLBACK_PROD_TREND} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "0.8rem", border: "1px solid #E8E2E0", borderRadius: "0.375rem" }} />
                <Area type="monotone" dataKey="expected" stroke="#D4BFBB" fill="#F7F3F2" strokeWidth={1.5} name="Expected" />
                <Area type="monotone" dataKey="actual"   stroke="#A52A2A" fill="#FDF5F5" strokeWidth={2}   name="Actual" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Order status pie */}
        <Card>
          <CardHeader title="Order Status" subtitle="Distribution by status" />
          <div className="p-4 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={orderPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                  {orderPie.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} orders`, n]} contentStyle={{ fontSize: "0.8rem" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full mt-2">
              {orderPie.map((o) => (
                <div key={o.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.color }} />
                  <span style={{ fontSize: "0.72rem", color: "#7A6C6A" }}>{o.name}: {o.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Attendance trend */}
        <Card>
          <CardHeader title="Attendance Trend" subtitle="Present count (last 7 days)" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={attTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                <Line type="monotone" dataKey="present" stroke="#1565C0" strokeWidth={2} dot={{ r: 3, fill: "#1565C0" }} name="Present" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Scrap by dept */}
        <Card>
          <CardHeader title="Scrap by Department" subtitle="kg this month" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={scrapTrend} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="dept" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} width={55} />
                <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                <Bar dataKey="scrap" fill="#A52A2A" radius={[0, 3, 3, 0]} name="Scrap (kg)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* AI Insights */}
        <Card>
          <CardHeader title="AI Insights" subtitle="Live recommendations" actions={<Zap size={14} color="#A52A2A" />} />
          <div className="p-4 flex flex-col gap-2">
            {aiInsights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-md"
                style={{
                  background: ins.type === "warn" ? "#FFF8F8" : ins.type === "success" ? "#F0FAF0" : "#F0F4FF",
                  border: `1px solid ${ins.type === "warn" ? "#FFCDD2" : ins.type === "success" ? "#C8E6C9" : "#C5CAE9"}`,
                }}>
                <span style={{ fontSize: "0.875rem", marginTop: "0.05rem" }}>
                  {ins.type === "warn" ? "⚠" : ins.type === "success" ? "✓" : "ℹ"}
                </span>
                <p style={{ fontSize: "0.75rem", color: "#2C2C2C", lineHeight: 1.5 }}>{ins.msg}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Security Alerts */}
        <Card>
          <CardHeader title="Security Alerts" subtitle="Active incidents"
            actions={<Btn size="sm" onClick={() => onNavigate("security-live")}>View All</Btn>}
          />
          <div>
            {liveAlerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid #F7F3F2" }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: a.severity === "critical" ? "#C0392B" : a.severity === "high" ? "#E65100" : a.severity === "medium" ? "#F57F17" : "#2E7D32" }}
                />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#1C1C1C" }}>{a.type}</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{a.location} · {a.time}</p>
                </div>
                <StatusBadge status={a.status} />
                <StatusBadge status={a.severity} />
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader title="Recent Orders" subtitle="Latest client orders"
            actions={<Btn size="sm" onClick={() => onNavigate("orders-client")}>View All</Btn>}
          />
          <div>
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid #F7F3F2" }}>
                <div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#A52A2A" }}>{o.id}</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{o.date}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#1C1C1C" }}>{o.client}</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{o.product} · {o.qty} pcs</p>
                </div>
                <StatusBadge status={o.status} label={o.status.replace(/-/g, " ")} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-5">
        <Card>
          <div className="px-5 py-4 flex flex-wrap gap-3">
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#7A6C6A", alignSelf: "center", marginRight: "0.5rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Quick Actions:
            </p>
            <Btn onClick={() => onNavigate("orders-client")}><Plus size={14} /> New Client Order</Btn>
            <Btn onClick={() => onNavigate("orders-supplier")}><ShoppingCart size={14} /> Purchase Order</Btn>
            <Btn onClick={() => onNavigate("production-workforce")} variant="secondary"><UserPlus size={14} /> Add Worker</Btn>
            <Btn onClick={() => onNavigate("reports")} variant="secondary"><FileText size={14} /> Generate Report</Btn>
            <Btn onClick={() => onNavigate("security-live")} variant="secondary"><Shield size={14} /> Security Monitor</Btn>
            <Btn onClick={() => onNavigate("inventory-calculator")} variant="secondary"><CheckCircle2 size={14} /> Production Calc</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
