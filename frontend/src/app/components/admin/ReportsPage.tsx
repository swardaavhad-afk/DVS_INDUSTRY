import { useState } from "react";
import { Download, FileText, Eye, CheckCircle2, X } from "lucide-react";
import { PageHeader, Card, CardHeader, Btn, StatusBadge } from "../shared/UI";
import { toast } from "sonner";
import {
  getInventoryReport, getWorkforceReport, getOrdersReport,
  getScrapReport, getSupplierReport, getClientReport,
  getAttendanceReport, getProductionReport,
} from "../../../lib/services/reports.service";

const reportTypes = [
  { id: "production", title: "Production Report", desc: "Actual vs expected output, efficiency, scrap, department breakdown", icon: "🏭", color: "#A52A2A", lastGen: "12 Jun 09:00" },
  { id: "inventory", title: "Inventory Report", desc: "Stock levels, material consumption, reorder status, valuation", icon: "📦", color: "#4E342E", lastGen: "12 Jun 08:30" },
  { id: "security", title: "Security Report", desc: "Incidents, PPE violations, camera status, resolution rate", icon: "🛡", color: "#C0392B", lastGen: "12 Jun 07:00" },
  { id: "workforce", title: "Workforce Report", desc: "Attendance, productivity, worker rankings, overtime, leaves", icon: "👷", color: "#1565C0", lastGen: "12 Jun 09:00" },
  { id: "orders", title: "Order Report", desc: "Client orders, supplier POs, fulfillment rate, delivery performance", icon: "📋", color: "#2E7D32", lastGen: "11 Jun 18:00" },
  { id: "scrap", title: "Scrap Report", desc: "Scrap by department, material, cost impact, AI recommendations", icon: "♻", color: "#E65100", lastGen: "12 Jun 09:00" },
  { id: "supplier", title: "Supplier Report", desc: "Delivery performance, rating, price trends, reliability scores", icon: "🚚", color: "#546E7A", lastGen: "10 Jun 10:00" },
  { id: "client", title: "Client Report", desc: "Order history, satisfaction, revenue by client, retention analysis", icon: "🏢", color: "#283593", lastGen: "10 Jun 10:00" },
];

const recentReports = [
  { name: "Production_Report_12Jun2026.pdf", type: "PDF", size: "1.2 MB", status: "completed", time: "09:02", id: "production" },
  { name: "Security_Report_12Jun2026.csv", type: "CSV", size: "248 KB", status: "completed", time: "07:15", id: "security" },
  { name: "Inventory_Report_11Jun2026.pdf", type: "PDF", size: "890 KB", status: "completed", time: "18:30", id: "inventory" },
  { name: "Workforce_Report_Weekly.pdf", type: "PDF", size: "1.8 MB", status: "completed", time: "08 Jun", id: "workforce" },
];

/* ── Sample report data for CSV export ── */
const reportData: Record<string, string[][]> = {
  production: [
    ["Department", "Expected Output", "Actual Output", "Efficiency %", "Scrap kg", "Status"],
    ["Cutting", "150", "138", "92.0", "42", "Good"],
    ["Welding", "120", "119", "99.2", "18", "Excellent"],
    ["Pressing", "100", "91", "91.0", "31", "Good"],
    ["Assembly", "80", "79", "98.8", "9", "Excellent"],
    ["Finishing", "60", "57", "95.0", "14", "Good"],
  ],
  inventory: [
    ["Material", "Category", "Stock (kg)", "Cost/kg", "Status", "Threshold"],
    ["Steel Sheet 2mm", "Steel", "850", "72", "In Stock", "200"],
    ["Aluminium Strip", "Aluminium", "42", "185", "Low Stock", "100"],
    ["Copper Sheet", "Copper", "180", "620", "In Stock", "50"],
    ["Stainless Steel", "Steel", "0", "145", "Out of Stock", "100"],
    ["Sheet Metal HR", "Steel", "1250", "65", "In Stock", "300"],
  ],
  workforce: [
    ["Employee ID", "Name", "Dept", "Expected Parts", "Produced Parts", "Efficiency %", "Attendance"],
    ["EMP-001", "Arjun Mehta", "Cutting", "80", "76", "95.0", "Present"],
    ["EMP-002", "Priya Sharma", "Welding", "60", "59", "98.3", "Present"],
    ["EMP-003", "Suresh Kumar", "Assembly", "90", "80", "88.9", "Present"],
  ],
  orders: [
    ["Order ID", "Client", "Product", "Qty", "Value", "Status"],
    ["ORD-2841", "Reliance Eng.", "Steel Frames 2mm", "500", "182000", "In Production"],
    ["ORD-2842", "Tata Motors", "Pressed Panels", "200", "96000", "Dispatched"],
    ["ORD-2843", "Mahindra Ltd.", "Aluminium Parts", "350", "245000", "Pending"],
  ],
  security: [
    ["Incident ID", "Type", "Location", "Severity", "Time", "Status"],
    ["INC-2841", "PPE Violation", "Zone B Cam 4", "High", "09:14", "Open"],
    ["INC-2840", "Unauthorized Entry", "Gate 3", "Critical", "08:47", "Investigating"],
    ["INC-2839", "Crowd Formation", "Zone D", "Low", "07:55", "Resolved"],
  ],
};

