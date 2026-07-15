import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, Download, CheckCircle2, XCircle, Edit2, Upload, Truck, MessageSquare, Star,
  TrendingUp, Package, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../shared/AppShell";
import { PageHeader, KPICard, Card, CardHeader, StatusBadge, Btn, DataTable, TabBar } from "../shared/UI";

const catalog = [
  { id: "MAT-S01", name: "Steel Sheet 2mm", qty: 4800, price: 72, lead: "2 days", minOrder: 100, unit: "kg", status: "available" },
  { id: "MAT-S02", name: "Steel Sheet 4mm", qty: 2200, price: 88, lead: "3 days", minOrder: 100, unit: "kg", status: "available" },
  { id: "MAT-S03", name: "Steel Tube 25mm", qty: 800, price: 94, lead: "4 days", minOrder: 50, unit: "kg", status: "low" },
  { id: "MAT-S04", name: "HR Steel Coil", qty: 0, price: 68, lead: "7 days", minOrder: 500, unit: "kg", status: "unavailable" },
];

const receivedOrders = [
  { id: "PO-2847", client: "DVS Industries", material: "Steel Sheet 2mm", qty: "500 kg", orderDate: "10 Jun", deadline: "12 Jun", value: "₹36,000", status: "delivered" },
  { id: "PO-2848", client: "DVS Industries", material: "Steel Tube 25mm", qty: "200 kg", orderDate: "09 Jun", deadline: "13 Jun", value: "₹18,800", status: "in-production" },
  { id: "PO-2850", client: "DVS Industries", material: "HR Steel Coil", qty: "300 kg", orderDate: "07 Jun", deadline: "11 Jun", value: "₹20,400", status: "pending" },
];

const deliveries = [
  { id: "DEL-481", po: "PO-2847", material: "Steel Sheet 2mm", qty: "500 kg", dispatchDate: "11 Jun", expectedDel: "12 Jun", status: "delivered", tracking: "DVS-TRK-8421" },
  { id: "DEL-482", po: "PO-2848", material: "Steel Tube 25mm", qty: "200 kg", dispatchDate: "–", expectedDel: "13 Jun", status: "pending", tracking: "–" },
];

const messages = [
  { from: "DVS Procurement", time: "09:15", msg: "PO-2850 has been approved. Please confirm dispatch date.", unread: true },
  { from: "DVS Procurement", time: "08:30 yesterday", msg: "Can you expedite PO-2848 delivery to 12 Jun?", unread: false },
  { from: "DVS Accounts", time: "2 days ago", msg: "Invoice INV-2021 has been processed. Payment within 7 days.", unread: false },
];

const perfTrend = [
  { month: "Jan", onTime: 96 }, { month: "Feb", onTime: 94 }, { month: "Mar", onTime: 98 },
  { month: "Apr", onTime: 97 }, { month: "May", onTime: 99 }, { month: "Jun", onTime: 98 },
];

const revenueTrend = [
  { month: "Jan", revenue: 8.2 }, { month: "Feb", revenue: 7.8 }, { month: "Mar", revenue: 9.4 },
  { month: "Apr", revenue: 8.9 }, { month: "May", revenue: 10.2 }, { month: "Jun", revenue: 7.5 },
];

