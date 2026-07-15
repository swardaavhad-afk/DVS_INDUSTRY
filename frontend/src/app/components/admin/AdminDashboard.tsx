import { useState } from "react";
import {
  Factory, Users, Package, ShoppingCart, Shield, AlertTriangle, TrendingUp,
  Truck, Plus, FileText, UserPlus, CheckCircle2, Clock, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { KPICard, Card, CardHeader, StatusBadge, Btn } from "../shared/UI";

const prodTrend = [
  { day: "Mon", expected: 420, actual: 398 },
  { day: "Tue", expected: 420, actual: 411 },
  { day: "Wed", expected: 420, actual: 435 },
  { day: "Thu", expected: 420, actual: 389 },
  { day: "Fri", expected: 420, actual: 427 },
  { day: "Sat", expected: 380, actual: 362 },
  { day: "Sun", expected: 200, actual: 188 },
];

const attendanceTrend = [
  { day: "Mon", present: 334 }, { day: "Tue", present: 341 },
  { day: "Wed", present: 328 }, { day: "Thu", present: 347 },
  { day: "Fri", present: 339 }, { day: "Sat", present: 298 },
  { day: "Sun", present: 142 },
];

const deptScrap = [
  { dept: "Cutting", scrap: 42 }, { dept: "Welding", scrap: 18 },
  { dept: "Pressing", scrap: 31 }, { dept: "Assembly", scrap: 9 },
  { dept: "Finishing", scrap: 14 },
];

const orderPie = [
  { name: "Pending", value: 18, color: "#E65100" },
  { name: "In Production", value: 24, color: "#A52A2A" },
  { name: "Dispatched", value: 12, color: "#1565C0" },
  { name: "Delivered", value: 46, color: "#2E7D32" },
];

const alerts = [
  { id: "ALT-001", type: "PPE Violation", location: "Zone B, Cam 4", severity: "high", status: "open", time: "09:14" },
  { id: "ALT-002", type: "Unauthorized Entry", location: "Gate 3", severity: "critical", status: "investigating", time: "08:47" },
  { id: "ALT-003", type: "Inventory Threshold", location: "Warehouse A", severity: "medium", status: "open", time: "08:30" },
  { id: "ALT-004", type: "Crowd Formation", location: "Zone D", severity: "low", status: "resolved", time: "07:55" },
];

const recentOrders = [
  { id: "ORD-2841", client: "Reliance Eng.", product: "Steel Frames", qty: 500, status: "in-production", date: "12 Jun" },
  { id: "ORD-2842", client: "Tata Motors", product: "Pressed Panels", qty: 200, status: "dispatched", date: "11 Jun" },
  { id: "ORD-2843", client: "Mahindra Ltd.", product: "Aluminium Parts", qty: 350, status: "pending", date: "11 Jun" },
  { id: "ORD-2844", client: "L&T Ltd.", product: "Copper Wire", qty: 150, status: "approved", date: "10 Jun" },
];

const aiInsights = [
  { type: "warn", msg: "Scrap increasing in Cutting Department — 14% above weekly average" },
  { type: "warn", msg: "Steel sheet inventory below threshold (42 kg remaining, min 100 kg)" },
  { type: "warn", msg: "Morning shift productivity 11% below target — 3 consecutive days" },
  { type: "info", msg: "Security alert ALT-002 unresolved for 87 minutes — assign investigator" },
  { type: "success", msg: "Supplier SteelCorp PO-2847 delivery confirmed for today 14:00" },
];

export function AdminDashboard({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1C1C1C" }}>Operations Dashboard</h1>
          <p style={{ fontSize: "0.8375rem", color: "#7A6C6A" }}>DVS Industries — Friday, 12 June 2026 · 09:31 IST</p>
        </div>
        <div className="flex gap-2">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "0.375rem 0.875rem",
                borderRadius: "0.375rem",
                fontSize: "0.775rem",
                fontWeight: 500,
                background: period === p ? "#A52A2A" : "#fff",
                color: period === p ? "#fff" : "#4A4A4A",
                border: `1px solid ${period === p ? "#A52A2A" : "#E8E2E0"}`,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Production Today" value="427 pcs" trend="+2.3%" trendDir="up" sub="Target: 420" icon={Factory} />
        <KPICard label="Efficiency" value="94.7%" trend="+1.2%" trendDir="up" sub="vs last week" icon={TrendingUp} accent="#2E7D32" />
        <KPICard label="Workers Present" value="347" trend="-4" trendDir="down" sub="of 358 total" icon={Users} accent="#1565C0" />
        <KPICard label="Inventory Value" value="₹48.2L" trend="+3.1%" trendDir="up" sub="across 6 materials" icon={Package} accent="#4E342E" />
        <KPICard label="Active Orders" value="54" sub="24 in production" icon={ShoppingCart} accent="#E65100" />
        <KPICard label="Pending Deliveries" value="12" sub="3 overdue" icon={Truck} accent="#C0392B" trendDir="down" trend="3 overdue" />
        <KPICard label="Security Alerts" value="6" sub="2 critical open" icon={Shield} accent="#C0392B" trendDir="down" />
        <KPICard label="Scrap Today" value="18.4 kg" trend="+14%" trendDir="down" sub="Cutting dept high" icon={AlertTriangle} accent="#E65100" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Production trend */}
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader title="Production vs Target" subtitle="Expected vs Actual units produced" />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={prodTrend} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "0.8rem", border: "1px solid #E8E2E0", borderRadius: "0.375rem" }} />
                <Area id="area-expected" type="monotone" dataKey="expected" stroke="#D4BFBB" fill="#F7F3F2" strokeWidth={1.5} name="Expected" />
                <Area id="area-actual" type="monotone" dataKey="actual" stroke="#A52A2A" fill="#FDF5F5" strokeWidth={2} name="Actual" />
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
        {/* Attendance */}
        <Card>
          <CardHeader title="Attendance Trend" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} domain={[100, 370]} />
                <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                <Line type="monotone" dataKey="present" stroke="#1565C0" strokeWidth={2} dot={{ r: 3, fill: "#1565C0" }} name="Present" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Scrap by dept */}
        <Card>
          <CardHeader title="Scrap by Department" subtitle="kg today" />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={deptScrap} layout="vertical">
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
              <div
                key={i}
                className="flex items-start gap-2 p-2.5 rounded-md"
                style={{
                  background: ins.type === "warn" ? "#FFF8F8" : ins.type === "success" ? "#F0FAF0" : "#F0F4FF",
                  border: `1px solid ${ins.type === "warn" ? "#FFCDD2" : ins.type === "success" ? "#C8E6C9" : "#C5CAE9"}`,
                }}
              >
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
          <CardHeader
            title="Security Alerts"
            subtitle="Active incidents"
            actions={<Btn size="sm" onClick={() => onNavigate("security-live")}>View All</Btn>}
          />
          <div>
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: "1px solid #F7F3F2" }}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: a.severity === "critical" ? "#C0392B" : a.severity === "high" ? "#E65100" : a.severity === "medium" ? "#F57F17" : "#2E7D32",
                  }}
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
          <CardHeader
            title="Recent Orders"
            subtitle="Latest client orders"
            actions={<Btn size="sm" onClick={() => onNavigate("orders-client")}>View All</Btn>}
          />
          <div>
            {recentOrders.map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: "1px solid #F7F3F2" }}
              >
                <div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#A52A2A" }}>{o.id}</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{o.date}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#1C1C1C" }}>{o.client}</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{o.product} · {o.qty} pcs</p>
                </div>
                <StatusBadge status={o.status} label={o.status.replace("-", " ")} />
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
