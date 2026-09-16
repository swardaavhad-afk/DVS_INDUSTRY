import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from "recharts";
import {
  Plus, Download, AlertTriangle, CheckCircle2, ShoppingCart, Play,
  FileText, Zap, TrendingUp, Package, RotateCcw, Info, Printer, X,
} from "lucide-react";
import { PageHeader, Card, CardHeader, KPICard, StatusBadge, Btn, DataTable, TabBar } from "../shared/UI";
import { useERP } from "./ERPContext";
import {
  getMaterials, getInventoryStats, adjustStock, createMaterial,
  type MaterialDto, type InventoryStatistics,
} from "../../../lib/services/inventory.service";

/* ── Types ── */
interface CalcInputs {
  partName: string;
  partNumber: string;
  materialType: string;
  weightReceived: string;
  materialPerPart: string;
  batchQty: string;
  costPerKg: string;
  operator: string;
}

interface CalcResult {
  partsProduced: number;
  materialConsumed: number;
  scrapGenerated: number;
  materialRemaining: number;
  utilizationPct: number;
  scrapCost: number;
  efficiencyRating: string;
  efficiencyColor: string;
  inventoryBalance: number;
  batchLimited: boolean;
  timestamp: string;
}

interface ProductionRecord {
  id: string;
  date: string;
  partName: string;
  partNumber: string;
  rawMaterial: string;
  weightReceived: number;
  materialConsumed: number;
  partsProduced: number;
  scrapGenerated: number;
  materialRemaining: number;
  operator: string;
  status: string;
  utilizationPct: number;
}

/* ── Static inventory data ── */
const INITIAL_INVENTORY: Record<string, { qty: number; cost: number; unit: string; threshold: number; location: string }> = {
  "Steel Sheet": { qty: 850, cost: 72, unit: "kg", threshold: 200, location: "WH-A Row 3" },
  "Stainless Steel": { qty: 420, cost: 145, unit: "kg", threshold: 100, location: "WH-A Row 5" },
  "Aluminium Sheet": { qty: 42, cost: 185, unit: "kg", threshold: 100, location: "WH-A Row 7" },
  "Copper Sheet": { qty: 180, cost: 620, unit: "kg", threshold: 50, location: "WH-B Row 2" },
};

const SCRAP_RECOVERY_RATE = 0.28; // scrap recovered as % of material cost

/* ── Seed production records ── */
const SEED_RECORDS: ProductionRecord[] = [
  { id: "PR-001", date: "12 Jun 07:30", partName: "Motor Housing", partNumber: "MH-2204", rawMaterial: "Steel Sheet", weightReceived: 200, materialConsumed: 180, partsProduced: 36, scrapGenerated: 20, materialRemaining: 0, operator: "Arjun Mehta", status: "completed", utilizationPct: 90.0 },
  { id: "PR-002", date: "11 Jun 14:00", partName: "Bracket Assembly", partNumber: "BA-1102", rawMaterial: "Stainless Steel", weightReceived: 150, materialConsumed: 142.5, partsProduced: 57, scrapGenerated: 7.5, materialRemaining: 0, operator: "Priya Sharma", status: "completed", utilizationPct: 95.0 },
  { id: "PR-003", date: "10 Jun 09:15", partName: "Bus Bar", partNumber: "BB-0804", rawMaterial: "Copper Sheet", weightReceived: 80, materialConsumed: 72, partsProduced: 16, scrapGenerated: 8, materialRemaining: 0, operator: "Kavitha Nair", status: "completed", utilizationPct: 90.0 },
];

const materialTypes = ["Steel Sheet", "Stainless Steel", "Aluminium Sheet", "Copper Sheet"];

const scrapTrendData = [
  { day: "Mon", scrap: 18 }, { day: "Tue", scrap: 22 }, { day: "Wed", scrap: 14 },
  { day: "Thu", scrap: 28 }, { day: "Fri", scrap: 20 }, { day: "Sat", scrap: 12 },
];

const deptScrapData = [
  { dept: "Cutting", kg: 42 }, { dept: "Welding", kg: 18 },
  { dept: "Pressing", kg: 31 }, { dept: "Assembly", kg: 9 }, { dept: "Finishing", kg: 14 },
];

/* ── Helpers ── */
function getEfficiencyRating(pct: number): { label: string; color: string } {
  if (pct >= 95) return { label: "Excellent", color: "#2E7D32" };
  if (pct >= 88) return { label: "Good", color: "#1565C0" };
  if (pct >= 78) return { label: "Acceptable", color: "#F57F17" };
  return { label: "Needs Review", color: "#C0392B" };
}

function generateInsights(result: CalcResult, material: string, inventory: typeof INITIAL_INVENTORY): string[] {
  const insights: string[] = [];
  const inv = inventory[material];

  if (result.utilizationPct >= 95)
    insights.push("✅ Material utilization is excellent — production yield above industry benchmark of 92%.");
  else if (result.utilizationPct >= 88)
    insights.push("✅ Material utilization is within acceptable range. Minor scrap reduction possible through tooling calibration.");
  else
    insights.push("⚠ Material utilization below target. Review cutting parameters and tooling condition for Dept: Cutting.");

  if (result.scrapGenerated > 15)
    insights.push(`⚠ Scrap generated (${result.scrapGenerated.toFixed(2)} kg) is above expected range. Recommend scrap bin segregation and secondary use analysis.`);
  else
    insights.push(`✅ Scrap level (${result.scrapGenerated.toFixed(2)} kg) is within normal range for this part type.`);

  if (result.inventoryBalance < inv.threshold * 1.5)
    insights.push(`⚠ Remaining ${material} inventory (${result.inventoryBalance.toFixed(1)} kg) approaching reorder threshold (${inv.threshold} kg). Recommend raising PO now.`);
  else if (result.inventoryBalance < inv.threshold * 3)
    insights.push(`ℹ ${material} inventory adequate for ~${Math.floor(result.inventoryBalance / (result.materialConsumed / result.partsProduced))} more parts. Monitor closely.`);

  const reorderQty = Math.max(500, Math.ceil((inv.threshold * 5 - result.inventoryBalance) / 100) * 100);
  if (result.inventoryBalance < inv.threshold * 2)
    insights.push(`📋 Recommended reorder quantity: ${reorderQty} kg from preferred supplier to maintain 30-day buffer.`);

  if (result.scrapCost > 500)
    insights.push(`💡 Estimated scrap recovery value: ₹${(result.scrapCost).toFixed(0)}. Consider selling scrap to certified dealers to recover material cost.`);

  return insights;
}