function SupplierDashboard({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Supplier Dashboard</h1>
          <p style={{ fontSize: "0.8375rem", color: "#7A6C6A" }}>SteelCorp Ltd. · Partner ID: SUP-0041 · Friday, 12 June 2026</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <KPICard label="Active Orders" value="3" sub="from DVS" accent="#2E7D32" />
        <KPICard label="Pending Deliveries" value="2" accent="#E65100" />
        <KPICard label="Completed (Month)" value="12" trend="+2 vs last" trendDir="up" accent="#2E7D32" />
        <KPICard label="Revenue (Jun)" value="₹7.5L" accent="#4E342E" />
        <KPICard label="Materials Supplied" value="2,800 kg" sub="this month" accent="#1565C0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader title="Revenue Trend" subtitle="Monthly revenue (₹ Lakhs)" />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "0.8rem" }} formatter={(v) => [`₹${v}L`]} />
                <Bar dataKey="revenue" fill="#2E7D32" radius={[3, 3, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Performance Score" />
          <div className="p-5 flex flex-col items-center justify-center">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #E8F5E9, #C8E6C9)", border: "4px solid #2E7D32" }}
            >
              <div className="text-center">
                <p style={{ fontSize: "1.6rem", fontWeight: 800, color: "#2E7D32" }}>98</p>
                <p style={{ fontSize: "0.7rem", color: "#2E7D32", fontWeight: 600 }}>/ 100</p>
              </div>
            </div>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1C1C1C" }}>Excellent Supplier</p>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={14} color="#F57F17" fill="#F57F17" />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Recent Orders from DVS" actions={<Btn size="sm" onClick={() => onNavigate("purchase-orders")}>View All</Btn>} />
          {receivedOrders.map((o) => (
            <div key={o.id} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid #F7F3F2" }}>
              <div>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2E7D32" }}>{o.id}</p>
                <p style={{ fontSize: "0.7rem", color: "#9A8A88" }}>{o.orderDate}</p>
              </div>
              <div className="flex-1">
                <p style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{o.material}</p>
                <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{o.qty} · {o.value}</p>
              </div>
              <StatusBadge status={o.status} label={o.status.replace("-", " ")} />
            </div>
          ))}
        </Card>

        <Card>
          <CardHeader title="Messages from DVS" actions={<Btn size="sm" onClick={() => onNavigate("communication")}>View All</Btn>} />
          {messages.map((m, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid #F7F3F2", background: m.unread ? "#F0FAF0" : "transparent" }}>
              {m.unread && <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#2E7D32" }} />}
              <div>
                <div className="flex items-center gap-2">
                  <p style={{ fontSize: "0.8rem", fontWeight: 600 }}>{m.from}</p>
                  <span style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{m.time}</span>
                </div>
                <p style={{ fontSize: "0.775rem", color: "#4A4A4A", marginTop: "0.2rem" }}>{m.msg}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function MaterialCatalog() {
  return (
    <div className="p-6">
      <PageHeader title="Material Catalog" subtitle="Manage your product offerings and availability" actions={<Btn size="sm" onClick={() => toast.success("Material added successfully")}><Plus size={14} /> Add Material</Btn>} />
      <Card>
        <DataTable
          searchable
          paginate={10}
          columns={[
            { key: "id", label: "Material ID" },
            { key: "name", label: "Material Name" },
            { key: "qty", label: "Available Qty" },
            { key: "price", label: "Price/kg" },
            { key: "lead", label: "Lead Time" },
            { key: "minOrder", label: "Min Order" },
            { key: "status", label: "Status" },
            { key: "actions", label: "Actions" },
          ]}
          rows={catalog.map((m) => ({
            id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#2E7D32" }}>{m.id}</span>,
            name: <span style={{ fontWeight: 500 }}>{m.name}</span>,
            qty: <span style={{ fontWeight: 600 }}>{m.qty.toLocaleString()} {m.unit}</span>,
            price: `₹${m.price}/${m.unit}`,
            lead: m.lead,
            minOrder: `${m.minOrder} ${m.unit}`,
            status: (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{
                  fontSize: "0.72rem", fontWeight: 600,
                  background: m.status === "available" ? "#E8F5E9" : m.status === "low" ? "#FFF8E1" : "#FFEBEE",
                  color: m.status === "available" ? "#2E7D32" : m.status === "low" ? "#F57F17" : "#C0392B",
                }}
              >
                {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
              </span>
            ),
            actions: (
              <div className="flex gap-1.5">
                <Btn size="sm" variant="secondary"><Edit2 size={12} /> Update Price</Btn>
                <Btn size="sm" variant="ghost"><Edit2 size={12} /></Btn>
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}

function PurchaseOrders() {
  return (
    <div className="p-6">
      <PageHeader title="Purchase Orders" subtitle="Orders received from DVS Industries" />
      <Card>
        <DataTable
          searchable
          paginate={10}
          columns={[
            { key: "id", label: "PO Number" },
            { key: "material", label: "Material" },
            { key: "qty", label: "Quantity" },
            { key: "orderDate", label: "Order Date" },
            { key: "deadline", label: "Deadline" },
            { key: "value", label: "Value" },
            { key: "status", label: "Status" },
            { key: "actions", label: "Actions" },
          ]}
          rows={receivedOrders.map((o) => ({
            id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#2E7D32", fontWeight: 600 }}>{o.id}</span>,
            material: <span style={{ fontWeight: 500 }}>{o.material}</span>,
            qty: o.qty,
            orderDate: o.orderDate,
            deadline: <span style={{ fontWeight: 500, color: o.status === "pending" ? "#E65100" : "#4A4A4A" }}>{o.deadline}</span>,
            value: <span style={{ fontWeight: 600 }}>{o.value}</span>,
            status: <StatusBadge status={o.status} label={o.status.replace("-", " ")} />,
            actions: (
              <div className="flex gap-1.5">
                {o.status === "pending" && (
                  <>
                    <Btn size="sm" variant="success" onClick={() => toast.success(`${o.id} accepted successfully`)}><CheckCircle2 size={12} /> Accept</Btn>
                    <Btn size="sm" variant="danger" onClick={() => toast.error(`${o.id} rejected`)}><XCircle size={12} /> Reject</Btn>
                  </>
                )}
                {o.status === "in-production" && <Btn size="sm" onClick={() => toast.success(`${o.id} dispatched successfully`)}><Truck size={12} /> Dispatch</Btn>}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}

function DeliveryManagement() {
  return (
    <div className="p-6">
      <PageHeader title="Delivery Management" subtitle="Track shipments and upload invoices" />
      <Card className="mb-5">
        <DataTable
          searchable
          paginate={10}
          columns={[
            { key: "id", label: "Delivery ID" },
            { key: "po", label: "PO Ref." },
            { key: "material", label: "Material" },
            { key: "qty", label: "Quantity" },
            { key: "dispatch", label: "Dispatch Date" },
            { key: "expected", label: "Expected Del." },
            { key: "tracking", label: "Tracking No." },
            { key: "status", label: "Status" },
            { key: "actions", label: "Actions" },
          ]}
          rows={deliveries.map((d) => ({
            id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#2E7D32" }}>{d.id}</span>,
            po: d.po,
            material: d.material,
            qty: d.qty,
            dispatch: d.dispatchDate,
            expected: d.expectedDel,
            tracking: <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>{d.tracking}</span>,
            status: <StatusBadge status={d.status} label={d.status.replace("-", " ")} />,
            actions: (
              <div className="flex gap-1.5">
                <Btn size="sm" variant="secondary" onClick={() => toast.success("Invoice uploaded successfully")}><Upload size={12} /> Invoice</Btn>
                {d.status === "pending" && <Btn size="sm" onClick={() => toast.success(`${d.id} dispatched successfully`)}><Truck size={12} /> Dispatch</Btn>}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}

function Communication() {
  const [message, setMessage] = useState("");
  return (
    <div className="p-6">
      <PageHeader title="Communication Center" subtitle="Messages and queries from DVS Industries" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader title="Message Thread — DVS Procurement" />
          <div className="p-5 flex flex-col gap-3 min-h-64">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col max-w-[80%] ${i % 2 === 0 ? "self-start" : "self-end items-end"}`}>
                <div
                  className="px-4 py-3 rounded-xl"
                  style={{
                    background: i % 2 === 0 ? "#F0FAF0" : "#A52A2A",
                    color: i % 2 === 0 ? "#1C1C1C" : "#fff",
                    fontSize: "0.8375rem", lineHeight: 1.55,
                  }}
                >
                  {m.msg}
                </div>
                <span style={{ fontSize: "0.7rem", color: "#9A8A88", marginTop: "0.25rem" }}>{m.time}</span>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5 flex gap-2">
            <input
              placeholder="Type a reply..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ flex: 1, padding: "0.625rem 0.875rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", outline: "none" }}
            />
            <Btn onClick={() => { if (message.trim()) { toast.success("Message sent successfully"); setMessage(""); } else { toast.error("Please enter a message"); } }}>Send</Btn>
          </div>
        </Card>

        <Card>
          <CardHeader title="Notifications" />
          <div className="p-4 flex flex-col gap-2">
            {[
              { type: "success", msg: "PO-2847 marked as delivered by DVS" },
              { type: "info", msg: "PO-2850 approved — confirm dispatch" },
              { type: "warn", msg: "Delivery DEL-482 due tomorrow" },
            ].map((n, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-3 rounded-md"
                style={{ background: n.type === "success" ? "#F0FAF0" : n.type === "warn" ? "#FFF8F8" : "#F0F4FF", border: `1px solid ${n.type === "success" ? "#C8E6C9" : n.type === "warn" ? "#FFCDD2" : "#C5CAE9"}` }}
              >
                <span style={{ fontSize: "0.875rem" }}>{n.type === "success" ? "✓" : n.type === "warn" ? "⚠" : "ℹ"}</span>
                <p style={{ fontSize: "0.775rem", lineHeight: 1.5 }}>{n.msg}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SupplierPerformance() {
  return (
    <div className="p-6">
      <PageHeader title="My Performance" subtitle="On-time delivery, quality, and reliability metrics" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KPICard label="On-Time Delivery" value="98.2%" trend="+0.5% MoM" trendDir="up" accent="#2E7D32" />
        <KPICard label="Order Completion" value="100%" accent="#2E7D32" />
        <KPICard label="Quality Rating" value="4.8/5.0" accent="#F57F17" trendDir="up" trend="Excellent" />
        <KPICard label="Supplier Score" value="98/100" trend="Top 5%" trendDir="up" accent="#2E7D32" />
      </div>
      <Card>
        <CardHeader title="On-Time Delivery Trend" />
        <div className="p-5">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={perfTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} domain={[88, 100]} />
              <Tooltip contentStyle={{ fontSize: "0.8rem" }} formatter={(v) => [`${v}%`]} />
              <Line type="monotone" dataKey="onTime" stroke="#2E7D32" strokeWidth={2} name="On-Time %" dot={{ r: 4, fill: "#2E7D32" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function SupplierReports() {
  return (
    <div className="p-6">
      <PageHeader title="Reports" subtitle="Download orders, supply, and revenue reports" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {["Orders Received Report", "Materials Supplied Report", "Revenue Summary", "Monthly Performance Report", "Delivery Tracker Report", "Invoice History"].map((r) => (
          <div key={r} className="flex items-center justify-between p-4 rounded-lg" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{r}</span>
            <div className="flex gap-2">
              <Btn size="sm" variant="secondary" onClick={() => toast.success("Report downloaded successfully")}><Download size={12} /> PDF</Btn>
              <Btn size="sm" variant="ghost" onClick={() => toast.success("Report downloaded successfully")}><Download size={12} /> CSV</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SupplierApp({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState("dashboard");

  const renderSection = () => {
    switch (section) {
      case "dashboard": return <SupplierDashboard onNavigate={setSection} />;
      case "catalog": return <MaterialCatalog />;
      case "purchase-orders": return <PurchaseOrders />;
      case "delivery": return <DeliveryManagement />;
      case "communication": return <Communication />;
      case "performance": return <SupplierPerformance />;
      case "reports": return <SupplierReports />;
      default: return <SupplierDashboard onNavigate={setSection} />;
    }
  };

  return (
    <AppShell role="supplier" activeSection={section} onSectionChange={setSection} onLogout={onLogout} notificationCount={3}>
      {renderSection()}
    </AppShell>
  );
}
