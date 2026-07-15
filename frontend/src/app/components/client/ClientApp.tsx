import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import {
  Plus, Download, Search, Eye, CheckCircle2, ShoppingCart, MapPin,
  Package, Truck, Bell, Headphones, FileText, Star, MessageSquare,
  Clock, AlertCircle, Filter, X, ChevronRight, CreditCard, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../shared/AppShell";
import { PageHeader, KPICard, Card, CardHeader, StatusBadge, Btn, DataTable } from "../shared/UI";

/* ─── Mock Data ─── */
const products = [
  {
    id: "PRD-001", name: "Steel Frame Assembly", category: "Structural", thickness: "2mm", material: "Steel",
    price: 364, unit: "pc", availability: "in stock", minQty: 50, leadTime: "7 days",
    specs: ["Grade: IS 2062", "Finish: Galvanized", "Tolerance: ±0.2mm"],
    description: "Heavy-duty steel frame used in automotive and industrial applications.",
  },
  {
    id: "PRD-002", name: "Pressed Aluminium Panel", category: "Sheet Metal", thickness: "1.5mm", material: "Aluminium",
    price: 520, unit: "pc", availability: "in stock", minQty: 20, leadTime: "5 days",
    specs: ["Grade: AA 6061", "Finish: Anodized", "Tolerance: ±0.15mm"],
    description: "Lightweight aluminium panels for enclosures and body panels.",
  },
  {
    id: "PRD-003", name: "Copper Bus Bar", category: "Electrical", thickness: "5mm", material: "Copper",
    price: 1240, unit: "pc", availability: "limited", minQty: 10, leadTime: "10 days",
    specs: ["Purity: 99.9% ETP", "Finish: Tin Plated", "Standard: IEC 60890"],
    description: "High-conductivity copper bus bars for electrical switchgear.",
  },
  {
    id: "PRD-004", name: "Sheet Metal Bracket", category: "Structural", thickness: "3mm", material: "Steel",
    price: 185, unit: "pc", availability: "in stock", minQty: 100, leadTime: "4 days",
    specs: ["Grade: CR4", "Finish: Powder Coated", "Tolerance: ±0.25mm"],
    description: "Precision-bent sheet metal brackets for mounting and support.",
  },
  {
    id: "PRD-005", name: "Welded Tube Assembly", category: "Structural", thickness: "4mm", material: "Steel",
    price: 890, unit: "pc", availability: "out of stock", minQty: 25, leadTime: "14 days",
    specs: ["Grade: ERW", "Finish: Painted", "Standard: IS 1239"],
    description: "Welded steel tube assemblies for framing and structural support.",
  },
  {
    id: "PRD-006", name: "Aluminium Extrusion Profile", category: "Profiles", thickness: "6mm", material: "Aluminium",
    price: 680, unit: "meter", availability: "in stock", minQty: 50, leadTime: "6 days",
    specs: ["Grade: AA 6063-T5", "Finish: Mill", "Tolerance: ±0.3mm"],
    description: "Custom aluminium extrusion profiles for framing systems.",
  },
];

const myOrders = [
  { id: "ORD-2841", product: "Steel Frame Assembly", qty: 500, orderDate: "10 Jun", requiredDate: "20 Jun", dispatchDate: "–", deliveryDate: "–", value: "₹1,82,000", status: "in-production", invoiceReady: false },
  { id: "ORD-2842", product: "Pressed Aluminium Panel", qty: 200, orderDate: "09 Jun", requiredDate: "18 Jun", dispatchDate: "11 Jun", deliveryDate: "–", value: "₹1,04,000", status: "dispatched", invoiceReady: true },
  { id: "ORD-2845", product: "Sheet Metal Bracket", qty: 800, orderDate: "07 Jun", requiredDate: "12 Jun", dispatchDate: "10 Jun", deliveryDate: "12 Jun", value: "₹1,48,000", status: "delivered", invoiceReady: true },
  { id: "ORD-2846", product: "Welded Tube Assembly", qty: 100, orderDate: "05 Jun", requiredDate: "10 Jun", dispatchDate: "08 Jun", deliveryDate: "10 Jun", value: "₹89,000", status: "delivered", invoiceReady: true },
  { id: "ORD-2833", product: "Copper Bus Bar", qty: 50, orderDate: "28 May", requiredDate: "06 Jun", dispatchDate: "04 Jun", deliveryDate: "06 Jun", value: "₹62,000", status: "delivered", invoiceReady: true },
];

const shipmentTracking = [
  {
    id: "ORD-2842", product: "Pressed Aluminium Panel", qty: 200,
    orderDate: "09 Jun", dispatchDate: "11 Jun", expectedDel: "14 Jun",
    trackingNo: "DVS-TRK-8422", carrier: "Blue Dart",
    status: "dispatched",
    timeline: [
      { label: "Order Placed", date: "09 Jun 10:20", done: true },
      { label: "Order Approved", date: "09 Jun 14:35", done: true },
      { label: "In Production", date: "10 Jun 08:00", done: true },
      { label: "Quality Check", date: "11 Jun 11:00", done: true },
      { label: "Dispatched", date: "11 Jun 15:30", done: true },
      { label: "Out for Delivery", date: "13 Jun (est.)", done: false },
      { label: "Delivered", date: "14 Jun (est.)", done: false },
    ],
  },
  {
    id: "ORD-2841", product: "Steel Frame Assembly", qty: 500,
    orderDate: "10 Jun", dispatchDate: "–", expectedDel: "20 Jun",
    trackingNo: "–", carrier: "–",
    status: "in-production",
    timeline: [
      { label: "Order Placed", date: "10 Jun 09:15", done: true },
      { label: "Order Approved", date: "10 Jun 16:00", done: true },
      { label: "In Production", date: "11 Jun 08:00", done: true },
      { label: "Quality Check", date: "18 Jun (est.)", done: false },
      { label: "Dispatched", date: "19 Jun (est.)", done: false },
      { label: "Out for Delivery", date: "19 Jun (est.)", done: false },
      { label: "Delivered", date: "20 Jun (est.)", done: false },
    ],
  },
];

const notifications = [
  { id: 1, type: "success", title: "Order Delivered", msg: "ORD-2845 — Sheet Metal Brackets (800 pcs) delivered successfully on 12 Jun.", time: "12 Jun 14:22", read: false },
  { id: 2, type: "info", title: "Order Dispatched", msg: "ORD-2842 — Aluminium Panels dispatched via Blue Dart. ETA: 14 Jun.", time: "11 Jun 15:30", read: false },
  { id: 3, type: "info", title: "In Production", msg: "ORD-2841 — Steel Frames entered production on 11 Jun. Expected completion: 18 Jun.", time: "11 Jun 08:00", read: true },
  { id: 4, type: "success", title: "Order Approved", msg: "ORD-2841 approved by DVS Industries procurement team.", time: "10 Jun 16:00", read: true },
  { id: 5, type: "warn", title: "Invoice Available", msg: "Invoice INV-2842 for ORD-2842 is available for download.", time: "11 Jun 15:45", read: true },
];

const tickets = [
  { id: "TKT-041", subject: "Delivery date change request for ORD-2841", priority: "medium", status: "open", created: "11 Jun", lastUpdate: "12 Jun" },
  { id: "TKT-039", subject: "Quality issue — minor surface marks on ORD-2845", priority: "low", status: "resolved", created: "12 Jun", lastUpdate: "12 Jun" },
];

const spendTrend = [
  { month: "Jan", spend: 4.2 }, { month: "Feb", spend: 3.8 }, { month: "Mar", spend: 6.1 },
  { month: "Apr", spend: 5.4 }, { month: "May", spend: 7.2 }, { month: "Jun", spend: 5.8 },
];

const categorySpend = [
  { category: "Structural", spend: 18.4 }, { category: "Sheet Metal", spend: 9.2 },
  { category: "Electrical", spend: 6.1 }, { category: "Profiles", spend: 4.8 },
];

/* ─── Cart Context (simple local state) ─── */
interface CartItem { product: typeof products[0]; qty: number }

/* ─── Dashboard ─── */
function ClientDashboard({ onNavigate }: { onNavigate: (s: string) => void }) {
  const activeOrders = myOrders.filter((o) => !["delivered"].includes(o.status)).length;
  const completed = myOrders.filter((o) => o.status === "delivered").length;
  const totalSpend = myOrders.filter((o) => o.status === "delivered")
    .reduce((s, o) => s + parseInt(o.value.replace(/[₹,]/g, "")), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Client Dashboard</h1>
          <p style={{ fontSize: "0.8375rem", color: "#7A6C6A" }}>Reliance Engineering · Partner ID: CLT-0018 · Friday, 12 June 2026</p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => onNavigate("orders")}><Plus size={14} /> New Order</Btn>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KPICard label="Active Orders" value={activeOrders} sub="in progress" accent="#A52A2A" />
        <KPICard label="Completed Orders" value={completed} trend="This quarter" trendDir="up" accent="#2E7D32" />
        <KPICard label="Pending Deliveries" value="2" sub="ETA within 5 days" accent="#E65100" />
        <KPICard label="Total Spend (Jun)" value="₹5.8L" trend="+8% vs May" trendDir="up" accent="#4E342E" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader title="Monthly Spend" subtitle="₹ Lakhs" />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={spendTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "0.8rem" }} formatter={(v) => [`₹${v}L`]} />
                <Area type="monotone" dataKey="spend" stroke="#A52A2A" fill="#FDF5F5" strokeWidth={2} name="Spend" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent notifications */}
        <Card>
          <CardHeader title="Recent Notifications" actions={<Btn size="sm" variant="ghost" onClick={() => onNavigate("notifications")}>View All</Btn>} />
          <div className="p-4 flex flex-col gap-2">
            {notifications.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2.5 p-3 rounded-lg"
                style={{
                  background: !n.read
                    ? n.type === "success" ? "#F0FAF0" : n.type === "warn" ? "#FFFBF0" : "#F0F4FF"
                    : "#FAFAFA",
                  border: `1px solid ${!n.read ? n.type === "success" ? "#C8E6C9" : n.type === "warn" ? "#FFE082" : "#C5CAE9" : "#F0ECEB"}`,
                }}
              >
                <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "0.05rem" }}>
                  {n.type === "success" ? "✅" : n.type === "warn" ? "⚡" : "📦"}
                </span>
                <div>
                  <p style={{ fontSize: "0.775rem", fontWeight: 600, color: "#1C1C1C" }}>{n.title}</p>
                  <p style={{ fontSize: "0.72rem", color: "#7A6C6A", lineHeight: 1.45, marginTop: "0.1rem" }}>{n.msg.substring(0, 60)}…</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Active orders + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader title="Active Orders" subtitle="Orders currently in progress" actions={<Btn size="sm" variant="ghost" onClick={() => onNavigate("orders")}>View All</Btn>} />
          <div>
            {myOrders.filter((o) => o.status !== "delivered").map((o, i, arr) => (
              <div key={o.id} className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom: i < arr.length - 1 ? "1px solid #F7F3F2" : "none" }}>
                <div className="flex-shrink-0">
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#A52A2A" }}>{o.id}</p>
                  <p style={{ fontSize: "0.7rem", color: "#9A8A88" }}>{o.orderDate}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "0.8375rem", fontWeight: 500 }}>{o.product}</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{o.qty} pcs · {o.value}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <StatusBadge status={o.status} label={o.status.replace("-", " ")} />
                  <p style={{ fontSize: "0.7rem", color: "#9A8A88", marginTop: "0.2rem" }}>Due: {o.requiredDate}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="p-4 flex flex-col gap-2.5">
            {[
              { label: "Browse Products", icon: Package, section: "catalog", color: "#A52A2A" },
              { label: "Track My Shipments", icon: MapPin, section: "tracking", color: "#1565C0" },
              { label: "View Invoices", icon: FileText, section: "orders", color: "#2E7D32" },
              { label: "Raise Support Ticket", icon: Headphones, section: "support", color: "#4E342E" },
              { label: "Download Reports", icon: Download, section: "reports", color: "#E65100" },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  onClick={() => onNavigate(a.section)}
                  className="flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all"
                  style={{ background: "#FAFAFA", border: "1px solid #E8E2E0" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${a.color}40`; e.currentTarget.style.background = `${a.color}06`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E8E2E0"; e.currentTarget.style.background = "#FAFAFA"; }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}12` }}>
                    <Icon size={15} color={a.color} />
                  </div>
                  <span style={{ fontSize: "0.8375rem", fontWeight: 500, color: "#1C1C1C" }}>{a.label}</span>
                  <ChevronRight size={14} color="#9A8A88" style={{ marginLeft: "auto" }} />
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Product Catalog ─── */
function ProductCatalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<typeof products[0] | null>(null);
  const [showCart, setShowCart] = useState(false);

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: typeof products[0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) return prev.map((c) => c.product.id === product.id ? { ...c, qty: c.qty + product.minQty } : c);
      return [...prev, { product, qty: product.minQty }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const cartTotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);

  return (
    <div className="p-6">
      <PageHeader
        title="Product Catalog"
        subtitle="Browse DVS Industries manufactured products — request quotation or place order"
        actions={
          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center gap-2 px-4 py-2 rounded-md"
            style={{ background: "#A52A2A", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}
          >
            <ShoppingCart size={15} />
            Cart
            {cart.length > 0 && (
              <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#fff", color: "#A52A2A", fontSize: "0.7rem", fontWeight: 700 }}>
                {cart.length}
              </span>
            )}
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md flex-1 min-w-48" style={{ background: "#fff", border: "1px solid #E8E2E0" }}>
          <Search size={14} color="#9A8A88" />
          <input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: "0.8375rem", flex: 1, background: "transparent" }}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                padding: "0.375rem 0.875rem", borderRadius: "0.375rem", fontSize: "0.775rem",
                background: category === c ? "#A52A2A" : "#fff",
                color: category === c ? "#fff" : "#4A4A4A",
                border: `1px solid ${category === c ? "#A52A2A" : "#E8E2E0"}`,
                cursor: "pointer", textTransform: "capitalize",
              }}
            >
              {c === "all" ? "All Products" : c}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="rounded-lg overflow-hidden"
            style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
          >
            {/* Product image placeholder */}
            <div
              className="flex items-center justify-center"
              style={{
                height: "100px",
                background: `linear-gradient(135deg, ${p.material === "Steel" ? "#F5F0EF" : p.material === "Aluminium" ? "#E8F0E8" : "#E8ECF5"}, #FFFFFF)`,
                borderBottom: "1px solid #F0ECEB",
              }}
            >
              <div className="text-center">
                <Package size={28} color={p.material === "Steel" ? "#A52A2A" : p.material === "Aluminium" ? "#2E7D32" : "#1565C0"} />
                <p style={{ fontSize: "0.65rem", color: "#9A8A88", marginTop: "0.25rem", fontWeight: 500 }}>{p.material.toUpperCase()}</p>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p style={{ fontSize: "0.8375rem", fontWeight: 700, color: "#1C1C1C" }}>{p.name}</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{p.id} · {p.category}</p>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    fontSize: "0.65rem", fontWeight: 600,
                    background: p.availability === "in stock" ? "#E8F5E9" : p.availability === "limited" ? "#FFF8E1" : "#FFEBEE",
                    color: p.availability === "in stock" ? "#2E7D32" : p.availability === "limited" ? "#F57F17" : "#C0392B",
                  }}
                >
                  {p.availability}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded-md" style={{ background: "#FAFAFA" }}>
                  <p style={{ fontSize: "0.65rem", color: "#9A8A88" }}>Price</p>
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#A52A2A" }}>₹{p.price.toLocaleString()}<span style={{ fontSize: "0.65rem", color: "#9A8A88" }}>/{p.unit}</span></p>
                </div>
                <div className="p-2 rounded-md" style={{ background: "#FAFAFA" }}>
                  <p style={{ fontSize: "0.65rem", color: "#9A8A88" }}>Lead Time</p>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1C1C1C" }}>{p.leadTime}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedProduct(p)}
                  className="flex-1 py-2 rounded-md flex items-center justify-center gap-1.5"
                  style={{ background: "#F5F0EF", color: "#4E342E", border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 }}
                >
                  <Eye size={13} /> Details
                </button>
                <button
                  onClick={() => addToCart(p)}
                  disabled={p.availability === "out of stock"}
                  className="flex-1 py-2 rounded-md flex items-center justify-center gap-1.5"
                  style={{
                    background: p.availability === "out of stock" ? "#F0ECEB" : "#A52A2A",
                    color: p.availability === "out of stock" ? "#9A8A88" : "#fff",
                    border: "none",
                    cursor: p.availability === "out of stock" ? "not-allowed" : "pointer",
                    fontSize: "0.8rem", fontWeight: 500,
                  }}
                >
                  <ShoppingCart size={13} />
                  {p.availability === "out of stock" ? "Unavailable" : "Add to Cart"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setSelectedProduct(null)}>
          <div
            className="w-full max-w-lg rounded-xl overflow-hidden"
            style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E8E2E0" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="#9A8A88" /></button>
            </div>
            <div className="p-6">
              <p style={{ fontSize: "0.875rem", color: "#4A4A4A", marginBottom: "1rem", lineHeight: 1.6 }}>{selectedProduct.description}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Product ID", value: selectedProduct.id },
                  { label: "Category", value: selectedProduct.category },
                  { label: "Material", value: selectedProduct.material },
                  { label: "Thickness", value: selectedProduct.thickness },
                  { label: "Unit Price", value: `₹${selectedProduct.price.toLocaleString()}/${selectedProduct.unit}` },
                  { label: "Min. Order Qty", value: `${selectedProduct.minQty} ${selectedProduct.unit}s` },
                  { label: "Lead Time", value: selectedProduct.leadTime },
                  { label: "Availability", value: selectedProduct.availability },
                ].map((f) => (
                  <div key={f.label} className="p-3 rounded-lg" style={{ background: "#FAFAFA", border: "1px solid #F0ECEB" }}>
                    <p style={{ fontSize: "0.68rem", color: "#9A8A88", textTransform: "uppercase", letterSpacing: "0.04em" }}>{f.label}</p>
                    <p style={{ fontSize: "0.8375rem", fontWeight: 600, color: "#1C1C1C", marginTop: "0.2rem", textTransform: "capitalize" }}>{f.value}</p>
                  </div>
                ))}
              </div>
              <div className="mb-4">
                <p style={{ fontSize: "0.775rem", fontWeight: 600, color: "#4A4A4A", marginBottom: "0.5rem" }}>Specifications</p>
                {selectedProduct.specs.map((s) => (
                  <div key={s} className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 size={13} color="#2E7D32" />
                    <span style={{ fontSize: "0.8rem", color: "#4A4A4A" }}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Btn className="flex-1" onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>
                  <ShoppingCart size={14} /> Add to Cart
                </Btn>
                <Btn variant="secondary" className="flex-1">
                  <FileText size={14} /> Request Quotation
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setShowCart(false)}>
          <div
            className="w-full max-w-sm h-full flex flex-col"
            style={{ background: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #E8E2E0" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Cart ({cart.length} items)</h3>
              <button onClick={() => setShowCart(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: "#9A8A88" }}>
                  <ShoppingCart size={40} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3 p-3 mb-3 rounded-lg" style={{ border: "1px solid #F0ECEB" }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#F5F0EF" }}>
                      <Package size={18} color="#A52A2A" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: "0.8rem", fontWeight: 600 }}>{item.product.name}</p>
                      <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>₹{item.product.price} × {item.qty}</p>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: "0.8375rem", fontWeight: 700, color: "#A52A2A" }}>₹{(item.product.price * item.qty).toLocaleString()}</p>
                      <button onClick={() => setCart((p) => p.filter((c) => c.product.id !== item.product.id))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.7rem", color: "#C0392B" }}>Remove</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4" style={{ borderTop: "1px solid #E8E2E0" }}>
                <div className="flex justify-between mb-4">
                  <span style={{ fontWeight: 600 }}>Total</span>
                  <span style={{ fontWeight: 700, color: "#A52A2A", fontSize: "1.1rem" }}>₹{cartTotal.toLocaleString()}</span>
                </div>
                <Btn className="w-full justify-center" onClick={() => toast.success("Order placed successfully")}><CheckCircle2 size={15} /> Place Order</Btn>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Order Management ─── */
function OrderManagement() {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [showNewOrder, setShowNewOrder] = useState(false);

  return (
    <div className="p-6">
      <PageHeader
        title="Order Management"
        subtitle="Track, manage, and review all your orders from DVS Industries"
        actions={<Btn onClick={() => setShowNewOrder(true)}><Plus size={14} /> New Order</Btn>}
      />

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowNewOrder(false)}>
          <div className="w-full max-w-md rounded-xl" style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E8E2E0" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Create New Order</h3>
              <button onClick={() => setShowNewOrder(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color="#9A8A88" /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label: "Product", type: "select" },
                { label: "Quantity (pcs)", type: "number" },
                { label: "Required Delivery Date", type: "date" },
                { label: "Delivery Address", type: "text" },
                { label: "Special Instructions", type: "textarea" },
              ].map((f) => (
                <div key={f.label}>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 500, marginBottom: "0.3rem" }}>{f.label}</label>
                  {f.type === "select" ? (
                    <select style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", background: "#FAFAFA", outline: "none" }}>
                      {products.filter((p) => p.availability !== "out of stock").map((p) => <option key={p.id}>{p.name}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea rows={3} style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", background: "#FAFAFA", outline: "none", resize: "none" }} />
                  ) : (
                    <input type={f.type} style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", background: "#FAFAFA", outline: "none" }} />
                  )}
                </div>
              ))}
              <div className="flex gap-3 mt-2">
                <Btn className="flex-1 justify-center" onClick={() => { setShowNewOrder(false); toast.success("Order submitted successfully"); }}>Submit Order</Btn>
                <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setShowNewOrder(false)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-0 mb-5" style={{ borderBottom: "2px solid #E8E2E0" }}>
        {[["active", "Active Orders"], ["history", "Order History"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            style={{
              padding: "0.625rem 1rem", fontSize: "0.8375rem",
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? "#A52A2A" : "#7A6C6A",
              borderBottom: `2px solid ${tab === id ? "#A52A2A" : "transparent"}`,
              marginBottom: "-2px", background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <DataTable
          searchable
          paginate={10}
          columns={[
            { key: "id", label: "Order ID" },
            { key: "product", label: "Product" },
            { key: "qty", label: "Qty" },
            { key: "orderDate", label: "Ordered" },
            { key: "requiredDate", label: "Required By" },
            { key: "value", label: "Value" },
            { key: "status", label: "Status" },
            { key: "actions", label: "Actions" },
          ]}
          rows={(tab === "active"
            ? myOrders.filter((o) => o.status !== "delivered")
            : myOrders.filter((o) => o.status === "delivered")
          ).map((o) => ({
            id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#A52A2A", fontWeight: 700 }}>{o.id}</span>,
            product: <span style={{ fontWeight: 500 }}>{o.product}</span>,
            qty: `${o.qty.toLocaleString()} pcs`,
            orderDate: o.orderDate,
            requiredDate: o.requiredDate,
            value: <span style={{ fontWeight: 600 }}>{o.value}</span>,
            status: <StatusBadge status={o.status} label={o.status.replace("-", " ")} />,
            actions: (
              <div className="flex gap-1.5">
                <button className="p-1.5 rounded" style={{ background: "#F0F4FF", color: "#1565C0" }}><Eye size={12} /></button>
                {o.invoiceReady && <button className="p-1.5 rounded" style={{ background: "#E8F5E9", color: "#2E7D32" }}><Download size={12} /></button>}
                {o.status === "delivered" && <button className="p-1.5 rounded" style={{ background: "#FFF3E0", color: "#E65100" }}><RotateCcw size={12} /></button>}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}

/* ─── Shipment Tracking ─── */
function ShipmentTracking() {
  const [selected, setSelected] = useState(shipmentTracking[0]);

  return (
    <div className="p-6">
      <PageHeader title="Shipment Tracking" subtitle="Real-time order and delivery tracking" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Order list */}
        <div className="flex flex-col gap-3">
          {shipmentTracking.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="p-4 rounded-lg text-left w-full"
              style={{
                background: selected.id === s.id ? "#FDF5F5" : "#fff",
                border: `1px solid ${selected.id === s.id ? "#A52A2A" : "#E8E2E0"}`,
                boxShadow: selected.id === s.id ? "0 0 0 1px #A52A2A" : "none",
                cursor: "pointer",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#A52A2A" }}>{s.id}</span>
                <StatusBadge status={s.status} label={s.status.replace("-", " ")} />
              </div>
              <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#1C1C1C" }}>{s.product}</p>
              <p style={{ fontSize: "0.72rem", color: "#9A8A88", marginTop: "0.2rem" }}>{s.qty} pcs · ETA: {s.expectedDel}</p>
            </button>
          ))}
        </div>

        {/* Tracking detail */}
        <div style={{ gridColumn: "span 2" }}>
          <Card>
            <CardHeader title={`Tracking — ${selected.id}`} subtitle={selected.product} />
            <div className="p-6">
              {/* Info row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Order Date", value: selected.orderDate },
                  { label: "Dispatch Date", value: selected.dispatchDate },
                  { label: "Expected Delivery", value: selected.expectedDel },
                  { label: "Tracking No.", value: selected.trackingNo },
                ].map((f) => (
                  <div key={f.label} className="p-3 rounded-lg" style={{ background: "#FAFAFA", border: "1px solid #F0ECEB" }}>
                    <p style={{ fontSize: "0.68rem", color: "#9A8A88", textTransform: "uppercase", letterSpacing: "0.04em" }}>{f.label}</p>
                    <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1C1C1C", marginTop: "0.2rem", fontFamily: f.label === "Tracking No." ? "JetBrains Mono, monospace" : "inherit" }}>
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div>
                <p style={{ fontSize: "0.775rem", fontWeight: 600, color: "#4A4A4A", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Delivery Timeline
                </p>
                <div className="relative">
                  {/* Vertical line */}
                  <div
                    className="absolute"
                    style={{ left: "11px", top: "12px", bottom: "12px", width: "2px", background: "#E8E2E0" }}
                  />
                  {selected.timeline.map((step, i) => (
                    <div key={i} className="flex items-start gap-4 mb-5 relative">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                        style={{
                          background: step.done ? "#A52A2A" : "#F0ECEB",
                          border: `2px solid ${step.done ? "#A52A2A" : "#D4BFBB"}`,
                          marginTop: "0.05rem",
                        }}
                      >
                        {step.done && <CheckCircle2 size={12} color="#fff" />}
                      </div>
                      <div>
                        <p style={{ fontSize: "0.8375rem", fontWeight: step.done ? 600 : 400, color: step.done ? "#1C1C1C" : "#9A8A88" }}>
                          {step.label}
                        </p>
                        <p style={{ fontSize: "0.72rem", color: step.done ? "#7A6C6A" : "#BCAFAD" }}>{step.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.status === "dispatched" && (
                <div className="mt-4 flex gap-2">
                  <Btn onClick={() => toast.success("Delivery confirmed successfully")}><CheckCircle2 size={14} /> Confirm Delivery</Btn>
                  <Btn variant="secondary"><MessageSquare size={14} /> Query Delivery</Btn>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─── Notifications ─── */
function Notifications() {
  const [notifs, setNotifs] = useState(notifications);
  const unread = notifs.filter((n) => !n.read).length;

  const typeIcon: Record<string, string> = { success: "✅", info: "📦", warn: "⚡" };
  const typeBg: Record<string, string> = { success: "#F0FAF0", info: "#F0F4FF", warn: "#FFFBF0" };
  const typeBorder: Record<string, string> = { success: "#C8E6C9", info: "#C5CAE9", warn: "#FFE082" };

  return (
    <div className="p-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread notification${unread !== 1 ? "s" : ""}`}
        actions={
          <Btn variant="secondary" size="sm" onClick={() => { setNotifs((p) => p.map((n) => ({ ...n, read: true }))); toast.success("All notifications marked as read"); }}>
            <CheckCircle2 size={13} /> Mark All Read
          </Btn>
        }
      />

      <div className="flex flex-col gap-3 max-w-2xl">
        {notifs.map((n) => (
          <div
            key={n.id}
            className="flex items-start gap-4 p-4 rounded-xl"
            style={{
              background: !n.read ? typeBg[n.type] : "#fff",
              border: `1px solid ${!n.read ? typeBorder[n.type] : "#E8E2E0"}`,
              boxShadow: !n.read ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
            }}
          >
            <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{typeIcon[n.type]}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1C1C1C" }}>{n.title}</p>
                <span style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{n.time}</span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#4A4A4A", lineHeight: 1.55 }}>{n.msg}</p>
            </div>
            {!n.read && (
              <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#A52A2A" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Support Center ─── */
function SupportCenter() {
  const [showTicket, setShowTicket] = useState(false);

  return (
    <div className="p-6">
      <PageHeader
        title="Support Center"
        subtitle="Raise tickets, ask queries, and contact DVS Industries"
        actions={<Btn onClick={() => setShowTicket(true)}><Plus size={14} /> Raise Ticket</Btn>}
      />

      {showTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowTicket(false)}>
          <div className="w-full max-w-md rounded-xl" style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E8E2E0" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Raise Support Ticket</h3>
              <button onClick={() => setShowTicket(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label: "Subject", type: "text", placeholder: "Brief description of the issue" },
                { label: "Related Order (optional)", type: "text", placeholder: "ORD-XXXX" },
                { label: "Priority", type: "select" },
                { label: "Description", type: "textarea" },
              ].map((f) => (
                <div key={f.label}>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 500, marginBottom: "0.3rem" }}>{f.label}</label>
                  {f.type === "select" ? (
                    <select style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", background: "#FAFAFA", outline: "none" }}>
                      <option>Low</option><option>Medium</option><option>High</option>
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea rows={4} placeholder="Detailed description..." style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", background: "#FAFAFA", outline: "none", resize: "none" }} />
                  ) : (
                    <input type={f.type} placeholder={f.placeholder} style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", background: "#FAFAFA", outline: "none" }} />
                  )}
                </div>
              ))}
              <div className="flex gap-3 mt-1">
                <Btn className="flex-1 justify-center" onClick={() => { setShowTicket(false); toast.success("Support ticket submitted successfully"); }}>Submit Ticket</Btn>
                <Btn variant="secondary" className="flex-1 justify-center" onClick={() => setShowTicket(false)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tickets */}
        <div style={{ gridColumn: "span 2" }}>
          <Card className="mb-4">
            <CardHeader title="My Support Tickets" />
            <DataTable
              searchable
              paginate={10}
              columns={[
                { key: "id", label: "Ticket ID" },
                { key: "subject", label: "Subject" },
                { key: "priority", label: "Priority" },
                { key: "status", label: "Status" },
                { key: "created", label: "Opened" },
                { key: "lastUpdate", label: "Last Update" },
              ]}
              rows={tickets.map((t) => ({
                id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#A52A2A", fontWeight: 600 }}>{t.id}</span>,
                subject: <span style={{ fontSize: "0.8125rem" }}>{t.subject}</span>,
                priority: <StatusBadge status={t.priority} />,
                status: <StatusBadge status={t.status} />,
                created: t.created,
                lastUpdate: t.lastUpdate,
              }))}
            />
          </Card>
        </div>

        {/* Contact info */}
        <Card>
          <CardHeader title="Contact DVS Industries" />
          <div className="p-5 flex flex-col gap-4">
            {[
              { icon: "📞", label: "Phone", value: "+91 22 4890 1200", sub: "Mon–Sat 9AM–6PM IST" },
              { icon: "📧", label: "Email", value: "support@dvsindustries.com", sub: "Response within 24 hours" },
              { icon: "📍", label: "Location", value: "DVS Industries, Plot 48, MIDC Pune", sub: "Maharashtra 411019" },
            ].map((c) => (
              <div key={c.label} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "#FAFAFA", border: "1px solid #F0ECEB" }}>
                <span style={{ fontSize: "1.2rem" }}>{c.icon}</span>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.label}</p>
                  <p style={{ fontSize: "0.8375rem", fontWeight: 600, color: "#1C1C1C" }}>{c.value}</p>
                  <p style={{ fontSize: "0.72rem", color: "#7A6C6A" }}>{c.sub}</p>
                </div>
              </div>
            ))}
            <Btn className="w-full justify-center mt-2">
              <MessageSquare size={14} /> Live Chat
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Reports ─── */
function ClientReports() {
  return (
    <div className="p-6">
      <PageHeader title="Reports & Analytics" subtitle="Purchase history, spending trends, and invoice downloads" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <CardHeader title="Monthly Spend" subtitle="₹ Lakhs" />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={spendTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "0.8rem" }} formatter={(v) => [`₹${v}L`]} />
                <Area type="monotone" dataKey="spend" stroke="#A52A2A" fill="#FDF5F5" strokeWidth={2} name="Spend" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Spend by Category" subtitle="₹ Lakhs cumulative" />
          <div className="p-5">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={categorySpend} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ fontSize: "0.8rem" }} formatter={(v) => [`₹${v}L`]} />
                <Bar dataKey="spend" fill="#A52A2A" radius={[0, 3, 3, 0]} name="Spend" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Report download cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { title: "Purchase History Report", desc: "All orders — dates, quantities, values", icon: "🧾" },
          { title: "Order Analytics Report", desc: "On-time delivery, order frequency, status breakdown", icon: "📊" },
          { title: "Monthly Spending Report", desc: "Spending by category and month", icon: "💰" },
          { title: "Invoice Bundle", desc: "Download all invoices as ZIP", icon: "📁" },
        ].map((r) => (
          <div key={r.title} className="flex items-center gap-4 p-4 rounded-lg" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "1.5rem" }}>{r.icon}</span>
            <div className="flex-1">
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1C1C1C" }}>{r.title}</p>
              <p style={{ fontSize: "0.75rem", color: "#7A6C6A" }}>{r.desc}</p>
            </div>
            <div className="flex gap-1.5">
              <Btn size="sm" variant="secondary" onClick={() => toast.success("Report downloaded successfully")}><Download size={12} /> PDF</Btn>
              <Btn size="sm" variant="ghost" onClick={() => toast.success("Report downloaded successfully")}><Download size={12} /> CSV</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Root ─── */
export function ClientApp({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState("dashboard");

  const renderSection = () => {
    switch (section) {
      case "dashboard": return <ClientDashboard onNavigate={setSection} />;
      case "catalog": return <ProductCatalog />;
      case "orders": return <OrderManagement />;
      case "tracking": return <ShipmentTracking />;
      case "notifications": return <Notifications />;
      case "support": return <SupportCenter />;
      case "reports": return <ClientReports />;
      default: return <ClientDashboard onNavigate={setSection} />;
    }
  };

  return (
    <AppShell role="client" activeSection={section} onSectionChange={setSection} onLogout={onLogout} notificationCount={2}>
      {renderSection()}
    </AppShell>
  );
}