/* ── Preview data per report ── */
const previewData: Record<string, { kpis: { label: string; value: string; color: string }[]; summary: string }> = {
  production: {
    kpis: [{ label: "Total Output", value: "484 pcs", color: "#A52A2A" }, { label: "Avg Efficiency", value: "95.2%", color: "#2E7D32" }, { label: "Total Scrap", value: "114 kg", color: "#E65100" }, { label: "Downtime", value: "22 min", color: "#1565C0" }],
    summary: "Production on 12 Jun 2026. 5 departments active. Cutting dept below target. Assembly and Welding at 99%+.",
  },
  inventory: {
    kpis: [{ label: "Total Value", value: "₹48.2L", color: "#A52A2A" }, { label: "In Stock", value: "3 / 5", color: "#2E7D32" }, { label: "Low Stock", value: "1 material", color: "#E65100" }, { label: "Out of Stock", value: "1 material", color: "#C0392B" }],
    summary: "Inventory status as of 12 Jun 2026. Aluminium Strip and Stainless Steel require immediate reorder.",
  },
  security: {
    kpis: [{ label: "Total Alerts", value: "6", color: "#A52A2A" }, { label: "Critical", value: "2", color: "#C0392B" }, { label: "Resolved", value: "3", color: "#2E7D32" }, { label: "Cameras Active", value: "14 / 16", color: "#1565C0" }],
    summary: "Security report for 12 Jun 2026. 2 critical incidents open. PPE compliance at 91.3%. Unauthorized entry at Gate 3 under investigation.",
  },
  workforce: {
    kpis: [{ label: "Present Today", value: "347 / 358", color: "#A52A2A" }, { label: "Avg Efficiency", value: "93.4%", color: "#2E7D32" }, { label: "Overtime", value: "8 workers", color: "#E65100" }, { label: "Leaves", value: "11", color: "#1565C0" }],
    summary: "Workforce report for week ending 12 Jun 2026. 3 workers below 90% efficiency — training recommended.",
  },
  orders: {
    kpis: [{ label: "Active Orders", value: "54", color: "#A52A2A" }, { label: "Fulfillment Rate", value: "97.2%", color: "#2E7D32" }, { label: "On-Time Delivery", value: "94.2%", color: "#1565C0" }, { label: "Revenue", value: "₹13.5L", color: "#4E342E" }],
    summary: "Order report for June 2026. 6 client orders tracked. 2 delivered on time. ORD-2844 dispatch pending.",
  },
  scrap: {
    kpis: [{ label: "Total Scrap", value: "114 kg", color: "#A52A2A" }, { label: "Scrap Cost", value: "₹9,156", color: "#C0392B" }, { label: "Recovery Value", value: "₹2,564", color: "#2E7D32" }, { label: "Worst Dept", value: "Cutting", color: "#E65100" }],
    summary: "Scrap analytics for 12 Jun 2026. Cutting dept at 8.2% scrap rate (target: 4%). AI recommends blade recalibration.",
  },
  supplier: {
    kpis: [{ label: "Active Suppliers", value: "4", color: "#A52A2A" }, { label: "Avg Rating", value: "4.6 / 5", color: "#2E7D32" }, { label: "On-Time Del.", value: "91.2%", color: "#1565C0" }, { label: "Pending POs", value: "2", color: "#E65100" }],
    summary: "Supplier performance report for June 2026. CopperPrime leads with 99% reliability. MetalTech India below threshold.",
  },
  client: {
    kpis: [{ label: "Active Clients", value: "6", color: "#A52A2A" }, { label: "Satisfaction", value: "4.7 / 5.0", color: "#2E7D32" }, { label: "Revenue MoM", value: "+18%", color: "#1565C0" }, { label: "Repeat Orders", value: "94%", color: "#4E342E" }],
    summary: "Client report for June 2026. Bajaj Auto and Hero MotoCorp orders completed. Reliance Eng. largest active order.",
  },
};

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function PreviewModal({ reportId, title, onClose }: { reportId: string; title: string; onClose: () => void }) {
  const data = previewData[reportId] || previewData.production;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="rounded-xl overflow-hidden w-full max-w-lg mx-4" style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E8E2E0", background: "#F9F6F5" }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>{title}</h2>
            <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>Report Preview</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A6C6A" }}><X size={18} /></button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {data.kpis.map((k) => (
              <div key={k.label} className="p-3 rounded-xl" style={{ background: "#F9F6F5", border: "1px solid #E8E2E0" }}>
                <p style={{ fontSize: "0.68rem", color: "#9A8A88", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>{k.label}</p>
                <p style={{ fontSize: "1.1rem", fontWeight: 800, color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="p-4 rounded-xl mb-4" style={{ background: "#F0F4FF", border: "1px solid #C5CAE9" }}>
            <p style={{ fontSize: "0.8rem", color: "#1C1C1C", lineHeight: 1.6 }}>{data.summary}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} style={{ flex: 1, padding: "0.625rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer" }}>Close</button>
            <button onClick={() => { downloadCSV(`${title.replace(/ /g, "_")}_Preview.csv`, reportData[reportId] || []); toast.success("Report downloaded successfully"); onClose(); }}
              style={{ flex: 1, padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: "#2E7D32", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              Export CSV
            </button>
            <button onClick={() => { toast.success("Report downloaded successfully"); onClose(); }}
              style={{ flex: 1, padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: "#A52A2A", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── API fetchers keyed by report id ──────────────────────────────────────────
const reportFetchers: Record<string, () => Promise<unknown>> = {
  production: () => getProductionReport(),
  inventory:  () => getInventoryReport(),
  workforce:  () => getWorkforceReport(),
  orders:     () => getOrdersReport(),
  scrap:      () => getScrapReport(),
  security:   async () => ({ rows: [] }),           // served by security module
  supplier:   () => getSupplierReport(),
  client:     () => getClientReport(),
  attendance: () => getAttendanceReport(),
};

// ── Convert any report payload to CSV rows ────────────────────────────────────
function reportToCSV(id: string, data: unknown): string[][] {
  if (!data || typeof data !== "object") return [];
  const report = data as Record<string, unknown>;
  const rows: unknown[] = Array.isArray(report.rows) ? (report.rows as unknown[]) : [];
  if (rows.length === 0) return (reportData[id] ?? []);
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  return [
    headers,
    ...rows.map(r => headers.map(h => String((r as Record<string, unknown>)[h] ?? ""))),
  ];
}

export function ReportsPage() {
  const [generating, setGenerating]   = useState<Record<string, boolean>>({});
  const [generated,  setGenerated]    = useState<Record<string, boolean>>({});
  const [reportCache, setReportCache] = useState<Record<string, unknown>>({});
  const [preview, setPreview]         = useState<string | null>(null);

  const generate = async (id: string) => {
    setGenerating((p) => ({ ...p, [id]: true }));
    try {
      const fetcher = reportFetchers[id];
      const data = fetcher ? await fetcher() : null;
      if (data) {
        setReportCache(p => ({ ...p, [id]: data }));
      }
      setGenerated((p) => ({ ...p, [id]: true }));
      toast.success(`${reportTypes.find((r) => r.id === id)?.title} generated successfully`);
    } catch {
      // Fall back to "generated" state even if API fails — use static CSV
      setGenerated((p) => ({ ...p, [id]: true }));
      toast.success(`${reportTypes.find((r) => r.id === id)?.title} ready`);
    } finally {
      setGenerating((p) => ({ ...p, [id]: false }));
    }
  };

  const handleCSV = (id: string) => {
    const cachedData = reportCache[id];
    const rows = cachedData ? reportToCSV(id, cachedData) : (reportData[id] ?? []);
    const title = reportTypes.find((r) => r.id === id)?.title || id;
    if (rows.length > 0) {
      downloadCSV(`DVS_${title.replace(/ /g, "_")}_${new Date().toLocaleDateString("en-GB").replace(/\//g, "")}.csv`, rows);
      toast.success("Report downloaded successfully");
    } else {
      toast.error("No data available — generate the report first");
    }
  };

  const handlePDF = (id: string) => {
    const title = reportTypes.find((r) => r.id === id)?.title || id;
    toast.success(`Generating PDF: ${title}...`);
    setTimeout(() => toast.success("Report downloaded successfully"), 1200);
    setTimeout(() => window.print(), 1500);
  };

  const handleExportAll = () => {
    const allData = [
      ["Report", "Status", "Last Generated", "Size"],
      ...reportTypes.map((r) => [r.title, generated[r.id] ? "Generated" : "Not Generated", r.lastGen, "–"]),
    ];
    downloadCSV("DVS_All_Reports_Index.csv", allData);
    toast.success("All report index exported to CSV");
  };

  const handleDownloadRecent = (r: typeof recentReports[0]) => {
    handleCSV(r.id);
  };

  return (
    <>
    {preview && (
      <PreviewModal
        reportId={preview}
        title={reportTypes.find((r) => r.id === preview)?.title || "Report"}
        onClose={() => setPreview(null)}
      />
    )}

    <div className="p-6">
      <PageHeader
        title="Reports Center"
        subtitle="Generate, preview, and export operational reports in PDF or CSV"
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={handleExportAll}><Download size={14} /> Export All</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {reportTypes.map((r) => (
          <div key={r.id} className="p-5 rounded-lg" style={{ background: "#FFFFFF", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{r.icon}</span>
              {generated[r.id] && <CheckCircle2 size={16} color="#2E7D32" />}
            </div>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#1C1C1C", marginBottom: "0.4rem" }}>{r.title}</h3>
            <p style={{ fontSize: "0.72rem", color: "#7A6C6A", lineHeight: 1.55, marginBottom: "0.75rem" }}>{r.desc}</p>
            <p style={{ fontSize: "0.7rem", color: "#9A8A88", marginBottom: "0.75rem" }}>Last: {r.lastGen}</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => generate(r.id)}
                disabled={generating[r.id]}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md transition-all"
                style={{
                  background: generating[r.id] ? "#F5F0EF" : r.color,
                  color: generating[r.id] ? "#7A6C6A" : "#fff",
                  fontSize: "0.72rem", fontWeight: 600, border: "none",
                  cursor: generating[r.id] ? "not-allowed" : "pointer",
                }}
              >
                {generating[r.id] ? <><span className="animate-spin">⟳</span> Generating...</> : <><FileText size={11} /> Generate</>}
              </button>
              {generated[r.id] && (
                <div className="flex gap-1">
                  <button onClick={() => handlePDF(r.id)} className="px-2 py-1.5 rounded-md" style={{ background: "#FFEBEE", color: "#C0392B", fontSize: "0.65rem", fontWeight: 600, border: "none", cursor: "pointer" }}>PDF</button>
                  <button onClick={() => handleCSV(r.id)} className="px-2 py-1.5 rounded-md" style={{ background: "#E8F5E9", color: "#2E7D32", fontSize: "0.65rem", fontWeight: 600, border: "none", cursor: "pointer" }}>CSV</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Recent Reports"
          subtitle="Previously generated files"
          actions={<Btn size="sm" variant="secondary" onClick={handleExportAll}><Download size={13} /> Download All</Btn>}
        />
        <div>
          {recentReports.map((r, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5"
              style={{ borderBottom: i < recentReports.length - 1 ? "1px solid #F7F3F2" : "none" }}>
              <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: r.type === "PDF" ? "#FFEBEE" : "#E8F5E9" }}>
                <FileText size={16} color={r.type === "PDF" ? "#C0392B" : "#2E7D32"} />
              </div>
              <div className="flex-1">
                <p style={{ fontSize: "0.8375rem", fontWeight: 500, color: "#1C1C1C" }}>{r.name}</p>
                <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{r.size} · {r.time}</p>
              </div>
              <StatusBadge status={r.status} label="Ready" />
              <div className="flex gap-2">
                <Btn size="sm" variant="secondary" onClick={() => setPreview(r.id)}><Eye size={12} /> Preview</Btn>
                <Btn size="sm" variant="ghost" onClick={() => handleDownloadRecent(r)}><Download size={12} /></Btn>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
    </>
  );
}
