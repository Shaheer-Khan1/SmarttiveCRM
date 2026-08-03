import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Code, Cpu, Plus, Trash2, AlertTriangle, ArrowRight } from "lucide-react";
import {
  getVendors, getUsers, getProducts, createVendor, createProduct, createNotification,
  type Vendor, type UserProfile, type Product, type ProductType, type ProductPriority,
  type MaturityLevel, type EvaluationScore, type CompatibilityEntry, type CompatibilityStatus,
} from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { PRODUCT_PRIORITIES, MATURITY_LEVELS, COMPATIBILITY_STATUSES, getCompatibilityLabel } from "@/lib/utils";
import { canCreateCrmRecords } from "@/lib/permissions";

const linesToArray = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function NewProductPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "SOFTWARE" as ProductType, category: "", vendorId: "", version: "", website: "",
    maturityLevel: "L1" as MaturityLevel,
    documentationLinks: "", features: "", specifications: "", integrationComplexity: "",
    supportedApis: "", dependencies: "", compatibility: "",
    licenseType: "", pricing: "", supportInfo: "", subscriptionDetails: "",
    pros: "", cons: "", risks: "", limitations: "", comparisonNotes: "",
    developmentStatus: "", integrationStatus: "", assignedDeveloperId: "", reviewerId: "",
    priority: "MEDIUM" as ProductPriority, notes: "",
  });
  const [scores, setScores] = useState<EvaluationScore[]>([]);
  const [matrix, setMatrix] = useState<CompatibilityEntry[]>([]);
  const [newVendorName, setNewVendorName] = useState("");

  useEffect(() => {
    getVendors().then(setVendors);
    getUsers().then(setUsers);
    getProducts().then(setAllProducts);
  }, []);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  // Intake duplicate detection
  const duplicates = useMemo(() => {
    const q = form.name.trim().toLowerCase();
    if (q.length < 3) return [];
    return allProducts
      .filter((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()))
      .slice(0, 4);
  }, [form.name, allProducts]);

  if (!canCreateCrmRecords(profile)) {
    return <Navigate to="/products" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let vendorId = form.vendorId;
      let vendorName: string | null = vendors.find((v) => v.id === form.vendorId)?.name || null;
      if (form.vendorId === "__new__" && newVendorName.trim()) {
        vendorId = await createVendor({ name: newVendorName.trim() });
        vendorName = newVendorName.trim();
      }
      const dev = users.find((u) => u.id === form.assignedDeveloperId);
      const reviewer = users.find((u) => u.id === form.reviewerId);

      const id = await createProduct({
        name: form.name,
        type: form.type,
        category: form.category,
        vendorId: vendorId && vendorId !== "__new__" ? vendorId : null,
        vendorName,
        version: form.version,
        website: form.website,
        documentationLinks: linesToArray(form.documentationLinks),
        features: linesToArray(form.features),
        specifications: linesToArray(form.specifications),
        integrationComplexity: form.integrationComplexity,
        supportedApis: linesToArray(form.supportedApis),
        dependencies: linesToArray(form.dependencies),
        compatibility: form.compatibility,
        licenseType: form.licenseType,
        pricing: form.pricing,
        supportInfo: form.supportInfo,
        subscriptionDetails: form.subscriptionDetails,
        pros: linesToArray(form.pros),
        cons: linesToArray(form.cons),
        risks: linesToArray(form.risks),
        limitations: linesToArray(form.limitations),
        comparisonNotes: form.comparisonNotes,
        developmentStatus: form.developmentStatus,
        integrationStatus: form.integrationStatus,
        assignedDeveloperId: form.assignedDeveloperId || null,
        assignedDeveloperName: dev?.name || null,
        reviewerId: form.reviewerId || null,
        reviewerName: reviewer?.name || null,
        priority: form.priority,
        notes: form.notes,
        status: "RESEARCH_STARTED",
        maturityLevel: form.maturityLevel,
        scores: scores.filter((s) => s.criterion.trim()),
        compatibilityMatrix: matrix.filter((m) => m.item.trim()),
        createdById: user?.uid || "",
        createdByName: profile?.name || "User",
      });

      const recipients = [form.assignedDeveloperId, form.reviewerId].filter(Boolean) as string[];
      if (recipients.length > 0) {
        await createNotification(recipients, `You were assigned to research "${form.name}"`, undefined, `/products/${id}`);
      }
      navigate(`/products/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/products" className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><ArrowLeft className="w-4 h-4 text-gray-600" /></Link>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">New Research</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* General */}
        <Section title="General Information">
          <Field label="Product Name *" full>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="e.g. Genetec Security Center" />
          </Field>

          {duplicates.length > 0 && (
            <div className="col-span-2 -mt-1 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" /> Possible existing records — join instead of duplicating?
              </p>
              <div className="mt-2 space-y-1">
                {duplicates.map((p) => (
                  <Link key={p.id} to={`/products/${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-xs text-gray-700 hover:text-blue-600 hover:shadow-sm transition-all">
                    <span className="truncate">{p.name}{p.vendorName ? ` · ${p.vendorName}` : ""}</span>
                    <span className="flex items-center gap-1 text-blue-600 flex-shrink-0">Open <ArrowRight className="w-3 h-3" /></span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Field label="Type *">
            <div className="grid grid-cols-2 gap-2">
              {(["SOFTWARE", "HARDWARE"] as const).map((t) => (
                <button key={t} type="button" onClick={() => set("type", t)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.type === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {t === "SOFTWARE" ? <Code className="w-4 h-4" /> : <Cpu className="w-4 h-4" />} {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Research Maturity">
            <select value={form.maturityLevel} onChange={(e) => set("maturityLevel", e.target.value)} className={inputCls + " bg-white"}>
              {MATURITY_LEVELS.map((m) => <option key={m.value} value={m.value}>{m.value} · {m.label}</option>)}
            </select>
          </Field>
          <Field label="Category"><input value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls} placeholder="e.g. VMS, Access Control" /></Field>
          <Field label="Vendor">
            <select value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)} className={inputCls + " bg-white"}>
              <option value="">None</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value="__new__">+ New vendor…</option>
            </select>
            {form.vendorId === "__new__" && (
              <input value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} placeholder="New vendor name" className={inputCls + " mt-2"} />
            )}
          </Field>
          <Field label="Version"><input value={form.version} onChange={(e) => set("version", e.target.value)} className={inputCls} /></Field>
          <Field label="Website"><input value={form.website} onChange={(e) => set("website", e.target.value)} className={inputCls} placeholder="https://" /></Field>
          <Field label="Documentation Links (one per line)" full><textarea rows={2} value={form.documentationLinks} onChange={(e) => set("documentationLinks", e.target.value)} className={textareaCls} /></Field>
        </Section>

        {/* Technical */}
        <Section title="Technical Information">
          <Field label="Features (one per line)" full><textarea rows={3} value={form.features} onChange={(e) => set("features", e.target.value)} className={textareaCls} /></Field>
          <Field label="Specifications (one per line)" full><textarea rows={3} value={form.specifications} onChange={(e) => set("specifications", e.target.value)} className={textareaCls} /></Field>
          <Field label="Integration Complexity"><input value={form.integrationComplexity} onChange={(e) => set("integrationComplexity", e.target.value)} className={inputCls} placeholder="Low / Medium / High" /></Field>
          <Field label="Compatibility (summary)"><input value={form.compatibility} onChange={(e) => set("compatibility", e.target.value)} className={inputCls} /></Field>
          <Field label="Supported APIs (one per line)" full><textarea rows={2} value={form.supportedApis} onChange={(e) => set("supportedApis", e.target.value)} className={textareaCls} /></Field>
          <Field label="Dependencies (one per line)" full><textarea rows={2} value={form.dependencies} onChange={(e) => set("dependencies", e.target.value)} className={textareaCls} /></Field>
        </Section>

        {/* Compatibility Matrix */}
        <Section title="Technical Compatibility Matrix" single>
          <CompatibilityEditor matrix={matrix} setMatrix={setMatrix} />
        </Section>

        {/* Commercial */}
        <Section title="Commercial Information">
          <Field label="Licensing Model"><input value={form.licenseType} onChange={(e) => set("licenseType", e.target.value)} className={inputCls} placeholder="Perpetual / Subscription" /></Field>
          <Field label="Pricing"><input value={form.pricing} onChange={(e) => set("pricing", e.target.value)} className={inputCls} /></Field>
          <Field label="Support Availability"><input value={form.supportInfo} onChange={(e) => set("supportInfo", e.target.value)} className={inputCls} /></Field>
          <Field label="Subscription Details"><input value={form.subscriptionDetails} onChange={(e) => set("subscriptionDetails", e.target.value)} className={inputCls} /></Field>
        </Section>

        {/* Evaluation */}
        <Section title="Evaluation Information">
          <Field label="Pros (one per line)"><textarea rows={3} value={form.pros} onChange={(e) => set("pros", e.target.value)} className={textareaCls} /></Field>
          <Field label="Cons (one per line)"><textarea rows={3} value={form.cons} onChange={(e) => set("cons", e.target.value)} className={textareaCls} /></Field>
          <Field label="Risks (one per line)"><textarea rows={2} value={form.risks} onChange={(e) => set("risks", e.target.value)} className={textareaCls} /></Field>
          <Field label="Limitations (one per line)"><textarea rows={2} value={form.limitations} onChange={(e) => set("limitations", e.target.value)} className={textareaCls} /></Field>
          <Field label="Comparison Notes" full><textarea rows={2} value={form.comparisonNotes} onChange={(e) => set("comparisonNotes", e.target.value)} className={textareaCls} /></Field>
        </Section>

        {/* Evaluation Scoring */}
        <Section title="Evaluation Scoring" single>
          <ScoreEditor scores={scores} setScores={setScores} />
        </Section>

        {/* Development */}
        <Section title="Development Information">
          <Field label="Development Status"><input value={form.developmentStatus} onChange={(e) => set("developmentStatus", e.target.value)} className={inputCls} /></Field>
          <Field label="Integration Status"><input value={form.integrationStatus} onChange={(e) => set("integrationStatus", e.target.value)} className={inputCls} /></Field>
          <Field label="Assigned Developer">
            <select value={form.assignedDeveloperId} onChange={(e) => set("assignedDeveloperId", e.target.value)} className={inputCls + " bg-white"}>
              <option value="">None</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Reviewer">
            <select value={form.reviewerId} onChange={(e) => set("reviewerId", e.target.value)} className={inputCls + " bg-white"}>
              <option value="">None</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={inputCls + " bg-white"}>
              {PRODUCT_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Notes" full><textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={textareaCls} /></Field>
        </Section>

        <div className="flex justify-end gap-3">
          <Link to="/products" className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? "Creating..." : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-shadow";
const textareaCls = inputCls + " resize-none";

function Section({ title, children, single }: { title: string; children: React.ReactNode; single?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      {single ? <div>{children}</div> : <div className="grid grid-cols-2 gap-4">{children}</div>}
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-700 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

export function ScoreEditor({ scores, setScores }: { scores: EvaluationScore[]; setScores: (s: EvaluationScore[]) => void }) {
  const update = (i: number, patch: Partial<EvaluationScore>) =>
    setScores(scores.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => setScores(scores.filter((_, idx) => idx !== i));
  const add = () => setScores([...scores, { criterion: "", weight: 3, score: 3 }]);

  return (
    <div className="space-y-2">
      {scores.length > 0 && (
        <div className="grid grid-cols-12 gap-2 text-[11px] font-medium text-gray-400 px-1">
          <span className="col-span-6">Criterion</span>
          <span className="col-span-3">Weight (1–5)</span>
          <span className="col-span-2">Score (0–5)</span>
          <span className="col-span-1" />
        </div>
      )}
      {scores.map((s, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input value={s.criterion} onChange={(e) => update(i, { criterion: e.target.value })} placeholder="e.g. Feature fit"
            className={"col-span-6 " + inputCls} />
          <input type="number" min={1} max={5} value={s.weight} onChange={(e) => update(i, { weight: Number(e.target.value) })} className={"col-span-3 " + inputCls} />
          <input type="number" min={0} max={5} value={s.score} onChange={(e) => update(i, { score: Number(e.target.value) })} className={"col-span-2 " + inputCls} />
          <button type="button" onClick={() => remove(i)} className="col-span-1 flex justify-center text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 mt-1">
        <Plus className="w-3.5 h-3.5" /> Add criterion
      </button>
    </div>
  );
}

export function CompatibilityEditor({ matrix, setMatrix }: { matrix: CompatibilityEntry[]; setMatrix: (m: CompatibilityEntry[]) => void }) {
  const update = (i: number, patch: Partial<CompatibilityEntry>) =>
    setMatrix(matrix.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i: number) => setMatrix(matrix.filter((_, idx) => idx !== i));
  const add = () => setMatrix([...matrix, { item: "", status: "UNKNOWN", notes: "" }]);

  return (
    <div className="space-y-2">
      {matrix.map((m, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input value={m.item} onChange={(e) => update(i, { item: e.target.value })} placeholder="e.g. Windows Server 2022"
            className={"col-span-4 " + inputCls} />
          <select value={m.status} onChange={(e) => update(i, { status: e.target.value as CompatibilityStatus })} className={"col-span-3 bg-white " + inputCls}>
            {COMPATIBILITY_STATUSES.map((s) => <option key={s} value={s}>{getCompatibilityLabel(s)}</option>)}
          </select>
          <input value={m.notes || ""} onChange={(e) => update(i, { notes: e.target.value })} placeholder="Notes (optional)"
            className={"col-span-4 " + inputCls} />
          <button type="button" onClick={() => remove(i)} className="col-span-1 flex justify-center text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 mt-1">
        <Plus className="w-3.5 h-3.5" /> Add compatibility entry
      </button>
    </div>
  );
}
