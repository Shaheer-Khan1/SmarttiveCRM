import { X } from "lucide-react";
import { REGIONS, PIPELINE_STAGE_LABELS, countriesForRegion } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/lib/crm";
import type { Opportunity, UserProfile } from "@/lib/firestore";

export interface GlobalFilters {
  query: string;
  country: string;
  region: string;
  peopleId: string;
  stage: string;
  tag: string;
  product: string;
  dateFrom: string;
  dateTo: string;
  standalone?: boolean | null;
}

export const emptyFilters = (): GlobalFilters => ({
  query: "",
  country: "",
  region: "",
  peopleId: "",
  stage: "",
  tag: "",
  product: "",
  dateFrom: "",
  dateTo: "",
  standalone: null,
});

export function opportunityMatchesFilters(
  opp: Opportunity,
  filters: GlobalFilters,
  productNames?: string[],
): boolean {
  const q = filters.query.trim().toLowerCase();
  if (q && !opp.title.toLowerCase().includes(q)) return false;
  if (filters.country && opp.country !== filters.country) return false;
  if (filters.region && opp.region !== filters.region) return false;
  if (filters.stage && opp.stage !== filters.stage) return false;
  if (filters.tag && !opp.tags.includes(filters.tag)) return false;
  if (filters.peopleId && opp.owner?.id !== filters.peopleId && opp.coOwner?.id !== filters.peopleId) return false;
  if (filters.product) {
    const names = productNames?.length
      ? productNames
      : (opp.solution || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.includes(filters.product)) return false;
  }
  if (filters.dateFrom && opp.closeDate && opp.closeDate < new Date(`${filters.dateFrom}T00:00:00`)) return false;
  if (filters.dateTo && opp.closeDate && opp.closeDate > new Date(`${filters.dateTo}T23:59:59`)) return false;
  return true;
}

interface Props {
  value: GlobalFilters;
  onChange: (next: GlobalFilters) => void;
  users?: UserProfile[];
  tags?: string[];
  products?: string[];
  showStage?: boolean;
  showStandalone?: boolean;
  showName?: boolean;
}

export default function FilterBar({
  value, onChange, users = [], tags = [], products = [], showStage = true, showStandalone = false, showName = true,
}: Props) {
  const set = <K extends keyof GlobalFilters>(key: K, v: GlobalFilters[K]) =>
    onChange({ ...value, [key]: v });

  const countryOptions = countriesForRegion(value.region, value.country || undefined);

  const chips: { key: keyof GlobalFilters; label: string }[] = [];
  if (value.query) chips.push({ key: "query", label: `Name: ${value.query}` });
  if (value.country) chips.push({ key: "country", label: `Country: ${value.country}` });
  if (value.region) chips.push({ key: "region", label: `Region: ${value.region}` });
  if (value.peopleId) {
    const u = users.find((x) => x.id === value.peopleId);
    chips.push({ key: "peopleId", label: `People: ${u?.name || value.peopleId}` });
  }
  if (value.stage) chips.push({ key: "stage", label: `Stage: ${PIPELINE_STAGE_LABELS[value.stage] || value.stage}` });
  if (value.tag) chips.push({ key: "tag", label: `Tag: ${value.tag}` });
  if (value.product) chips.push({ key: "product", label: `Product: ${value.product}` });
  if (value.dateFrom) chips.push({ key: "dateFrom", label: `From: ${value.dateFrom}` });
  if (value.dateTo) chips.push({ key: "dateTo", label: `To: ${value.dateTo}` });
  if (value.standalone === true) chips.push({ key: "standalone", label: "Standalone only" });

  const clearChip = (key: keyof GlobalFilters) => {
    if (key === "standalone") set("standalone", null);
    else set(key, "" as never);
  };

  return (
    <div className="panel p-3 sm:p-4 space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {showName && (
          <Field label="Opportunity name">
            <input
              value={value.query}
              onChange={(e) => set("query", e.target.value)}
              placeholder="Search by name"
              className={selectCls}
            />
          </Field>
        )}
        <Field label="Country">
          <select value={value.country} onChange={(e) => set("country", e.target.value)} className={selectCls}>
            <option value="">All</option>
            {countryOptions.map((c) => (
              <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <select
            value={value.region}
            onChange={(e) => {
              const region = e.target.value;
              const stillValid = !value.country || countriesForRegion(region).some((c) => c.name === value.country);
              onChange({ ...value, region, country: stillValid ? value.country : "" });
            }}
            className={selectCls}
          >
            <option value="">All</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="People">
          <select value={value.peopleId} onChange={(e) => set("peopleId", e.target.value)} className={selectCls}>
            <option value="">All</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        {showStage && (
          <Field label="Stage / Status">
            <select value={value.stage} onChange={(e) => set("stage", e.target.value)} className={selectCls}>
              <option value="">All</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Product">
          <select value={value.product} onChange={(e) => set("product", e.target.value)} className={selectCls}>
            <option value="">All</option>
            {products.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Tags">
          <select value={value.tag} onChange={(e) => set("tag", e.target.value)} className={selectCls}>
            <option value="">All</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Date from">
          <input type="date" value={value.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} className={selectCls} />
        </Field>
        <Field label="Date to">
          <input type="date" value={value.dateTo} onChange={(e) => set("dateTo", e.target.value)} className={selectCls} />
        </Field>
        {showStandalone && (
          <Field label="Type">
            <select
              value={value.standalone === true ? "standalone" : value.standalone === false ? "linked" : ""}
              onChange={(e) => {
                const v = e.target.value;
                set("standalone", v === "standalone" ? true : v === "linked" ? false : null);
              }}
              className={selectCls}
            >
              <option value="">All notes</option>
              <option value="standalone">Standalone</option>
              <option value="linked">Opportunity-linked</option>
            </select>
          </Field>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button key={String(c.key) + c.label} type="button" onClick={() => clearChip(c.key)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {c.label} <X className="w-3 h-3" />
          </button>
        ))}
        {chips.length > 0 && (
          <button type="button" onClick={() => onChange(emptyFilters())}
            className="text-xs font-medium text-red-600 hover:text-red-700 ml-1">
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}

const selectCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{label}</label>
      {children}
    </div>
  );
}