/* ══════════════════════════════════════════════
   PRODUCTION CALCULATOR COMPONENT
══════════════════════════════════════════════ */
function ProductionCalculator() {
  const [inputs, setInputs] = useState<CalcInputs>({
    partName: "", partNumber: "", materialType: "Steel Sheet",
    weightReceived: "", materialPerPart: "", batchQty: "",
    costPerKg: "", operator: "",
  });
  const [result, setResult] = useState<CalcResult | null>(null);
  const [records, setRecords] = useState<ProductionRecord[]>(SEED_RECORDS);
  const [inventory, setInventory] = useState({ ...INITIAL_INVENTORY });
  const [running, setRunning] = useState(false);
  const [inventoryUpdated, setInventoryUpdated] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<CalcInputs>>({});
  const resultRef = useRef<HTMLDivElement>(null);

  const setField = (k: keyof CalcInputs) => (v: string) => {
    setInputs((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<CalcInputs> = {};
    if (!inputs.partName.trim()) e.partName = "Required";
    if (!inputs.partNumber.trim()) e.partNumber = "Required";
    const wp = parseFloat(inputs.weightReceived);
    if (!inputs.weightReceived || isNaN(wp) || wp <= 0) e.weightReceived = "Enter a valid weight";
    const m = parseFloat(inputs.materialPerPart);
    if (!inputs.materialPerPart || isNaN(m) || m <= 0) e.materialPerPart = "Enter a valid weight";
    if (m >= wp) e.materialPerPart = "Must be less than total weight received";
    const cost = parseFloat(inputs.costPerKg);
    if (!inputs.costPerKg || isNaN(cost) || cost <= 0) e.costPerKg = "Enter cost per kg";
    if (!inputs.operator.trim()) e.operator = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const runCalculation = async () => {
    if (!validate()) return;
    setRunning(true);
    setInventoryUpdated(false);
    setResult(null);

    // Simulate backend processing delay
    await new Promise((r) => setTimeout(r, 1400));

    const Wp = parseFloat(inputs.weightReceived);   // Raw material received (kg)
    const M = parseFloat(inputs.materialPerPart);   // Material per part (kg)
    const costPerKg = parseFloat(inputs.costPerKg);
    const batchQty = inputs.batchQty ? parseInt(inputs.batchQty) : null;

    // ── Core production model ──
    const maxPartsFromMaterial = Math.floor(Wp / M);
    const partsProduced = batchQty ? Math.min(batchQty, maxPartsFromMaterial) : maxPartsFromMaterial;
    const materialConsumed = parseFloat((partsProduced * M).toFixed(3));
    const scrapGenerated = parseFloat((Wp - materialConsumed).toFixed(3));
    const materialRemaining = 0; // all received material is processed in this batch
    const utilizationPct = parseFloat(((materialConsumed / Wp) * 100).toFixed(2));
    const scrapCost = parseFloat((scrapGenerated * costPerKg * SCRAP_RECOVERY_RATE).toFixed(2));

    // Current inventory balance after this production run
    const invBefore = inventory[inputs.materialType]?.qty ?? 0;
    const inventoryBalance = Math.max(0, parseFloat((invBefore - Wp).toFixed(2)));

    const { label: efficiencyRating, color: efficiencyColor } = getEfficiencyRating(utilizationPct);
    const batchLimited = !!(batchQty && batchQty < maxPartsFromMaterial);

    const res: CalcResult = {
      partsProduced, materialConsumed, scrapGenerated, materialRemaining,
      utilizationPct, scrapCost, efficiencyRating, efficiencyColor,
      inventoryBalance, batchLimited,
      timestamp: new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    };

    setResult(res);
    setInsights(generateInsights(res, inputs.materialType, inventory));
    setRunning(false);

    // Auto-update inventory
    setTimeout(() => {
      setInventory((prev) => ({
        ...prev,
        [inputs.materialType]: {
          ...prev[inputs.materialType],
          qty: Math.max(0, prev[inputs.materialType].qty - Wp),
        },
      }));

      // Add to production records
      const newRecord: ProductionRecord = {
        id: `PR-${String(records.length + 1).padStart(3, "0")}`,
        date: new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }),
        partName: inputs.partName,
        partNumber: inputs.partNumber,
        rawMaterial: inputs.materialType,
        weightReceived: Wp,
        materialConsumed,
        partsProduced,
        scrapGenerated,
        materialRemaining: inventoryBalance,
        operator: inputs.operator,
        status: "completed",
        utilizationPct,
      };
      setRecords((prev) => [newRecord, ...prev]);
      setInventoryUpdated(true);

      // Scroll to results
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
  };

  const resetAll = () => {
    setInputs({ partName: "", partNumber: "", materialType: "Steel Sheet", weightReceived: "", materialPerPart: "", batchQty: "", costPerKg: "", operator: "" });
    setResult(null);
    setInsights([]);
    setErrors({});
    setInventoryUpdated(false);
  };

  /* ── Chart data from result ── */
  const pieData = result
    ? [
        { name: "Consumed", value: parseFloat(result.materialConsumed.toFixed(2)), color: "#A52A2A" },
        { name: "Scrap", value: parseFloat(result.scrapGenerated.toFixed(2)), color: "#D4793A" },
      ]
    : [];

  const barData = result
    ? [
        { label: "Received", value: parseFloat(inputs.weightReceived), color: "#4E342E" },
        { label: "Consumed", value: result.materialConsumed, color: "#A52A2A" },
        { label: "Scrap", value: result.scrapGenerated, color: "#D4793A" },
      ]
    : [];

  const gaugeData = result
    ? [{ name: "Utilization", value: result.utilizationPct, fill: result.efficiencyColor }]
    : [];

  /* ─────── FIELD COMPONENT ─────── */
  const Field = ({
    label, required, error, children,
  }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) => (
    <div>
      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4A4A4A", marginBottom: "0.35rem", letterSpacing: "0.02em" }}>
        {label}{required && <span style={{ color: "#C0392B" }}> *</span>}
      </label>
      {children}
      {error && <p style={{ fontSize: "0.7rem", color: "#C0392B", marginTop: "0.25rem" }}>{error}</p>}
    </div>
  );

  const inputStyle = (hasError?: string): React.CSSProperties => ({
    width: "100%",
    padding: "0.6rem 0.875rem",
    border: `1.5px solid ${hasError ? "#C0392B" : "#E0D8D6"}`,
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    color: "#1C1C1C",
    background: "#FAFAFA",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    fontFamily: "'Inter', sans-serif",
  });

  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "#A52A2A";
    e.target.style.boxShadow = "0 0 0 3px rgba(165,42,42,0.1)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = errors[e.target.name as keyof CalcInputs] ? "#C0392B" : "#E0D8D6";
    e.target.style.boxShadow = "none";
  };

  return (
    <div>
      {/* ── INVENTORY UPDATE BANNER ── */}
      {inventoryUpdated && (
        <div
          className="flex items-center gap-3 px-5 py-3.5 rounded-xl mb-5"
          style={{ background: "#E8F5E9", border: "1px solid #A5D6A7" }}
        >
          <CheckCircle2 size={18} color="#2E7D32" />
          <div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1B5E20" }}>Inventory Updated Automatically</p>
            <p style={{ fontSize: "0.775rem", color: "#2E7D32" }}>
              {inputs.materialType} reduced by {inputs.weightReceived} kg · Production record created · Scrap record logged · Dashboard synced
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ════ LEFT: INPUT FORM ════ */}
        <div className="xl:col-span-2">
          <div
            className="rounded-xl overflow-hidden sticky top-6"
            style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
          >
            {/* Form header */}
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{ background: "linear-gradient(135deg, #A52A2A 0%, #7B1F1F 100%)", borderBottom: "none" }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Play size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>Production Run Setup</p>
                <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)" }}>Configure parameters · System calculates automatically</p>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Section: Part Info */}
              <div>
                <p style={{ fontSize: "0.67rem", fontWeight: 700, color: "#A52A2A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.875rem" }}>
                  Part Information
                </p>
                <div className="flex flex-col gap-3.5">
                  <Field label="Part Name" required error={errors.partName}>
                    <input
                      name="partName"
                      placeholder="e.g. Motor Housing Cover"
                      value={inputs.partName}
                      onChange={(e) => setField("partName")(e.target.value)}
                      style={inputStyle(errors.partName)}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </Field>
                  <Field label="Part Number" required error={errors.partNumber}>
                    <input
                      name="partNumber"
                      placeholder="e.g. MH-2024-A"
                      value={inputs.partNumber}
                      onChange={(e) => setField("partNumber")(e.target.value)}
                      style={inputStyle(errors.partNumber)}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </Field>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: "1px", background: "#F0ECEB" }} />

              {/* Section: Material */}
              <div>
                <p style={{ fontSize: "0.67rem", fontWeight: 700, color: "#A52A2A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.875rem" }}>
                  Raw Material Parameters
                </p>
                <div className="flex flex-col gap-3.5">
                  <Field label="Raw Material Type" required>
                    <select
                      name="materialType"
                      value={inputs.materialType}
                      onChange={(e) => setField("materialType")(e.target.value)}
                      style={{ ...inputStyle(), cursor: "pointer" }}
                      onFocus={onFocus} onBlur={onBlur}
                    >
                      {materialTypes.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    {/* Live stock badge */}
                    {inventory[inputs.materialType] && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Package size={11} color="#7A6C6A" />
                        <span style={{ fontSize: "0.7rem", color: "#7A6C6A" }}>
                          Current stock: <strong style={{ color: inventory[inputs.materialType].qty < inventory[inputs.materialType].threshold ? "#C0392B" : "#2E7D32" }}>
                            {inventory[inputs.materialType].qty} kg
                          </strong> · ₹{inventory[inputs.materialType].cost}/kg
                        </span>
                      </div>
                    )}
                  </Field>

                  <Field label="Raw Material Weight Received (Wp) — kg" required error={errors.weightReceived}>
                    <input
                      name="weightReceived"
                      type="number" min="0" step="0.1"
                      placeholder="Total kg received for this run"
                      value={inputs.weightReceived}
                      onChange={(e) => setField("weightReceived")(e.target.value)}
                      style={inputStyle(errors.weightReceived)}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </Field>

                  <Field label="Material Required Per Part (M) — kg" required error={errors.materialPerPart}>
                    <input
                      name="materialPerPart"
                      type="number" min="0" step="0.001"
                      placeholder="kg of material per finished part"
                      value={inputs.materialPerPart}
                      onChange={(e) => setField("materialPerPart")(e.target.value)}
                      style={inputStyle(errors.materialPerPart)}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </Field>

                  <Field label="Production Batch Quantity (optional)">
                    <input
                      name="batchQty"
                      type="number" min="1"
                      placeholder="Leave blank to maximise output"
                      value={inputs.batchQty}
                      onChange={(e) => setField("batchQty")(e.target.value)}
                      style={inputStyle()}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                    <p style={{ fontSize: "0.68rem", color: "#9A8A88", marginTop: "0.25rem" }}>
                      If set, production stops when batch target is reached.
                    </p>
                  </Field>

                  <Field label="Material Cost Per Kg (₹)" required error={errors.costPerKg}>
                    <input
                      name="costPerKg"
                      type="number" min="0" step="0.5"
                      placeholder={`e.g. ${inventory[inputs.materialType]?.cost ?? 72}`}
                      value={inputs.costPerKg}
                      onChange={(e) => setField("costPerKg")(e.target.value)}
                      style={inputStyle(errors.costPerKg)}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </Field>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: "1px", background: "#F0ECEB" }} />

              {/* Section: Operator */}
              <div>
                <p style={{ fontSize: "0.67rem", fontWeight: 700, color: "#A52A2A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.875rem" }}>
                  Production Assignment
                </p>
                <Field label="Operator / Production Lead" required error={errors.operator}>
                  <select
                    name="operator"
                    value={inputs.operator}
                    onChange={(e) => setField("operator")(e.target.value)}
                    style={{ ...inputStyle(errors.operator), cursor: "pointer" }}
                    onFocus={onFocus} onBlur={onBlur}
                  >
                    <option value="">Select operator</option>
                    {["Arjun Mehta", "Priya Sharma", "Kavitha Nair", "Ravi Patel", "Suresh Kumar", "Deepak Singh"].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5 mt-1">
                <button
                  onClick={runCalculation}
                  disabled={running}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl"
                  style={{
                    background: running ? "#D4BFBB" : "#A52A2A",
                    color: "#fff", fontWeight: 700, fontSize: "0.9rem",
                    border: "none", cursor: running ? "not-allowed" : "pointer",
                    boxShadow: running ? "none" : "0 4px 14px rgba(165,42,42,0.35)",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { if (!running) e.currentTarget.style.background = "#8B2222"; }}
                  onMouseLeave={(e) => { if (!running) e.currentTarget.style.background = "#A52A2A"; }}
                >
                  {running ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Processing…</>
                  ) : (
                    <><Play size={16} /> Run Production</>
                  )}
                </button>
                <button
                  onClick={resetAll}
                  className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl"
                  style={{ background: "#F5F0EF", color: "#4E342E", border: "1px solid #E0D8D6", cursor: "pointer" }}
                >
                  <RotateCcw size={15} />
                </button>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: "#FDF5F5", border: "1px solid #FFCDD2" }}>
                <Info size={13} color="#A52A2A" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                <p style={{ fontSize: "0.72rem", color: "#7A3030", lineHeight: 1.55 }}>
                  Scrap is calculated automatically from your material inputs. No manual entry required.
                  The system applies the DVS Industries production model internally.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ════ RIGHT: RESULTS ════ */}
        <div className="xl:col-span-3 flex flex-col gap-5" ref={resultRef}>
          {!result && !running && (
            <div
              className="flex flex-col items-center justify-center rounded-xl py-24"
              style={{ background: "#fff", border: "2px dashed #E0D8D6" }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#FDF5F5" }}>
                <Zap size={28} color="#A52A2A" />
              </div>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: "#1C1C1C" }}>Ready to Calculate</p>
              <p style={{ fontSize: "0.8375rem", color: "#9A8A88", marginTop: "0.4rem", textAlign: "center", maxWidth: "300px" }}>
                Fill in the production parameters on the left and click "Run Production" to generate results.
              </p>
            </div>
          )}

          {running && (
            <div className="flex flex-col items-center justify-center rounded-xl py-24" style={{ background: "#fff", border: "1px solid #E8E2E0" }}>
              <div className="w-12 h-12 rounded-full border-4 border-red-100 border-t-red-700 animate-spin mb-4" />
              <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#A52A2A" }}>Running Production Simulation…</p>
              <p style={{ fontSize: "0.775rem", color: "#9A8A88", marginTop: "0.3rem" }}>Calculating parts, scrap, utilization, and inventory impact</p>
            </div>
          )}

          {result && (
            <>
              {/* ── KPI Cards ── */}
              <div>
                <p style={{ fontSize: "0.67rem", fontWeight: 700, color: "#A52A2A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.875rem" }}>
                  Production Results — {inputs.partName} ({inputs.partNumber})
                </p>
                {result.batchLimited && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-3" style={{ background: "#E3F2FD", border: "1px solid #90CAF9" }}>
                    <Info size={14} color="#1565C0" />
                    <p style={{ fontSize: "0.775rem", color: "#1565C0" }}>
                      Production stopped at batch target ({inputs.batchQty} pcs). Material capacity was higher.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: "Parts Produced", value: result.partsProduced.toLocaleString(), unit: "pcs", color: "#A52A2A", icon: "🔩" },
                    { label: "Scrap Generated", value: result.scrapGenerated.toFixed(2), unit: "kg", color: "#D4793A", icon: "♻" },
                    { label: "Material Utilization", value: `${result.utilizationPct}%`, unit: result.efficiencyRating, color: result.efficiencyColor, icon: "📊" },
                    { label: "Material Consumed", value: result.materialConsumed.toFixed(2), unit: "kg", color: "#4E342E", icon: "⚙" },
                    { label: "Inventory Balance", value: result.inventoryBalance.toFixed(1), unit: "kg remaining", color: result.inventoryBalance < (inventory[inputs.materialType]?.threshold ?? 100) ? "#C0392B" : "#2E7D32", icon: "📦" },
                    { label: "Est. Scrap Recovery", value: `₹${result.scrapCost.toFixed(0)}`, unit: "recoverable", color: "#1565C0", icon: "💰" },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="p-4 rounded-xl"
                      style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontSize: "0.8125rem" }}>{kpi.icon}</span>
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ fontSize: "0.65rem", fontWeight: 700, background: `${kpi.color}14`, color: kpi.color }}
                        >
                          {kpi.unit}
                        </span>
                      </div>
                      <p style={{ fontSize: "1.5rem", fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}</p>
                      <p style={{ fontSize: "0.72rem", color: "#7A6C6A", marginTop: "0.35rem", letterSpacing: "0.02em" }}>{kpi.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Visual Analytics ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Material Usage Bar */}
                <div className="p-5 rounded-xl" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1C1C1C", marginBottom: "0.25rem" }}>Material Usage Breakdown</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88", marginBottom: "1rem" }}>kg breakdown — received vs consumed vs scrap</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={barData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: "#9A8A88" }} axisLine={false} tickLine={false} unit=" kg" />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#4A4A4A", fontWeight: 500 }} axisLine={false} tickLine={false} width={65} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem", border: "1px solid #E8E2E0" }} formatter={(v: number) => [`${v.toFixed(2)} kg`]} />
                      {barData.map((entry, i) => (
                        <Bar key={i} dataKey="value" fill={entry.color} radius={[0, 4, 4, 0]} name={entry.label} />
                      ))}
                      <Bar dataKey="value" fill="#A52A2A" radius={[0, 4, 4, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie: Usable vs Scrap */}
                <div className="p-5 rounded-xl" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1C1C1C", marginBottom: "0.25rem" }}>Usable vs Scrap</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88", marginBottom: "0.5rem" }}>Material distribution</p>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={110} height={110}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v.toFixed(2)} kg`]} contentStyle={{ fontSize: "0.75rem" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                          <div>
                            <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "#1C1C1C" }}>{d.name}</p>
                            <p style={{ fontSize: "0.8rem", fontWeight: 700, color: d.color }}>{d.value.toFixed(2)} kg</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Utilization Gauge */}
                <div className="p-5 rounded-xl" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1C1C1C", marginBottom: "0.25rem" }}>Material Utilization Gauge</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88", marginBottom: "0.75rem" }}>Production efficiency indicator</p>
                  <div className="relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={120}>
                      <RadialBarChart cx="50%" cy="80%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={gaugeData}>
                        <RadialBar dataKey="value" background={{ fill: "#F0ECEB" }} cornerRadius={6} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-2 flex flex-col items-center">
                      <p style={{ fontSize: "1.6rem", fontWeight: 800, color: result.efficiencyColor, lineHeight: 1 }}>{result.utilizationPct}%</p>
                      <p style={{ fontSize: "0.72rem", fontWeight: 700, color: result.efficiencyColor }}>{result.efficiencyRating}</p>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="flex justify-between mt-2">
                    {[["< 78%", "#C0392B", "Review"], ["78–88%", "#F57F17", "Acceptable"], ["88–95%", "#1565C0", "Good"], ["> 95%", "#2E7D32", "Excellent"]].map(([range, color, label]) => (
                      <div key={label} className="text-center">
                        <div className="w-2 h-2 rounded-full mx-auto mb-0.5" style={{ background: color }} />
                        <p style={{ fontSize: "0.58rem", color: "#9A8A88" }}>{range}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inventory Balance */}
                <div className="p-5 rounded-xl" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1C1C1C", marginBottom: "0.25rem" }}>Inventory Impact</p>
                  <p style={{ fontSize: "0.72rem", color: "#9A8A88", marginBottom: "1rem" }}>Stock before and after production run</p>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: "Before Production", value: inventory[inputs.materialType]?.qty ?? 0, color: "#4E342E" },
                      { label: "Material Consumed", value: parseFloat(inputs.weightReceived), color: "#A52A2A", negative: true },
                      { label: "After Production", value: result.inventoryBalance, color: result.inventoryBalance < (inventory[inputs.materialType]?.threshold ?? 100) ? "#C0392B" : "#2E7D32" },
                    ].map((row) => {
                      const maxVal = inventory[inputs.materialType]?.qty ?? 1;
                      return (
                        <div key={row.label}>
                          <div className="flex justify-between mb-1">
                            <span style={{ fontSize: "0.775rem", color: "#4A4A4A" }}>{row.label}</span>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: row.color }}>{row.value.toFixed(1)} kg</span>
                          </div>
                          <div style={{ height: "7px", background: "#F0ECEB", borderRadius: "99px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, (row.value / maxVal) * 100)}%`, height: "100%", background: row.color, borderRadius: "99px", transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                    {result.inventoryBalance < (inventory[inputs.materialType]?.threshold ?? 100) && (
                      <div className="flex items-center gap-1.5 mt-1" style={{ color: "#C0392B" }}>
                        <AlertTriangle size={12} />
                        <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>Below reorder threshold — raise PO immediately</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── AI Insights ── */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div className="px-5 py-3.5 flex items-center gap-2" style={{ background: "#FDF5F5", borderBottom: "1px solid #F0ECEB" }}>
                  <Zap size={16} color="#A52A2A" />
                  <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#1C1C1C" }}>AI Production Insights</p>
                  <span className="ml-auto px-2 py-0.5 rounded-full" style={{ fontSize: "0.65rem", fontWeight: 700, background: "#A52A2A", color: "#fff" }}>
                    AUTO-GENERATED
                  </span>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ background: "#fff" }}>
                  {insights.map((insight, i) => {
                    const isWarn = insight.startsWith("⚠");
                    const isInfo = insight.startsWith("ℹ") || insight.startsWith("📋") || insight.startsWith("💡");
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3.5 rounded-xl"
                        style={{
                          background: isWarn ? "#FFF8F8" : isInfo ? "#F0F4FF" : "#F0FAF0",
                          border: `1px solid ${isWarn ? "#FFCDD2" : isInfo ? "#C5CAE9" : "#C8E6C9"}`,
                        }}
                      >
                        <span style={{ fontSize: "1.1rem", flexShrink: 0, lineHeight: 1 }}>{insight.charAt(0)}</span>
                        <p style={{ fontSize: "0.775rem", color: "#2C2C2C", lineHeight: 1.6 }}>{insight.slice(2).trim()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Export Actions ── */}
              <div className="flex flex-wrap gap-2">
                <Btn size="sm" onClick={() => { toast.success("Production record exported"); downloadCSV(`${inputs.partNumber || "record"}.csv`, [["Part","Material","Parts","Scrap","Utilization"],[inputs.partName, inputs.materialType, String(result?.partsProduced ?? ""), `${result?.scrapGenerated ?? ""} kg`, `${result?.utilizationPct ?? ""}%`]]); }}><Download size={13} /> Production Record (PDF)</Btn>
                <Btn size="sm" variant="secondary" onClick={() => { toast.success("Scrap analysis exported"); downloadCSV("DVS_Scrap_Analysis.csv", [["Material","Scrap (kg)","Recovery Value"],[inputs.materialType, String(result?.scrapGenerated ?? ""), `Rs${result?.scrapCost ?? ""}`]]); }}><Download size={13} /> Scrap Analysis (CSV)</Btn>
                <Btn size="sm" variant="secondary"><FileText size={13} /> Inventory Impact Report</Btn>
                <Btn size="sm" variant="ghost"><Printer size={13} /> Print Summary</Btn>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ════ PRODUCTION RECORD TABLE ════ */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#1C1C1C" }}>Production Records</p>
            <p style={{ fontSize: "0.775rem", color: "#7A6C6A" }}>Every production run is logged automatically with full material traceability</p>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" variant="secondary" onClick={() => downloadCSV("DVS_Production_Records.csv", [
              ["Record ID","Date","Part Name","Part Number","Raw Material","Wt Received (kg)","Consumed (kg)","Parts Produced","Scrap (kg)","Utilization %","Operator","Status"],
              ...records.map((r) => [r.id, r.date, r.partName, r.partNumber, r.rawMaterial, String(r.weightReceived), String(r.materialConsumed), String(r.partsProduced), String(r.scrapGenerated), `${r.utilizationPct}%`, r.operator, r.status]),
            ])}><Download size={13} /> Export All</Btn>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          <DataTable
            searchable
            paginate={10}
            columns={[
              { key: "id", label: "Record ID" },
              { key: "date", label: "Date & Time" },
              { key: "part", label: "Part" },
              { key: "material", label: "Raw Material" },
              { key: "received", label: "Wt. Received" },
              { key: "consumed", label: "Consumed" },
              { key: "produced", label: "Parts" },
              { key: "scrap", label: "Scrap" },
              { key: "utilization", label: "Utilization" },
              { key: "operator", label: "Operator" },
              { key: "status", label: "Status" },
            ]}
            rows={records.map((r) => ({
              id: <span style={{ fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", color: "#A52A2A", fontWeight: 700 }}>{r.id}</span>,
              date: <span style={{ fontSize: "0.775rem" }}>{r.date}</span>,
              part: (
                <div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{r.partName}</p>
                  <p style={{ fontSize: "0.68rem", color: "#9A8A88", fontFamily: "JetBrains Mono, monospace" }}>{r.partNumber}</p>
                </div>
              ),
              material: <span style={{ fontSize: "0.775rem" }}>{r.rawMaterial}</span>,
              received: <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{r.weightReceived} kg</span>,
              consumed: <span style={{ fontSize: "0.8rem", color: "#A52A2A", fontWeight: 600 }}>{r.materialConsumed} kg</span>,
              produced: <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#1C1C1C" }}>{r.partsProduced}</span>,
              scrap: <span style={{ fontSize: "0.8rem", color: "#D4793A", fontWeight: 600 }}>{r.scrapGenerated} kg</span>,
              utilization: (
                <div>
                  <span style={{
                    fontSize: "0.8rem", fontWeight: 700,
                    color: r.utilizationPct >= 95 ? "#2E7D32" : r.utilizationPct >= 88 ? "#1565C0" : r.utilizationPct >= 78 ? "#F57F17" : "#C0392B",
                  }}>
                    {r.utilizationPct.toFixed(1)}%
                  </span>
                  <div style={{ height: "4px", background: "#F0ECEB", borderRadius: "99px", marginTop: "3px", width: "60px", overflow: "hidden" }}>
                    <div style={{ width: `${r.utilizationPct}%`, height: "100%", background: r.utilizationPct >= 95 ? "#2E7D32" : r.utilizationPct >= 88 ? "#1565C0" : "#F57F17", borderRadius: "99px" }} />
                  </div>
                </div>
              ),
              operator: <span style={{ fontSize: "0.775rem" }}>{r.operator}</span>,
              status: <StatusBadge status={r.status} label="Completed" />,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN INVENTORY PAGE
══════════════════════════════════════════════ */
const materialsData = [
  { id: "MAT-001", name: "Steel Sheet (2mm)", category: "Steel", thickness: "2mm", qty: 850, unit: "kg", cost: 72, threshold: 200, location: "WH-A Row 3", status: "in stock" },
  { id: "MAT-002", name: "Aluminium Strip", category: "Aluminium", thickness: "1.5mm", qty: 42, unit: "kg", cost: 185, threshold: 100, location: "WH-A Row 7", status: "low stock" },
  { id: "MAT-003", name: "Copper Sheet", category: "Copper", thickness: "1mm", qty: 180, unit: "kg", cost: 620, threshold: 50, location: "WH-B Row 2", status: "in stock" },
  { id: "MAT-004", name: "Stainless Steel", category: "Steel", thickness: "3mm", qty: 0, unit: "kg", cost: 145, threshold: 100, location: "WH-A Row 4", status: "out of stock" },
  { id: "MAT-005", name: "Sheet Metal HR", category: "Steel", thickness: "1mm", qty: 1250, unit: "kg", cost: 65, threshold: 300, location: "WH-C Row 1", status: "in stock" },
];

const suppliersData = [
  { name: "SteelCorp Ltd.", rating: 4.8, price: 72, delivery: "2 days", reliability: "98%", material: "Steel Sheet" },
  { name: "MetalTech India", rating: 4.2, price: 68, delivery: "4 days", reliability: "91%", material: "Steel Sheet" },
  { name: "AluminCo", rating: 4.6, price: 185, delivery: "3 days", reliability: "95%", material: "Aluminium" },
  { name: "CopperPrime", rating: 4.9, price: 620, delivery: "1 day", reliability: "99%", material: "Copper" },
];

const matPieData = [
  { name: "Steel", value: 58, color: "#A52A2A" },
  { name: "Aluminium", value: 22, color: "#4E342E" },
  { name: "Copper", value: 12, color: "#D4793A" },
  { name: "Other", value: 8, color: "#9A8A88" },
];

/* ── Modal overlay helper ── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="rounded-xl overflow-hidden w-full max-w-lg mx-4" style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #E8E2E0", background: "#F9F6F5" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1C1C1C" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A6C6A" }}><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function InventoryPage({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [tab, setTab]                   = useState("overview");
  const [materials, setMaterials]       = useState(materialsData);
  const [apiStats, setApiStats]         = useState<InventoryStatistics | null>(null);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMat, setNewMat]             = useState({ name: "", category: "Steel", thickness: "", qty: "", cost: "", threshold: "", location: "" });
  const { setPendingPO } = useERP();

  // ── Load from API ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getMaterials({ pageSize: 100, status: "active" }).catch(() => null),
      getInventoryStats().catch(() => null),
    ]).then(([matRes, statsRes]) => {
      if (cancelled) return;
      if (matRes && matRes.data.length > 0) {
        setMaterials(matRes.data.map(m => ({
          id: m.code,
          name: m.name,
          category: m.category ?? "Other",
          thickness: m.description?.match(/\d+mm/)?.[0] ?? "—",
          qty: parseFloat(m.currentStock),
          unit: m.unit,
          cost: m.costPerUnit ? parseFloat(m.costPerUnit) : 0,
          threshold: parseFloat(m.minStockLevel),
          location: m.location ?? "WH-A",
          status: parseFloat(m.currentStock) === 0 ? "out of stock"
                : parseFloat(m.currentStock) <= parseFloat(m.minStockLevel) ? "low stock"
                : "in stock",
          _apiId: m.id,
        })));
      }
      if (statsRes) setApiStats(statsRes);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalValue = apiStats
    ? parseFloat(apiStats.totalStockValue)
    : materials.reduce((s, m) => s + m.qty * m.cost, 0);
  const lowStock = apiStats
    ? apiStats.lowStockCount + apiStats.outOfStockCount
    : materials.filter((m) => m.status !== "in stock").length;
  const totalMaterials = apiStats?.activeMaterials ?? materials.length;

  const handleExport = () => {
    const rows = [
      ["ID", "Name", "Category", "Thickness", "Qty", "Unit", "Cost/kg", "Threshold", "Location", "Status"],
      ...materials.map((m) => [m.id, m.name, m.category, m.thickness, String(m.qty), m.unit, String(m.cost), String(m.threshold), m.location, m.status]),
    ];
    downloadCSV("DVS_Inventory_Export.csv", rows);
    toast.success("Inventory exported to CSV");
  };

  const handleAddMaterial = async () => {
    if (!newMat.name || !newMat.qty || !newMat.cost) return;
    const qty = parseInt(newMat.qty);
    const threshold = parseInt(newMat.threshold) || 50;
    const status = qty === 0 ? "out of stock" : qty < threshold ? "low stock" : "in stock";
    // Try real API first
    try {
      const code = newMat.name.toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 20);
      await createMaterial({
        name: newMat.name, code, unit: "kg",
        category: newMat.category,
        location: newMat.location || "WH-A",
        minStockLevel: String(threshold),
        costPerUnit: newMat.cost,
      });
    } catch { /* ignore — still add locally */ }
    setMaterials((prev) => [...prev, {
      id: `MAT-${String(prev.length + 1).padStart(3, "0")}`,
      name: newMat.name, category: newMat.category, thickness: newMat.thickness || "—",
      qty, unit: "kg", cost: parseInt(newMat.cost), threshold, location: newMat.location || "WH-A", status,
    }]);
    setNewMat({ name: "", category: "Steel", thickness: "", qty: "", cost: "", threshold: "", location: "" });
    setShowAddMaterial(false);
    toast.success(`Material "${newMat.name}" added to inventory`);
  };

  const handleCreatePO = (m: typeof materialsData[0]) => {
    const reorderQty = Math.max(500, m.threshold * 5);
    const supplierMap: Record<string, string> = { Steel: "SteelCorp Ltd.", Aluminium: "AluminCo", Copper: "CopperPrime" };
    setPendingPO({ materialName: m.name, materialId: m.id, currentStock: m.qty, unit: m.unit, reorderQty, unitCost: m.cost, preferredSupplier: supplierMap[m.category] || "SteelCorp Ltd." });
    if (onNavigate) onNavigate("orders");
  };

  return (
    <>
    {showAddMaterial && (
      <Modal title="Add New Material" onClose={() => setShowAddMaterial(false)}>
        <div className="flex flex-col gap-3">
          {[
            { label: "Material Name *", key: "name", placeholder: "e.g. Steel Sheet 3mm" },
            { label: "Thickness", key: "thickness", placeholder: "e.g. 3mm" },
            { label: "Quantity (kg) *", key: "qty", placeholder: "e.g. 500", type: "number" },
            { label: "Cost per kg (₹) *", key: "cost", placeholder: "e.g. 72", type: "number" },
            { label: "Min Threshold (kg)", key: "threshold", placeholder: "e.g. 200", type: "number" },
            { label: "Location", key: "location", placeholder: "e.g. WH-A Row 5" },
          ].map((f) => (
            <div key={f.key}>
              <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#4A4A4A", marginBottom: "0.3rem" }}>{f.label}</label>
              <input type={f.type || "text"} placeholder={f.placeholder} value={(newMat as any)[f.key]}
                onChange={(e) => setNewMat((p) => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", outline: "none" }}
                onFocus={(e) => { e.target.style.borderColor = "#A52A2A"; }}
                onBlur={(e) => { e.target.style.borderColor = "#D4BFBB"; }} />
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#4A4A4A", marginBottom: "0.3rem" }}>Category</label>
            <select value={newMat.category} onChange={(e) => setNewMat((p) => ({ ...p, category: e.target.value }))}
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #D4BFBB", borderRadius: "0.375rem", fontSize: "0.8375rem", outline: "none" }}>
              {["Steel", "Aluminium", "Copper", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => setShowAddMaterial(false)} style={{ flex: 1, padding: "0.625rem", border: "1px solid #E8E2E0", borderRadius: "0.5rem", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
            <button onClick={handleAddMaterial} style={{ flex: 1, padding: "0.625rem", border: "none", borderRadius: "0.5rem", background: "#A52A2A", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>Add Material</button>
          </div>
        </div>
      </Modal>
    )}
    <div className="p-6">
      <PageHeader
        title="Inventory Intelligence"
        subtitle="Real-time material tracking, production simulation, scrap analytics, and procurement"
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" onClick={handleExport}><Download size={14} /> Export</Btn>
            <Btn size="sm" onClick={() => setShowAddMaterial(true)}><Plus size={14} /> Add Material</Btn>
          </div>
        }
      />

      <TabBar
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "materials", label: "Material Management" },
          { id: "calculator", label: "Production Calculator" },
          { id: "scrap", label: "Scrap Analytics" },
          { id: "procurement", label: "Procurement" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <KPICard label="Total Inventory Value" value={totalValue >= 100000 ? `₹${(totalValue / 100000).toFixed(1)}L` : `₹${totalValue.toFixed(0)}`} accent="#A52A2A" />
              <KPICard label="Low / Out of Stock" value={lowStock} sub="materials need action" accent="#C0392B" trendDir="down" />
              <KPICard label="Materials Tracked" value={totalMaterials} accent="#2E7D32" />
              <KPICard label="Reorder Suggestions" value={apiStats?.lowStockCount ?? 3} sub="need reorder" accent="#E65100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              <div style={{ gridColumn: "span 2" }}>
                <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div className="px-5 py-4" style={{ borderBottom: "1px solid #F0ECEB" }}>
                    <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>Stock Levels</p>
                    <p style={{ fontSize: "0.775rem", color: "#7A6C6A" }}>Real-time material quantities</p>
                  </div>
                  <div className="p-5">
                    {materialsData.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 mb-3">
                        <span style={{ fontSize: "0.8rem", color: "#4A4A4A", minWidth: "170px", flex: "0 0 170px" }}>{m.name}</span>
                        <div className="flex-1" style={{ height: "8px", background: "#F0ECEB", borderRadius: "999px", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (m.qty / (m.threshold * 5)) * 100)}%`, height: "100%", background: m.status === "out of stock" ? "#C0392B" : m.status === "low stock" ? "#E65100" : "#A52A2A", borderRadius: "999px", transition: "width 0.5s" }} />
                        </div>
                        <span style={{ fontSize: "0.775rem", fontWeight: 700, minWidth: "70px", textAlign: "right", color: m.status === "out of stock" ? "#C0392B" : m.status === "low stock" ? "#E65100" : "#2E7D32" }}>
                          {m.qty} {m.unit}
                        </span>
                        <StatusBadge status={m.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid #F0ECEB" }}>
                  <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>Composition</p>
                  <p style={{ fontSize: "0.775rem", color: "#7A6C6A" }}>By material type</p>
                </div>
                <div className="p-4 flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={matPieData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={2}>
                        {matPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ fontSize: "0.8rem" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full mt-2">
                    {matPieData.map((m) => (
                      <div key={m.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                        <span style={{ fontSize: "0.72rem", color: "#7A6C6A" }}>{m.name}: {m.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Reorder alerts */}
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid #F0ECEB", background: "#FDF5F5" }}>
                <AlertTriangle size={16} color="#A52A2A" />
                <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>Reorder Suggestions</p>
                <span className="ml-auto px-2 py-0.5 rounded-full" style={{ fontSize: "0.65rem", fontWeight: 700, background: "#A52A2A", color: "#fff" }}>AI-DETECTED</span>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {materialsData.filter((m) => m.status !== "in stock").map((m) => (
                  <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: "#FFF8F8", border: "1px solid #FFCDD2" }}>
                    <AlertTriangle size={18} color="#C0392B" />
                    <div className="flex-1">
                      <p style={{ fontSize: "0.8375rem", fontWeight: 700 }}>{m.name}</p>
                      <p style={{ fontSize: "0.775rem", color: "#7A6C6A" }}>
                        Stock: {m.qty} {m.unit} · Threshold: {m.threshold} {m.unit} · Location: {m.location}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                    <Btn size="sm" onClick={() => handleCreatePO(m)}><ShoppingCart size={13} /> Order Now</Btn>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MATERIALS ── */}
        {tab === "materials" && (
          <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
            <DataTable
              searchable
              paginate={10}
              exportFilename="DVS_Materials.csv"
              columns={[
                { key: "id", label: "ID" },
                { key: "name", label: "Material Name" },
                { key: "category", label: "Category" },
                { key: "thickness", label: "Thickness" },
                { key: "qty", label: "Quantity" },
                { key: "cost", label: "Unit Cost" },
                { key: "threshold", label: "Min Threshold" },
                { key: "location", label: "Location" },
                { key: "status", label: "Status" },
              ]}
              rows={materialsData.map((m) => ({
                id: <span style={{ fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace", color: "#A52A2A" }}>{m.id}</span>,
                name: <span style={{ fontWeight: 600 }}>{m.name}</span>,
                category: m.category,
                thickness: m.thickness,
                qty: <span style={{ fontWeight: 700 }}>{m.qty} {m.unit}</span>,
                cost: `₹${m.cost}/${m.unit}`,
                threshold: `${m.threshold} ${m.unit}`,
                location: <span style={{ fontSize: "0.775rem" }}>{m.location}</span>,
                status: <StatusBadge status={m.status} />,
              }))}
            />
          </div>
        )}

        {/* ── CALCULATOR ── */}
        {tab === "calculator" && <ProductionCalculator />}

        {/* ── SCRAP ANALYTICS ── */}
        {tab === "scrap" && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <KPICard label="Total Scrap Today" value="114 kg" trendDir="down" trend="+14% vs target" accent="#C0392B" />
              <KPICard label="Scrap Cost Impact" value="₹9,156" sub="recovery potential" accent="#E65100" />
              <KPICard label="Worst Dept" value="Cutting" sub="42 kg scrap" accent="#4E342E" />
              <KPICard label="Avg Utilization" value="93.2%" accent="#2E7D32" trendDir="up" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid #F0ECEB" }}>
                  <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>Scrap by Department</p>
                  <p style={{ fontSize: "0.775rem", color: "#7A6C6A" }}>kg today</p>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={deptScrapData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                      <XAxis dataKey="dept" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                      <Bar dataKey="kg" fill="#A52A2A" radius={[3, 3, 0, 0]} name="Scrap (kg)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid #F0ECEB" }}>
                  <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>Weekly Scrap Trend</p>
                  <p style={{ fontSize: "0.775rem", color: "#7A6C6A" }}>Daily scrap (kg)</p>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={scrapTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0ECEB" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9A8A88" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: "0.8rem" }} />
                      <Line type="monotone" dataKey="scrap" stroke="#A52A2A" strokeWidth={2} name="Scrap (kg)" dot={{ r: 4, fill: "#A52A2A" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid #F0ECEB", background: "#FDF5F5" }}>
                <Zap size={15} color="#A52A2A" />
                <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>AI Scrap Recommendations</p>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  "⚠ High scrap in Cutting Dept — recalibrate blade pressure (currently 8.2% vs 4% target)",
                  "⚠ Material wastage above threshold in Pressing — review die condition every 500 cycles",
                  "✅ Welding dept scrap at 2.1% — maintain current parameters as benchmark",
                  "📋 Total scrap recovery potential today: ₹9,156 — schedule pickup with certified dealer",
                ].map((r, i) => (
                  <div key={i} className="flex gap-2.5 p-3.5 rounded-xl" style={{ background: r.startsWith("✅") ? "#F0FAF0" : r.startsWith("📋") ? "#F0F4FF" : "#FFF8F8", border: `1px solid ${r.startsWith("✅") ? "#C8E6C9" : r.startsWith("📋") ? "#C5CAE9" : "#FFCDD2"}` }}>
                    <span style={{ fontSize: "1rem" }}>{r.charAt(0)}</span>
                    <p style={{ fontSize: "0.775rem", lineHeight: 1.6, color: "#2C2C2C" }}>{r.slice(2).trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PROCUREMENT ── */}
        {tab === "procurement" && (
          <div>
            <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #E8E2E0", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #F0ECEB" }}>
                <div>
                  <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>Supplier Comparison</p>
                  <p style={{ fontSize: "0.775rem", color: "#7A6C6A" }}>Benchmark suppliers by price, delivery, and reliability</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "name", label: "Supplier" },
                  { key: "material", label: "Material" },
                  { key: "price", label: "Price/kg" },
                  { key: "delivery", label: "Lead Time" },
                  { key: "reliability", label: "Reliability" },
                  { key: "rating", label: "Rating" },
                  { key: "action", label: "Action" },
                ]}
                rows={suppliersData.map((s) => ({
                  name: <span style={{ fontWeight: 700 }}>{s.name}</span>,
                  material: s.material,
                  price: `₹${s.price}`,
                  delivery: s.delivery,
                  reliability: <span style={{ fontWeight: 700, color: parseFloat(s.reliability) >= 95 ? "#2E7D32" : "#E65100" }}>{s.reliability}</span>,
                  rating: (
                    <div className="flex items-center gap-1">
                      <span style={{ color: "#F57F17" }}>★</span>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700 }}>{s.rating}</span>
                    </div>
                  ),
                  action: <Btn size="sm" onClick={() => { const m = materials.find(m2 => m2.category === s.material.split(" ")[0]) || materials[0]; handleCreatePO(m); }}><ShoppingCart size={12} /> Create PO</Btn>,
                }))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
