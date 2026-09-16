import { useState, useEffect } from "react";
import {
  Camera, AlertTriangle, CheckCircle2, Clock, Eye, Download, Filter,
  RefreshCw, User, Shield, MapPin, Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { PageHeader, Card, CardHeader, StatusBadge, Btn, DataTable, TabBar, KPICard } from "../shared/UI";
import {
  getSecurityKPIs, getIncidents, getAlerts,
  transitionIncidentStatus, acknowledgeAlert, resolveAlert, deleteAlert,
  type SecurityKPIs, type SecurityIncidentDto, type SecurityAlertDto,
} from "../../../lib/services/security.service";

const cameras = [
  { id: "CAM-01", location: "Main Gate", status: "online", zone: "Entry", detections: 14, alert: false },
  { id: "CAM-02", location: "Zone A - Cutting", status: "online", zone: "Production", detections: 8, alert: true },
  { id: "CAM-03", location: "Zone B - Welding", status: "online", zone: "Production", detections: 22, alert: true },
  { id: "CAM-04", location: "Zone C - Assembly", status: "online", zone: "Production", detections: 5, alert: false },
  { id: "CAM-05", location: "Warehouse A", status: "online", zone: "Storage", detections: 3, alert: false },
  { id: "CAM-06", location: "Gate 2 - South", status: "offline", zone: "Entry", detections: 0, alert: false },
  { id: "CAM-07", location: "Restricted Zone R1", status: "online", zone: "Restricted", detections: 1, alert: true },
  { id: "CAM-08", location: "Canteen Area", status: "online", zone: "Common", detections: 0, alert: false },
];

const incidents_static = [
  { id: "INC-2841", date: "12 Jun", time: "09:14", location: "Zone B, CAM-03", type: "PPE Violation", confidence: "94.2%", status: "open", severity: "high", assigned: "Guard R. Kumar", action: "Under Review" },
  { id: "INC-2840", date: "12 Jun", time: "08:47", location: "Gate 3, CAM-06", type: "Unauthorized Entry", confidence: "97.8%", status: "investigating", severity: "critical", assigned: "Mgr. V. Sharma", action: "CCTV Review" },
  { id: "INC-2839", date: "12 Jun", time: "08:30", location: "Zone A, CAM-02", type: "Missing Helmet", confidence: "91.5%", status: "resolved", severity: "medium", assigned: "Guard S. Patel", action: "Warning Issued" },
  { id: "INC-2838", date: "11 Jun", time: "16:22", location: "Restricted R1", type: "Restricted Zone Entry", confidence: "99.1%", status: "resolved", severity: "critical", assigned: "Mgr. V. Sharma", action: "Employee Counselled" },
  { id: "INC-2837", date: "11 Jun", time: "14:10", location: "Zone D, CAM-08", type: "Crowd Formation", confidence: "86.3%", status: "resolved", severity: "low", assigned: "Guard P. Nair", action: "Dispersed" },
  { id: "INC-2836", date: "11 Jun", time: "11:45", location: "Zone B, CAM-03", type: "Missing Safety Vest", confidence: "92.7%", status: "resolved", severity: "medium", assigned: "Guard R. Kumar", action: "Warning Issued" },
];

const alertTrend = [
  { day: "Mon", ppe: 8, unauth: 2, crowd: 3 },
  { day: "Tue", ppe: 6, unauth: 1, crowd: 5 },
  { day: "Wed", ppe: 11, unauth: 3, crowd: 2 },
  { day: "Thu", ppe: 5, unauth: 0, crowd: 1 },
  { day: "Fri", ppe: 7, unauth: 2, crowd: 4 },
];

const incidents_fallback = [
  { id: "INC-2841", date: "12 Jun", time: "09:14", location: "Zone B, CAM-03", type: "PPE Violation", confidence: "94.2%", status: "open", severity: "high", assigned: "Guard R. Kumar", action: "Under Review", _id: 0 },
  { id: "INC-2840", date: "12 Jun", time: "08:47", location: "Gate 3, CAM-06", type: "Unauthorized Entry", confidence: "97.8%", status: "investigating", severity: "critical", assigned: "Mgr. V. Sharma", action: "CCTV Review", _id: 0 },
  { id: "INC-2839", date: "12 Jun", time: "08:30", location: "Zone A, CAM-02", type: "Missing Helmet", confidence: "91.5%", status: "resolved", severity: "medium", assigned: "Guard S. Patel", action: "Warning Issued", _id: 0 },
  { id: "INC-2838", date: "11 Jun", time: "16:22", location: "Restricted R1", type: "Restricted Zone Entry", confidence: "99.1%", status: "resolved", severity: "critical", assigned: "Mgr. V. Sharma", action: "Employee Counselled", _id: 0 },
  { id: "INC-2837", date: "11 Jun", time: "14:10", location: "Zone D, CAM-08", type: "Crowd Formation", confidence: "86.3%", status: "resolved", severity: "low", assigned: "Guard P. Nair", action: "Dispersed", _id: 0 },
  { id: "INC-2836", date: "11 Jun", time: "11:45", location: "Zone B, CAM-03", type: "Missing Safety Vest", confidence: "92.7%", status: "resolved", severity: "medium", assigned: "Guard R. Kumar", action: "Warning Issued", _id: 0 },
];

const resolutionTrend = [
  { day: "Mon", resolved: 12, open: 3 }, { day: "Tue", resolved: 8, open: 2 },
  { day: "Wed", resolved: 15, open: 5 }, { day: "Thu", resolved: 7, open: 0 },
  { day: "Fri", resolved: 9, open: 2 },
];

const detectionTypes = [
  { type: "PPE Violation", count: 37, color: "#E65100" },
  { type: "Missing Helmet", count: 24, color: "#C0392B" },
  { type: "Missing Vest", count: 18, color: "#F57F17" },
  { type: "Unauthorized Entry", count: 8, color: "#8B0000" },
  { type: "Restricted Area", count: 5, color: "#6A1A1A" },
  { type: "Crowd Formation", count: 15, color: "#4E342E" },
];

export function SecurityPage() {
  const [tab, setTab]       = useState("live");
  const [filter, setFilter] = useState("all");

  // ── API state ──────────────────────────────────────────────────────────────
  const [kpis,      setKpis]      = useState<SecurityKPIs | null>(null);
  const [incidents, setIncidents] = useState<SecurityIncidentDto[]>([]);
  const [alerts,    setAlerts]    = useState<SecurityAlertDto[]>([]);
  const [loading,   setLoading]   = useState(true);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      getSecurityKPIs().catch(() => null),
      getIncidents({ pageSize: 50, sortBy: "occurredAt", sortOrder: "desc" }).catch(() => null),
      getAlerts({ pageSize: 50, sortBy: "createdAt", sortOrder: "desc" }).catch(() => null),
    ]).then(([kpiRes, incRes, altRes]) => {
      if (kpiRes) setKpis(kpiRes);
      if (incRes) setIncidents(incRes.data);
      if (altRes) setAlerts(altRes.data);
      setLoading(false);
    });
  };

  useEffect(() => { loadAll(); }, []);

  // ── Derived data (use real API if available, else fallback static) ──────────
  const displayIncidents = incidents.length > 0
    ? incidents.map(i => ({
        id: i.incidentNumber,
        date: new Date(i.occurredAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        time: new Date(i.occurredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
        location: i.location ?? "—",
        type: i.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        confidence: "—",
        status: i.status.toLowerCase().replace("_", "-"),
        severity: i.severity.toLowerCase(),
        assigned: i.assignedToName ?? "Unassigned",
        action: "",
        _id: i.id,
      }))
    : incidents_fallback;

  const filteredIncidents = filter === "all"
    ? displayIncidents
    : displayIncidents.filter(i => i.status === filter || i.status.startsWith(filter));

  // KPI numbers
  const totalAlerts    = kpis?.totalAlerts   ?? 6;
  const activeAlerts   = kpis?.activeAlerts  ?? 3;
  const resolvedToday  = kpis?.resolvedThisMonth ?? 9;
  const criticalInc    = kpis?.criticalIncidents ?? 2;

  // Alert trend — from incidentTrend
  const alertTrendData = kpis?.incidentTrend?.map(e => ({
    day: e.date, ppe: e.count, unauth: 0, crowd: 0,
  })) ?? alertTrend;

  const handleAcknowledge = async (alertId: number) => {
    try {
      await acknowledgeAlert(alertId);
      toast.success("Alert acknowledged");
      loadAll();
    } catch { toast.error("Failed to acknowledge alert"); }
  };

  const handleResolveAlert = async (alertId: number) => {
    try {
      await resolveAlert(alertId);
      toast.success("Alert resolved");
      loadAll();
    } catch { toast.error("Failed to resolve alert"); }
  };

  const handleTransitionIncident = async (incId: number, status: "INVESTIGATING" | "RESOLVED" | "CLOSED") => {
    try {
      await transitionIncidentStatus(incId, status);
      toast.success(`Incident moved to ${status}`);
      loadAll();
    } catch { toast.error("Failed to update incident"); }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="AI Security Management"
        subtitle="YOLO-based real-time detection — PPE compliance, unauthorized access, unusual activity"
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={loadAll}><RefreshCw size={14} /> Refresh</Btn>
            <Btn size="sm"><Download size={14} /> Export Report</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KPICard label="Cameras Online" value="7/8" trend="87.5%" trendDir="flat" icon={Camera} accent="#2E7D32" />
        <KPICard label="Active Alerts"  value={String(activeAlerts)} sub={`${criticalInc} critical`} icon={AlertTriangle} accent="#C0392B" />
        <KPICard label="Resolved Today" value={String(resolvedToday)} trend="+3 vs yesterday" trendDir="up" icon={CheckCircle2} accent="#2E7D32" />
        <KPICard label="Total Incidents" value={String(kpis?.totalIncidents ?? 6)} sub={`${kpis?.openIncidents ?? 2} open`} icon={Zap} accent="#1565C0" />
      </div>

      <TabBar
        tabs={[
          { id: "live", label: "Live Monitoring" },
          { id: "incidents", label: "Incident Center" },
          { id: "reports", label: "Security Reports" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {/* ── LIVE MONITORING ── */}
        {tab === "live" && (
          <div>
            {/* Live Alerts banner */}
            {alerts.filter(a => a.status === "ACTIVE").length > 0 && (
              <div className="mb-5 flex flex-col gap-2">
                {alerts.filter(a => a.status === "ACTIVE").slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3 rounded-xl"
                    style={{ background: a.severity === "CRITICAL" ? "#FFEBEE" : "#FFF8E1", border: `1px solid ${a.severity === "CRITICAL" ? "#FFCDD2" : "#FFE082"}` }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: a.severity === "CRITICAL" ? "#C0392B" : "#E65100" }} />
                    <div className="flex-1">
                      <p style={{ fontSize: "0.8375rem", fontWeight: 600, color: "#1C1C1C" }}>{a.alertNumber} — {a.title}</p>
                      <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{a.location ?? a.type} · {new Date(a.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <StatusBadge status={a.severity.toLowerCase()} />
                    <div className="flex gap-1.5">
                      {a.status === "ACTIVE" && (
                        <button onClick={() => handleAcknowledge(a.id)} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "#E3F2FD", color: "#1565C0", border: "none", cursor: "pointer" }}>Acknowledge</button>
                      )}
                      <button onClick={() => handleResolveAlert(a.id)} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "#E8F5E9", color: "#2E7D32", border: "none", cursor: "pointer" }}>Resolve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Camera grid */}
            <Card className="mb-5">
              <CardHeader title="Camera Grid" subtitle="8 cameras — real-time status" actions={<Btn size="sm" variant="secondary"><Eye size={13} /> Full Screen</Btn>} />
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                {cameras.map((cam) => (
                  <div
                    key={cam.id}
                    className="rounded-lg overflow-hidden"
                    style={{
                      border: `2px solid ${cam.alert ? "#C0392B" : cam.status === "offline" ? "#9A8A88" : "#2E7D32"}30`,
                      boxShadow: cam.alert ? "0 0 12px rgba(192,57,43,0.15)" : "none",
                    }}
                  >
                    {/* Fake camera feed */}
                    <div
                      className="relative flex items-center justify-center"
                      style={{
                        height: "100px",
                        background: cam.status === "offline" ? "#ECEFF1" : "linear-gradient(135deg, #1a2332 0%, #0d1421 100%)",
                      }}
                    >
                      {cam.status === "offline" ? (
                        <div className="text-center">
                          <Camera size={24} color="#9A8A88" />
                          <p style={{ fontSize: "0.65rem", color: "#9A8A88", marginTop: "0.25rem" }}>OFFLINE</p>
                        </div>
                      ) : (
                        <>
                          {/* Simulated feed */}
                          <div style={{ position: "absolute", inset: 0, opacity: 0.3 }}>
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div key={i} style={{ position: "absolute", width: "20px", height: "20px", border: "1px solid #00ff88", borderRadius: "2px", left: `${15 + i * 20}%`, top: `${20 + (i % 2) * 30}%`, opacity: 0.6 }} />
                            ))}
                          </div>
                          {cam.alert && (
                            <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(192,57,43,0.9)", fontSize: "0.6rem", color: "#fff" }}>
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              ALERT
                            </div>
                          )}
                          <div style={{ position: "absolute", bottom: "0.25rem", right: "0.375rem", fontSize: "0.6rem", color: "rgba(255,255,255,0.7)", fontFamily: "JetBrains Mono, monospace" }}>
                            LIVE ● {new Date().toLocaleTimeString()}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="px-3 py-2" style={{ background: "#FAFAFA" }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#1C1C1C" }}>{cam.id}</span>
                        <span
                          className="px-1.5 py-0.5 rounded-full"
                          style={{
                            fontSize: "0.62rem", fontWeight: 600,
                            background: cam.status === "offline" ? "#ECEFF1" : "#E8F5E9",
                            color: cam.status === "offline" ? "#546E7A" : "#2E7D32",
                          }}
                        >
                          {cam.status.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.7rem", color: "#7A6C6A" }}>{cam.location}</p>
                      <p style={{ fontSize: "0.67rem", color: "#9A8A88" }}>{cam.zone} · {cam.detections} detections</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Detection types */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader title="Detection Summary Today" subtitle="By violation type" />
                <div className="p-5">
                  {detectionTypes.map((d) => (
                    <div key={d.type} className="flex items-center gap-3 mb-3">
                      <span style={{ fontSize: "0.8rem", color: "#4A4A4A", minWidth: "160px" }}>{d.type}</span>
                      <div className="flex-1" style={{ height: "8px", background: "#F0ECEB", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ width: `${(d.count / 40) * 100}%`, height: "100%", background: d.color, borderRadius: "999px" }} />
                      </div>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: d.color, minWidth: "28px", textAlign: "right" }}>{d.count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Alert Trend" subtitle="This week by type" />
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={alertTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                      <Bar dataKey="ppe" fill="#E65100" radius={[3, 3, 0, 0]} name="PPE" />
                      <Bar dataKey="unauth" fill="#C0392B" radius={[3, 3, 0, 0]} name="Unauth" />
                      <Bar dataKey="crowd" fill="#4E342E" radius={[3, 3, 0, 0]} name="Crowd" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── INCIDENTS ── */}
        {tab === "incidents" && (
          <div>
            <div className="flex gap-2 mb-4">
              {["all", "open", "investigating", "resolved"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "0.35rem 0.875rem", borderRadius: "0.35rem", fontSize: "0.775rem",
                    background: filter === f ? "#A52A2A" : "#fff", color: filter === f ? "#fff" : "#4A4A4A",
                    border: `1px solid ${filter === f ? "#A52A2A" : "#E8E2E0"}`, cursor: "pointer", textTransform: "capitalize",
                  }}
                >
                  {f === "all" ? "All Incidents" : f}
                </button>
              ))}
              <Btn variant="secondary" size="sm" className="ml-auto" onClick={() => toast.success("Incident report exported")}><Download size={13} /> Export</Btn>
            </div>

            <Card>
              <DataTable
                searchable
                paginate={10}
                columns={[
                  { key: "id", label: "Incident ID" },
                  { key: "datetime", label: "Date & Time" },
                  { key: "location", label: "Location" },
                  { key: "type", label: "Violation Type" },
                  { key: "confidence", label: "Confidence" },
                  { key: "severity", label: "Severity" },
                  { key: "status", label: "Status" },
                  { key: "assigned", label: "Assigned To" },
                ]}
                rows={filteredIncidents.map((inc) => ({
                  id: <span style={{ fontSize: "0.775rem", fontFamily: "JetBrains Mono, monospace", color: "#A52A2A" }}>{inc.id}</span>,
                  datetime: (
                    <div>
                      <p style={{ fontSize: "0.8rem", fontWeight: 500 }}>{inc.date}</p>
                      <p style={{ fontSize: "0.72rem", color: "#9A8A88" }}>{inc.time}</p>
                    </div>
                  ),
                  location: <span style={{ fontSize: "0.8rem" }}>{inc.location}</span>,
                  type: <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{inc.type}</span>,
                  confidence: <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1565C0" }}>{inc.confidence}</span>,
                  severity: <StatusBadge status={inc.severity} />,
                  status: <StatusBadge status={inc.status} />,
                  assigned: <span style={{ fontSize: "0.775rem" }}>{inc.assigned}</span>,
                }))}
              />
            </Card>
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab === "reports" && (
          <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <Card>
                <CardHeader title="Resolution Rate" subtitle="Resolved vs Open this week" />
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={resolutionTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                      <Line type="monotone" dataKey="resolved" stroke="#2E7D32" strokeWidth={2} name="Resolved" dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="open" stroke="#C0392B" strokeWidth={2} name="Open" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader title="Report Generation" />
                <div className="p-5 flex flex-col gap-3">
                  {["Daily Security Report", "Weekly Security Report", "Monthly Security Report", "PPE Compliance Report"].map((r) => (
                    <div key={r} className="flex items-center justify-between p-3 rounded-md" style={{ background: "#FAFAFA", border: "1px solid #E8E2E0" }}>
                      <span style={{ fontSize: "0.8375rem", color: "#1C1C1C" }}>{r}</span>
                      <div className="flex gap-2">
                        <Btn size="sm" variant="secondary" onClick={() => toast.success(`${r} downloaded as PDF`)}><Download size={12} /> PDF</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => toast.success(`${r} downloaded as CSV`)}><Download size={12} /> CSV</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
