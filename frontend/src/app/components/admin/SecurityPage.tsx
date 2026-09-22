import { useState, useEffect } from "react";
import {
  Camera, AlertTriangle, CheckCircle2, Download, RefreshCw, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, CardHeader, StatusBadge, Btn, DataTable, TabBar, KPICard } from "../shared/UI";
import {
  getSecurityKPIs, getIncidents, getAlerts,
  transitionIncidentStatus, acknowledgeAlert, resolveAlert,
  type SecurityKPIs, type SecurityIncidentDto, type SecurityAlertDto,
} from "../../../lib/services/security.service";

export function SecurityPage() {
  const [tab, setTab]       = useState("live");
  const [filter, setFilter] = useState("all");

  // ── API state ──────────────────────────────────────────────────────────────
  const [kpis,      setKpis]      = useState<SecurityKPIs | null>(null);
  const [incidents, setIncidents] = useState<SecurityIncidentDto[]>([]);
  const [alerts,    setAlerts]    = useState<SecurityAlertDto[]>([]);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [kpisError, setKpisError] = useState(false);
  const [incidentsError, setIncidentsError] = useState(false);
  const [alertsError, setAlertsError] = useState(false);

  const loadAll = () => {
    setKpisLoading(true);
    setIncidentsLoading(true);
    setAlertsLoading(true);
    setKpisError(false);
    setIncidentsError(false);
    setAlertsError(false);
    Promise.allSettled([
      getSecurityKPIs(),
      getIncidents({ pageSize: 50, sortBy: "occurredAt", sortOrder: "desc" }),
      getAlerts({ pageSize: 50, sortBy: "createdAt", sortOrder: "desc" }),
    ]).then(([kpiRes, incRes, altRes]) => {
      if (kpiRes.status === "fulfilled") setKpis(kpiRes.value);
      else setKpisError(true);
      if (incRes.status === "fulfilled") setIncidents(incRes.value.data);
      else setIncidentsError(true);
      if (altRes.status === "fulfilled") setAlerts(altRes.value.data);
      else setAlertsError(true);
      setKpisLoading(false);
      setIncidentsLoading(false);
      setAlertsLoading(false);
    });
  };

  useEffect(() => { loadAll(); }, []);

  const displayIncidents = incidents.map(i => ({
    id: i.incidentNumber,
    date: new Date(i.occurredAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    time: new Date(i.occurredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    location: i.location ?? "Unavailable",
    type: i.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
    confidence: "Unavailable",
    status: i.status.toLowerCase().replace("_", "-"),
    severity: i.severity.toLowerCase(),
    assigned: i.assignedToName ?? "Unassigned",
    _id: i.id,
  }));

  const filteredIncidents = filter === "all"
    ? displayIncidents
    : displayIncidents.filter(i => i.status === filter || i.status.startsWith(filter));

  // KPI numbers
  const activeAlerts = kpis?.activeAlerts;
  const criticalInc = kpis?.criticalIncidents;

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
            <Btn size="sm" disabled><Download size={14} /> Export Unavailable</Btn>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KPICard label="Cameras Online" value="Unavailable" sub="CCTV integration pending" icon={Camera} accent="#2E7D32" />
        <KPICard label="Active Alerts" value={kpisLoading ? "Loading..." : kpisError ? "Unavailable" : activeAlerts === undefined ? "Unavailable" : String(activeAlerts)} sub={kpis && criticalInc !== undefined ? `${criticalInc} critical` : undefined} icon={AlertTriangle} accent="#C0392B" />
        <KPICard label="Resolved This Month" value={kpisLoading ? "Loading..." : kpisError ? "Unavailable" : kpis?.resolvedThisMonth === undefined ? "Unavailable" : String(kpis.resolvedThisMonth)} icon={CheckCircle2} accent="#2E7D32" />
        <KPICard label="Total Incidents" value={kpisLoading ? "Loading..." : kpisError ? "Unavailable" : kpis?.totalIncidents === undefined ? "Unavailable" : String(kpis.totalIncidents)} sub={kpis ? `${kpis.openIncidents} open` : undefined} icon={Zap} accent="#1565C0" />
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
            {alertsLoading ? (
              <div className="mb-5 p-4 rounded-xl" style={{ background: "#F5F5F5", border: "1px solid #E8E2E0" }}>Loading security alerts...</div>
            ) : alertsError ? (
              <div className="mb-5 p-4 rounded-xl" style={{ background: "#FFF8F8", border: "1px solid #FFCDD2", color: "#C0392B" }}>Unable to load security alerts.</div>
            ) : alerts.filter(a => a.status === "ACTIVE").length > 0 && (
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
            {!alertsLoading && !alertsError && alerts.length === 0 && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: "#F5F5F5", border: "1px solid #E8E2E0", color: "#7A6C6A" }}>No security alerts available.</div>
            )}
            {!alertsLoading && !alertsError && alerts.length > 0 && alerts.every((alert) => alert.status !== "ACTIVE") && (
              <div className="mb-5 p-4 rounded-xl" style={{ background: "#F5F5F5", border: "1px solid #E8E2E0", color: "#7A6C6A" }}>No active security alerts.</div>
            )}
            {/* Camera grid */}
            <Card className="mb-5">
              <CardHeader title="Camera Grid" subtitle="CCTV/AI integration pending" actions={<Btn size="sm" variant="secondary" disabled><Camera size={13} /> Unavailable</Btn>} />
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2 md:col-span-4 flex flex-col items-center justify-center rounded-lg py-14" style={{ background: "#F5F5F5", border: "1px dashed #D4BFBB" }}>
                  <Camera size={28} color="#9A8A88" />
                  <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#4A4A4A", marginTop: "0.75rem" }}>CCTV/AI integration pending</p>
                  <p style={{ fontSize: "0.75rem", color: "#7A6C6A", marginTop: "0.25rem" }}>Live feeds, camera status, and device data are unavailable.</p>
                </div>
              </div>
            </Card>

            {/* Detection types */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader title="Detection Summary Today" subtitle="AI detection data unavailable" />
                <div className="p-5">
                  <p style={{ fontSize: "0.8375rem", color: "#7A6C6A" }}>Unavailable until real AI detection data is connected.</p>
                </div>
              </Card>

              <Card>
                <CardHeader title="Alert Trend" subtitle="Detection categories unavailable" />
                <div className="p-5">
                  <p style={{ fontSize: "0.8375rem", color: "#7A6C6A" }}>Aggregate incident trend data is not type-specific and is not shown here.</p>
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
              <Btn variant="secondary" size="sm" className="ml-auto" disabled><Download size={13} /> Export Unavailable</Btn>
            </div>

            <Card>
              <DataTable
                searchable
                paginate={10}
                emptyMsg={incidentsLoading ? "Loading incidents..." : incidentsError ? "Unable to load incidents." : "No incidents available."}
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
                <CardHeader title="Resolution Rate" subtitle="Unavailable from current security APIs" />
                <div className="p-5">
                  <p style={{ fontSize: "0.8375rem", color: "#7A6C6A" }}>No resolution trend data available.</p>
                </div>
              </Card>

              <Card>
                <CardHeader title="Report Generation" />
                <div className="p-5 flex flex-col gap-3">
                  {["Daily Security Report", "Weekly Security Report", "Monthly Security Report", "PPE Compliance Report"].map((r) => (
                    <div key={r} className="flex items-center justify-between p-3 rounded-md" style={{ background: "#FAFAFA", border: "1px solid #E8E2E0" }}>
                      <span style={{ fontSize: "0.8375rem", color: "#1C1C1C" }}>{r}</span>
                      <div className="flex gap-2">
                        <Btn size="sm" variant="secondary" disabled><Download size={12} /> PDF Unavailable</Btn>
                        <Btn size="sm" variant="ghost" disabled><Download size={12} /> CSV Unavailable</Btn>
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
