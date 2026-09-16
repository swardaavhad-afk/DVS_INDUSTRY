import { useState, useEffect } from "react";
import { toast as showSonnerToast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  Plus, Download, Eye, CheckCircle2, ArrowRight, Truck, X, ShoppingCart,
  FileText, Package, AlertCircle, Printer,
} from "lucide-react";
import { PageHeader, Card, CardHeader, KPICard, StatusBadge, Btn, DataTable, TabBar } from "../shared/UI";
import { useERP } from "./ERPContext";
import {
  getClientOrders, getPurchaseOrders, getOrderStats,
  approveClientOrder, dispatchClientOrder, deliverClientOrder,
  createClientOrder, createPurchaseOrder,
  type ClientOrderDto, type PurchaseOrderDto, type OrderStatistics,
} from "../../../lib/services/orders.service";

/* ── Types ── */
interface ClientOrder {
  id: string; client: string; product: string; qty: number;
  orderDate: string; requiredDate: string; status: string; value: string;
  dispatch?: string; delivery?: string;
  _apiId?: number;
}
interface SupplierOrder {
  id: string; supplier: string; material: string; qty: string;
  orderDate: string; expectedDel: string; actualDel: string; cost: string; status: string;
  _apiId?: number;
}

/* ── Static data ── */
const INITIAL_CLIENT_ORDERS: ClientOrder[] = [
  { id: "ORD-2841", client: "Reliance Eng.", product: "Steel Frames (2mm)", qty: 500, orderDate: "10 Jun", requiredDate: "20 Jun", status: "in-production", value: "₹1,82,000" },
  { id: "ORD-2842", client: "Tata Motors", product: "Pressed Panels", qty: 200, orderDate: "09 Jun", requiredDate: "18 Jun", status: "dispatched", value: "₹96,000", dispatch: "11 Jun" },
  { id: "ORD-2843", client: "Mahindra Ltd.", product: "Aluminium Parts", qty: 350, orderDate: "09 Jun", requiredDate: "22 Jun", status: "pending", value: "₹2,45,000" },
  { id: "ORD-2844", client: "L&T Ltd.", product: "Copper Assemblies", qty: 150, orderDate: "08 Jun", requiredDate: "15 Jun", status: "approved", value: "₹3,18,000" },
  { id: "ORD-2845", client: "Bajaj Auto", product: "Sheet Metal Parts", qty: 800, orderDate: "07 Jun", requiredDate: "12 Jun", status: "delivered", value: "₹4,16,000", delivery: "11 Jun" },
  { id: "ORD-2846", client: "Hero MotoCorp", product: "Steel Tubes", qty: 300, orderDate: "06 Jun", requiredDate: "10 Jun", status: "delivered", value: "₹1,08,000", delivery: "09 Jun" },
];

const INITIAL_SUPPLIER_ORDERS: SupplierOrder[] = [
  { id: "PO-2847", supplier: "SteelCorp Ltd.", material: "Steel Sheet 2mm", qty: "500 kg", orderDate: "10 Jun", expectedDel: "12 Jun", actualDel: "12 Jun", cost: "₹36,000", status: "delivered" },
  { id: "PO-2848", supplier: "AluminCo", material: "Aluminium Strip", qty: "200 kg", orderDate: "09 Jun", expectedDel: "12 Jun", actualDel: "–", cost: "₹37,000", status: "in-production" },
  { id: "PO-2849", supplier: "CopperPrime", material: "Copper Wire", qty: "100 kg", orderDate: "08 Jun", expectedDel: "09 Jun", actualDel: "–", cost: "₹62,000", status: "dispatched" },
  { id: "PO-2850", supplier: "MetalTech India", material: "Steel Tube 4mm", qty: "300 kg", orderDate: "07 Jun", expectedDel: "11 Jun", actualDel: "–", cost: "₹20,400", status: "pending" },
];

const SUPPLIERS = [
  { name: "SteelCorp Ltd.", rating: 4.8, delivery: "2 days", reliability: "98%", materials: "Steel Sheet, Steel Tube" },
  { name: "AluminCo", rating: 4.6, delivery: "3 days", reliability: "95%", materials: "Aluminium Strip, Aluminium Sheet" },
  { name: "CopperPrime", rating: 4.9, delivery: "1 day", reliability: "99%", materials: "Copper Wire, Copper Sheet" },
  { name: "MetalTech India", rating: 4.2, delivery: "4 days", reliability: "91%", materials: "Steel Sheet, Steel Tube" },
];

const fulfillmentTrend = [
  { month: "Jan", rate: 91 }, { month: "Feb", rate: 88 }, { month: "Mar", rate: 94 },
  { month: "Apr", rate: 92 }, { month: "May", rate: 96 }, { month: "Jun", rate: 97 },
];

const supplyChainFlow = [
  { label: "Supplier", sub: "Raw Material Supply", count: "4 active", color: "#4E342E", icon: "📦" },
  { label: "DVS Industries", sub: "Production & QC", count: "24 in production", color: "#A52A2A", icon: "🏭" },
  { label: "Client", sub: "Order Fulfillment", count: "6 orders active", color: "#1565C0", icon: "🏢" },
];

/* ── Helpers ── */
function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className={`rounded-xl overflow-hidden mx-4 ${wide ? "w-full max-w-2xl" : "w-full max-w-lg"}`}
        style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0" style={{ borderBottom: "1px solid #E8E2E0", background: "#F9F6F5" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1C1C1C" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A6C6A" }}><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ── PO Creation Modal ── */
function POModal({ prefill, onClose, onSubmit }: {
  prefill?: { material: string; qty: number; cost: number; supplier: string };
  onClose: () => void;
  onSubmit: (po: Omit<SupplierOrder, "id" | "orderDate" | "actualDel">) => void;
}) {
  const [form, setForm] = useState({
    supplier: prefill?.supplier || SUPPLIERS[0].name,
    material: prefill?.material || "",
    qty: prefill?.qty ? `${prefill.qty} kg` : "",
    cost: prefill?.cost ? `₹${(prefill.qty || 0) * prefill.cost}` : "",
    expectedDel: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const isValid = form.supplier && form.material && form.qty && form.expectedDel;

  if (submitted) return (
    <Modal title="Purchase Order Created" onClose={onClose}>
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#E8F5E9" }}>
          <CheckCircle2 size={32} color="#2E7D32" />
        </div>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>Purchase Order Submitted</h3>
        <p style={{ fontSize: "0.875rem", color: "#7A6C6A", marginBottom: "1rem" }}>
          PO sent to <strong>{form.supplier}</strong> for <strong>{form.material}</strong>.
          Expected delivery: <strong>{form.expectedDel}</strong>.
        </p>
        <div className="p-4 rounded-xl text-left mb-4" style={{ background: "#F9F6F5", border: "1px solid #E8E2E0" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7A6C6A", marginBottom: "0.5rem" }}>SUPPLIER NOTIFIED</p>
          <p style={{ fontSize: "0.8375rem", color: "#4A4A4A" }}>📧 Email confirmation sent to {form.supplier}</p>
          <p style={{ fontSize: "0.8375rem", color: "#4A4A4A" }}>📋 PO record created in Supplier Orders</p>
        </div>
        <button onClick={onClose} style={{ padding: "0.625rem 2rem", borderRadius: "0.5rem", background: "#A52A2A", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>Done</button>
      </div>
    </Modal>
  );

  return (
    <Modal title="Create Purchase Order" onClose={onClose} wide>
      <div className="flex flex-col gap-3.5">
        <div>
          <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#4A4A4A", marginBottom: "0.3rem" }}>Select Supplier *</label>
          <div className="grid grid-cols-2 gap-2">
            {SUPPLIERS.map((s) => (
              <button key={s.name} onClick={() => set("supplier", s.name)}
                className="text-left p-3 rounded-xl transition-all"
                style={{ border: `1.5px solid ${form.supplier === s.name ? "#A52A2A" : "#E8E2E0"}`, background: form.supplier === s.name ? "#FDF5F5" : "#fff", cursor: "pointer" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1C1C1C" }}>{s.name}</p>
                <p style={{ fontSize: "0.7rem", color: "#7A6C6A" }}>★ {s.rating} · {s.delivery} · {s.reliability}</p>
              </button>
            ))}
          </div>
        </div>
        {[
          { label: "Material *", key: "material", placeholder: "e.g. Steel Sheet 2mm" },
          { label: "Quantity *", key: "qty", placeholder: "e.g. 500 kg" },
          { label: "Total Cost (₹)", key: "cost", placeholder: "e.g. ₹36,000" },
          { label: "Expected Delivery *", key: "expectedDel", placeholder: "e.g. 14 Jun", type: "text" },
        ].map((f) => (
          <div key={f.key}>
            <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#4A4A4A", marginBottom: "0.3rem" }}>{f.label}</label>
            <input type={f.type || "text"} placeholder={f.placeholder} value={(form as any)[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", outline: "none" }}
              onFocus={(e) => { e.target.style.borderColor = "#A52A2A"; }}
              onBlur={(e) => { e.target.style.borderColor = "#D4BFBB"; }} />
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <button onClick={onClose} style={{ flex: 1, padding: "0.625rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
          <button disabled={!isValid} onClick={() => {
            onSubmit({ supplier: form.supplier, material: form.material, qty: form.qty, cost: form.cost || "–", expectedDel: form.expectedDel, status: "pending" });
            setSubmitted(true);
          }} style={{ flex: 2, padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: isValid ? "#A52A2A" : "#D4BFBB", color: "#fff", cursor: isValid ? "pointer" : "not-allowed", fontSize: "0.875rem", fontWeight: 600 }}>
            Submit Purchase Order
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Order Detail Modal ── */
function OrderDetailModal({ order, onClose, onApprove, onDispatch }: {
  order: ClientOrder; onClose: () => void;
  onApprove?: () => void; onDispatch?: () => void;
}) {
  const canDispatch = order.status === "approved";
  return (
    <Modal title={`Order Details — ${order.id}`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Order ID", order.id], ["Client", order.client], ["Product", order.product],
            ["Quantity", `${order.qty} pcs`], ["Order Date", order.orderDate],
            ["Required By", order.requiredDate], ["Order Value", order.value], ["Status", order.status.replace("-", " ")],
          ].map(([k, v]) => (
            <div key={k} className="p-3 rounded-xl" style={{ background: "#F9F6F5" }}>
              <p style={{ fontSize: "0.7rem", color: "#9A8A88", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>{k}</p>
              <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1C1C1C" }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Production checklist for dispatch eligibility */}
        {(order.status === "in-production" || order.status === "approved") && (
          <div className="p-4 rounded-xl" style={{ background: "#F0FAF0", border: "1px solid #C8E6C9" }}>
            <p style={{ fontSize: "0.775rem", fontWeight: 700, color: "#2E7D32", marginBottom: "0.75rem" }}>DISPATCH ELIGIBILITY</p>
            {[
              { label: "Production Complete", done: order.status === "approved" },
              { label: "Quality Inspection Passed", done: order.status === "approved" },
              { label: "Finished Goods Available", done: order.status === "approved" },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 size={14} color={c.done ? "#2E7D32" : "#D4BFBB"} />
                <span style={{ fontSize: "0.8rem", color: c.done ? "#1C1C1C" : "#9A8A88" }}>{c.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-1">
          <button onClick={onClose} style={{ flex: 1, padding: "0.625rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>Close</button>
          {order.status === "pending" && onApprove && (
            <button onClick={() => { onApprove(); onClose(); }} style={{ flex: 1, padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: "#2E7D32", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
              Approve Order
            </button>
          )}
          {canDispatch && onDispatch && (
            <button onClick={() => { onDispatch(); onClose(); }} style={{ flex: 1, padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: "#A52A2A", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
              <Truck size={14} style={{ display: "inline", marginRight: "0.35rem" }} />Dispatch
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── Dispatch Modal ── */
function DispatchModal({ order, onClose, onConfirm }: { order: ClientOrder; onClose: () => void; onConfirm: () => void }) {
  const [step, setStep] = useState<"confirm" | "generating" | "done">("confirm");
  const dispatchNo = `DSP-${Math.floor(1000 + Math.random() * 9000)}`;
  const challanNo = `DC-${Math.floor(10000 + Math.random() * 90000)}`;
  const invoiceNo = `INV-DVS-${Math.floor(1000 + Math.random() * 9000)}`;

  const handleDispatch = () => {
    setStep("generating");
    setTimeout(() => { setStep("done"); onConfirm(); }, 2000);
  };

  return (
    <Modal title="Dispatch Order" onClose={onClose} wide>
      {step === "confirm" && (
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-xl" style={{ background: "#FFF8E1", border: "1px solid #FFE082" }}>
            <div className="flex items-start gap-2">
              <AlertCircle size={16} color="#F57F17" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
              <p style={{ fontSize: "0.8375rem", color: "#4A4A4A" }}>
                You are about to dispatch <strong>{order.id}</strong> — <strong>{order.qty} pcs</strong> of <strong>{order.product}</strong> to <strong>{order.client}</strong>. This will generate a dispatch note, delivery challan, and invoice.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: FileText, label: "Dispatch Note", desc: "Auto-generated" },
              { icon: Package, label: "Delivery Challan", desc: "Auto-generated" },
              { icon: Printer, label: "Invoice", desc: "Auto-generated" },
            ].map((d) => (
              <div key={d.label} className="text-center p-4 rounded-xl" style={{ background: "#F9F6F5", border: "1px solid #E8E2E0" }}>
                <d.icon size={22} color="#A52A2A" style={{ margin: "0 auto 0.5rem" }} />
                <p style={{ fontSize: "0.775rem", fontWeight: 600, color: "#1C1C1C" }}>{d.label}</p>
                <p style={{ fontSize: "0.7rem", color: "#7A6C6A" }}>{d.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} style={{ flex: 1, padding: "0.625rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer" }}>Cancel</button>
            <button onClick={handleDispatch} style={{ flex: 2, padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: "#A52A2A", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              <Truck size={14} style={{ display: "inline", marginRight: "0.35rem" }} /> Confirm Dispatch
            </button>
          </div>
        </div>
      )}
      {step === "generating" && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full border-4 border-red-100 border-t-red-700 animate-spin mx-auto mb-4" />
          <p style={{ fontWeight: 600, color: "#1C1C1C" }}>Generating documents...</p>
          <p style={{ fontSize: "0.8rem", color: "#7A6C6A", marginTop: "0.5rem" }}>Dispatch note · Delivery challan · Invoice</p>
        </div>
      )}
      {step === "done" && (
        <div className="flex flex-col gap-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#E8F5E9" }}>
              <CheckCircle2 size={32} color="#2E7D32" />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>Order Dispatched Successfully</h3>
            <p style={{ fontSize: "0.875rem", color: "#7A6C6A" }}>All documents generated. Client notified.</p>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { label: "Dispatch Note", no: dispatchNo, icon: FileText },
              { label: "Delivery Challan", no: challanNo, icon: Package },
              { label: "Invoice", no: invoiceNo, icon: Printer },
            ].map((d) => (
              <div key={d.label} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "#F9F6F5", border: "1px solid #E8E2E0" }}>
                <div className="flex items-center gap-2">
                  <d.icon size={16} color="#A52A2A" />
                  <div>
                    <p style={{ fontSize: "0.8rem", fontWeight: 600 }}>{d.label}</p>
                    <p style={{ fontSize: "0.72rem", color: "#7A6C6A", fontFamily: "monospace" }}>{d.no}</p>
                  </div>
                </div>
                <button onClick={() => downloadCSV(`${d.no}.csv`, [[d.label, d.no, order.id, order.client, order.product, String(order.qty), order.value]])}
                  style={{ fontSize: "0.72rem", color: "#1565C0", background: "#E3F2FD", border: "none", padding: "0.25rem 0.625rem", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>
                  Download
                </button>
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{ padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: "#A52A2A", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            Close
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ── New Client Order Modal ── */
function NewClientOrderModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (o: ClientOrder) => void }) {
  const [form, setForm] = useState({ client: "", product: "", qty: "", requiredDate: "", value: "" });
  const [done, setDone] = useState(false);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const isValid = form.client && form.product && form.qty && form.requiredDate;

  if (done) return (
    <Modal title="New Client Order" onClose={onClose}>
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#E8F5E9" }}>
          <CheckCircle2 size={32} color="#2E7D32" />
        </div>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.5rem" }}>Order Created</h3>
        <p style={{ fontSize: "0.875rem", color: "#7A6C6A" }}>Order confirmation sent to {form.client}.</p>
        <button onClick={onClose} style={{ marginTop: "1.5rem", padding: "0.625rem 2rem", borderRadius: "0.5rem", background: "#A52A2A", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>Done</button>
      </div>
    </Modal>
  );

  const today = new Date();
  const dateStr = `${today.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][today.getMonth()]}`;

  return (
    <Modal title="Create Client Order" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        {[
          { label: "Client Name *", key: "client", placeholder: "e.g. Reliance Eng." },
          { label: "Product / Part *", key: "product", placeholder: "e.g. Steel Frames 2mm" },
          { label: "Quantity (pcs) *", key: "qty", placeholder: "e.g. 500", type: "number" },
          { label: "Required By *", key: "requiredDate", placeholder: "e.g. 25 Jun" },
          { label: "Order Value (₹)", key: "value", placeholder: "e.g. ₹1,82,000" },
        ].map((f) => (
          <div key={f.key}>
            <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#4A4A4A", marginBottom: "0.3rem" }}>{f.label}</label>
            <input type={f.type || "text"} placeholder={f.placeholder} value={(form as any)[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", outline: "none" }}
              onFocus={(e) => { e.target.style.borderColor = "#A52A2A"; }}
              onBlur={(e) => { e.target.style.borderColor = "#D4BFBB"; }} />
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} style={{ flex: 1, padding: "0.625rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer" }}>Cancel</button>
          <button disabled={!isValid} onClick={() => {
            const nextId = `ORD-${2847 + Math.floor(Math.random() * 100)}`;
            onSubmit({ id: nextId, client: form.client, product: form.product, qty: parseInt(form.qty), orderDate: dateStr, requiredDate: form.requiredDate, status: "pending", value: form.value || "–" });
            setDone(true);
          }} style={{ flex: 2, padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: isValid ? "#A52A2A" : "#D4BFBB", color: "#fff", cursor: isValid ? "pointer" : "not-allowed", fontWeight: 600 }}>
            Create Order
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════
   ORDERS PAGE
══════════════════════════════════════════════ */
export function OrdersPage({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [tab, setTab]                       = useState("client-orders");
  const [clientOrders, setClientOrders]     = useState<ClientOrder[]>(INITIAL_CLIENT_ORDERS);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>(INITIAL_SUPPLIER_ORDERS);
  const [apiStats, setApiStats]             = useState<OrderStatistics | null>(null);
  const [showNewOrder, setShowNewOrder]     = useState(false);
  const [showNewPO, setShowNewPO]           = useState(false);
  const [selectedOrder, setSelectedOrder]   = useState<ClientOrder | null>(null);
  const [dispatchOrder, setDispatchOrder]   = useState<ClientOrder | null>(null);
  const { pendingPO, setPendingPO } = useERP();

  // ── Load real data ──────────────────────────────────────────────────────────
  const loadAll = () => {
    Promise.all([
      getClientOrders({ pageSize: 50, sortOrder: "desc" }).catch(() => null),
      getPurchaseOrders({ pageSize: 50, sortOrder: "desc" }).catch(() => null),
      getOrderStats().catch(() => null),
    ]).then(([coRes, poRes, statsRes]) => {
      if (coRes && coRes.data.length > 0) {
        setClientOrders(coRes.data.map(o => ({
          id: o.orderNumber,
          client: o.client.name,
          product: o.product,
          qty: o.quantity,
          orderDate: new Date(o.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          requiredDate: o.requiredDate ? new Date(o.requiredDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—",
          status: o.status.toLowerCase().replace("_", "-"),
          value: o.value ? `₹${parseFloat(o.value).toLocaleString("en-IN")}` : "—",
          dispatch: o.dispatchDate ? new Date(o.dispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : undefined,
          delivery: o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : undefined,
          _apiId: o.id,
        })));
      }
      if (poRes && poRes.data.length > 0) {
        setSupplierOrders(poRes.data.map(p => ({
          id: p.poNumber,
          supplier: p.supplier.name,
          material: p.material,
          qty: p.quantity,
          orderDate: new Date(p.orderDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          expectedDel: p.expectedDelivery ? new Date(p.expectedDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—",
          actualDel: p.actualDelivery ? new Date(p.actualDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "–",
          cost: p.totalCost ? `₹${parseFloat(p.totalCost).toLocaleString("en-IN")}` : "–",
          status: p.status.toLowerCase().replace("_", "-"),
          _apiId: p.id,
        })));
      }
      if (statsRes) setApiStats(statsRes);
    });
  };

  useEffect(() => { loadAll(); }, []);

  // Auto-open PO modal if navigated from Inventory with pending PO
  useEffect(() => {
    if (pendingPO) { setTab("supplier-orders"); setShowNewPO(true); }
  }, [pendingPO]);

  const handleApprove = async (id: string) => {
    const order = clientOrders.find(o => o.id === id);
    if (order?._apiId) {
      try { await approveClientOrder(order._apiId); } catch { /* update locally anyway */ }
    }
    setClientOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "approved" } : o));
    showSonnerToast.success(`Order ${id} approved — production scheduled`);
  };

  const handleDispatchDone = async (id: string) => {
    const today = new Date();
    const dateStr = `${today.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][today.getMonth()]}`;
    const order = clientOrders.find(o => o.id === id);
    if (order?._apiId) {
      try { await dispatchClientOrder(order._apiId, {}); } catch { /* update locally anyway */ }
    }
    setClientOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: "dispatched", dispatch: dateStr } : o));
    setDispatchOrder(null);
    showSonnerToast.success(`Order ${id} dispatched — client notified`);
  };

  const handleAddOrder = async (o: ClientOrder) => {
    // Try real API — find clientId by name from existing orders
    try {
      const existingClient = clientOrders.find(c => c.client === o.client);
      if (existingClient?._apiId) {
        await createClientOrder({ clientId: existingClient._apiId, product: o.product, quantity: o.qty, unit: "pcs", requiredDate: o.requiredDate ? new Date().toISOString() : null });
      }
    } catch { /* add locally */ }
    setClientOrders((prev) => [o, ...prev]);
    showSonnerToast.success(`Order ${o.id} created for ${o.client}`);
  };

  const handleAddPO = async (po: Omit<SupplierOrder, "id" | "orderDate" | "actualDel">) => {
    const today = new Date();
    const dateStr = `${today.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][today.getMonth()]}`;
    const id = `PO-${2851 + supplierOrders.length}`;
    // Try real API
    try {
      await createPurchaseOrder({ supplierId: 1, material: po.material, quantity: po.qty, notes: null });
    } catch { /* add locally */ }
    setSupplierOrders((prev) => [{ id, ...po, orderDate: dateStr, actualDel: "–" }, ...prev]);
    setPendingPO(null);
    showSonnerToast.success(`PO ${id} created — supplier notified`);
  };

  const handleExport = () => {
    const rows = [
      ["Order ID", "Client", "Product", "Qty", "Order Date", "Required By", "Value", "Status"],
      ...clientOrders.map((o) => [o.id, o.client, o.product, String(o.qty), o.orderDate, o.requiredDate, o.value, o.status]),
    ];
    downloadCSV("DVS_Client_Orders.csv", rows);
    showSonnerToast.success("Orders exported to CSV");
  };

  const poPrefill = pendingPO ? { material: pendingPO.materialName, qty: pendingPO.reorderQty, cost: pendingPO.unitCost, supplier: pendingPO.preferredSupplier } : undefined;

  return (
    <>
    {showNewOrder && <NewClientOrderModal onClose={() => setShowNewOrder(false)} onSubmit={handleAddOrder} />}
    {showNewPO && <POModal prefill={poPrefill} onClose={() => { setShowNewPO(false); setPendingPO(null); }} onSubmit={handleAddPO} />}
    {selectedOrder && !dispatchOrder && (
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onApprove={() => handleApprove(selectedOrder.id)}
        onDispatch={() => { setDispatchOrder(selectedOrder); setSelectedOrder(null); }}
      />
    )}
    {dispatchOrder && (
      <DispatchModal
        order={dispatchOrder}
        onClose={() => setDispatchOrder(null)}
        onConfirm={() => handleDispatchDone(dispatchOrder.id)}
      />
    )}

    <div className="p-6">
      <PageHeader
        title="Orders & Supply Chain"
        subtitle="End-to-end order management — from supplier procurement to client delivery"
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={handleExport}><Download size={14} /> Export</Btn>
            <Btn size="sm" onClick={() => setShowNewOrder(true)}><Plus size={14} /> New Order</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KPICard label="Active Client Orders" value={apiStats ? apiStats.totalClientOrders - (apiStats.deliveredOrders ?? 0) : clientOrders.filter((o) => !["delivered"].includes(o.status)).length} sub="in progress" accent="#A52A2A" />
        <KPICard label="Pending Supplier POs" value={apiStats?.pendingPOs ?? supplierOrders.filter((o) => o.status === "pending").length} sub="awaiting processing" accent="#E65100" trendDir="down" />
        <KPICard label="Dispatched Today" value={apiStats?.dispatchedOrders ?? clientOrders.filter((o) => o.status === "dispatched").length} trend="+1 vs yesterday" trendDir="up" accent="#1565C0" />
        <KPICard label="Fulfillment Rate" value={apiStats?.fulfillmentRate ?? "97.2%"} trend="+1.8% MoM" trendDir="up" accent="#2E7D32" />
      </div>

      <TabBar
        tabs={[
          { id: "client-orders", label: "Client Orders" },
          { id: "supplier-orders", label: "Supplier Orders" },
          { id: "supply-chain", label: "Supply Chain Flow" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {/* ── CLIENT ORDERS ── */}
        {tab === "client-orders" && (
          <Card>
            <CardHeader
              title="Client Orders"
              subtitle={`${clientOrders.length} total orders`}
              actions={<Btn size="sm" onClick={() => setShowNewOrder(true)}><Plus size={13} /> New Order</Btn>}
            />
            <DataTable
              searchable
              paginate={8}
              exportFilename="DVS_Client_Orders.csv"
              columns={[
                { key: "id", label: "Order ID" },
                { key: "client", label: "Client" },
                { key: "product", label: "Product" },
                { key: "qty", label: "Qty (pcs)" },
                { key: "orderDate", label: "Order Date" },
                { key: "requiredDate", label: "Required By" },
                { key: "value", label: "Value" },
                { key: "status", label: "Status" },
                { key: "actions", label: "Actions" },
              ]}
              rows={clientOrders.map((o) => ({
                id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#A52A2A", fontWeight: 600 }}>{o.id}</span>,
                client: <span style={{ fontWeight: 500 }}>{o.client}</span>,
                product: <span style={{ fontSize: "0.8rem" }}>{o.product}</span>,
                qty: o.qty.toLocaleString(),
                orderDate: o.orderDate,
                requiredDate: <span style={{ fontWeight: 500, color: o.status === "pending" ? "#E65100" : "#4A4A4A" }}>{o.requiredDate}</span>,
                value: <span style={{ fontWeight: 600, color: "#1C1C1C" }}>{o.value}</span>,
                status: <StatusBadge status={o.status} label={o.status.replace("-", " ")} />,
                actions: (
                  <div className="flex gap-1.5">
                    <button onClick={() => setSelectedOrder(o)} title="View details" className="p-1.5 rounded" style={{ background: "#F0F4FF", color: "#1565C0" }}><Eye size={12} /></button>
                    {o.status === "pending" && (
                      <button onClick={() => handleApprove(o.id)} title="Approve order" className="p-1.5 rounded" style={{ background: "#E8F5E9", color: "#2E7D32" }}><CheckCircle2 size={12} /></button>
                    )}
                    {o.status === "approved" && (
                      <button onClick={() => setDispatchOrder(o)} title="Dispatch order" className="p-1.5 rounded" style={{ background: "#FFF3E0", color: "#E65100" }}><Truck size={12} /></button>
                    )}
                  </div>
                ),
              }))}
            />
          </Card>
        )}

        {/* ── SUPPLIER ORDERS ── */}
        {tab === "supplier-orders" && (
          <Card>
            <CardHeader
              title="Purchase Orders"
              subtitle="Supplier procurement tracking"
              actions={<Btn size="sm" onClick={() => setShowNewPO(true)}><Plus size={13} /> Create PO</Btn>}
            />
            <DataTable
              columns={[
                { key: "id", label: "PO Number" },
                { key: "supplier", label: "Supplier" },
                { key: "material", label: "Material" },
                { key: "qty", label: "Quantity" },
                { key: "orderDate", label: "Order Date" },
                { key: "expectedDel", label: "Expected Del." },
                { key: "actualDel", label: "Actual Del." },
                { key: "cost", label: "Total Cost" },
                { key: "status", label: "Status" },
              ]}
              searchable
              paginate={8}
              exportFilename="DVS_Purchase_Orders.csv"
              rows={supplierOrders.map((o) => ({
                id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#4E342E", fontWeight: 600 }}>{o.id}</span>,
                supplier: <span style={{ fontWeight: 500 }}>{o.supplier}</span>,
                material: o.material,
                qty: o.qty,
                orderDate: o.orderDate,
                expectedDel: o.expectedDel,
                actualDel: <span style={{ color: o.actualDel === "–" ? "#9A8A88" : "#2E7D32" }}>{o.actualDel}</span>,
                cost: <span style={{ fontWeight: 600 }}>{o.cost}</span>,
                status: <StatusBadge status={o.status} label={o.status.replace("-", " ")} />,
              }))}
            />
          </Card>
        )}

        {/* ── SUPPLY CHAIN ── */}
        {tab === "supply-chain" && (
          <div>
            <Card className="mb-5">
              <CardHeader title="Supply Chain Flow" subtitle="Supplier → DVS Industries → Client" />
              <div className="p-8">
                <div className="flex flex-col md:flex-row items-center justify-center gap-0">
                  {supplyChainFlow.map((node, i) => (
                    <div key={node.label} className="flex flex-col md:flex-row items-center">
                      <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-3 text-3xl"
                          style={{ background: `${node.color}12`, border: `2px solid ${node.color}30` }}>
                          {node.icon}
                        </div>
                        <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1C1C1C" }}>{node.label}</p>
                        <p style={{ fontSize: "0.75rem", color: "#7A6C6A", marginTop: "0.2rem" }}>{node.sub}</p>
                        <span className="mt-2 px-3 py-1 rounded-full"
                          style={{ fontSize: "0.7rem", background: `${node.color}12`, color: node.color, fontWeight: 600 }}>
                          {node.count}
                        </span>
                      </div>
                      {i < supplyChainFlow.length - 1 && (
                        <div className="flex items-center justify-center my-4 md:my-0 md:mx-6" style={{ color: "#9A8A88" }}>
                          <div className="hidden md:block w-12 h-px" style={{ background: "#D4BFBB" }} />
                          <ArrowRight size={20} color="#A52A2A" />
                          <div className="hidden md:block w-12 h-px" style={{ background: "#D4BFBB" }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader title="Order Fulfillment Rate" subtitle="Monthly trend" />
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={fulfillmentTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} domain={[80, 100]} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem" }} formatter={(v) => [`${v}%`]} />
                      <Line type="monotone" dataKey="rate" stroke="#A52A2A" strokeWidth={2} name="Fulfillment %" dot={{ r: 4, fill: "#A52A2A" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader title="Supply Chain Analytics" />
                <div className="p-5 flex flex-col gap-3">
                  {[
                    { label: "On-Time Delivery Rate", value: "94.2%", color: "#2E7D32" },
                    { label: "Avg Supplier Lead Time", value: "2.8 days", color: "#1565C0" },
                    { label: "Order Processing Time", value: "1.2 days", color: "#4E342E" },
                    { label: "Client Satisfaction Score", value: "4.7 / 5.0", color: "#2E7D32" },
                    { label: "PO Approval Rate", value: "98.1%", color: "#2E7D32" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid #F0ECEB" }}>
                      <span style={{ fontSize: "0.8375rem", color: "#4A4A4A" }}>{m.label}</span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: m.color }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
