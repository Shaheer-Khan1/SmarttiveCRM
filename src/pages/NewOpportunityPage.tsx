import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getCustomers, getUsers, createOpportunity, type Customer, type UserProfile, type OpportunityStage } from "@/lib/firestore";
import {
  getCatalogProducts, setOpportunityProducts, syncOpportunityTags, logOpportunityEvent,
  PIPELINE_STAGES, type CatalogProduct,
} from "@/lib/crm";
import { useAuth } from "@/context/AuthContext";
import { COUNTRIES, REGIONS, CURRENCIES, PIPELINE_STAGE_LABELS } from "@/lib/utils";
import TagAutocomplete from "@/components/TagAutocomplete";
import { canCreateCrmRecords, ownerEligibleUsers } from "@/lib/permissions";

interface SelectedProduct {
  productId: string;
  productName: string;
  color: string;
  requiresPoc: boolean;
}

export default function NewOpportunityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const me = user && profile ? { id: user.uid, name: profile.name } : null;

  const [form, setForm] = useState({
    title: "",
    customerId: searchParams.get("customerId") || "",
    country: "Saudi Arabia",
    region: "GCC",
    stage: "LEAD" as OpportunityStage,
    value: "",
    currency: "SAR",
    closeDate: "",
    notes: "",
    tags: [] as string[],
    ownerId: "",
    coOwnerId: "",
    products: [] as SelectedProduct[],
  });

  useEffect(() => {
    getCustomers().then(setCustomers);
    getUsers().then((u) => {
      setUsers(u);
      const eligible = ownerEligibleUsers(u);
      setForm((f) => {
        if (f.ownerId) return f;
        // Owner must be Admin/Manager — developers pick one, sales roles default to self when eligible
        const defaultOwner =
          (me && eligible.some((x) => x.id === me.id) ? me.id : null)
          || eligible[0]?.id
          || "";
        return { ...f, ownerId: defaultOwner };
      });
    });
    getCatalogProducts({ activeOnly: true }).then(setCatalog);
  }, []);

  const salesUsers = ownerEligibleUsers(users);

  if (!canCreateCrmRecords(profile)) {
    return <Navigate to="/opportunities" replace />;
  }

  const toggleProduct = (p: CatalogProduct) => {
    setForm((f) => {
      const exists = f.products.find((x) => x.productId === p.id);
      if (exists) return { ...f, products: f.products.filter((x) => x.productId !== p.id) };
      return {
        ...f,
        products: [...f.products, { productId: p.id, productName: p.name, color: p.color, requiresPoc: false }],
      };
    });
  };

  const setRequiresPoc = (productId: string, requiresPoc: boolean) => {
    setForm((f) => ({
      ...f,
      products: f.products.map((p) => (p.productId === productId ? { ...p, requiresPoc } : p)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Opportunity name is required");
    if (!form.country.trim()) return setError("Country is required");
    if (!form.customerId) return setError("Customer is required");

    const ownerUser = salesUsers.find((u) => u.id === form.ownerId);
    if (!ownerUser) return setError("Owner is required and must be an Admin or Manager");

    const coOwnerUser = form.coOwnerId ? salesUsers.find((u) => u.id === form.coOwnerId) : null;
    if (form.coOwnerId && !coOwnerUser) {
      return setError("Co-Owner must be an Admin or Manager");
    }

    setSaving(true);
    try {
      const customer = customers.find((c) => c.id === form.customerId);
      const owner = { id: ownerUser.id, name: ownerUser.name };
      const coOwner = coOwnerUser ? { id: coOwnerUser.id, name: coOwnerUser.name } : null;
      const id = await createOpportunity({
        title: form.title.trim(),
        customerId: form.customerId,
        customerName: customer?.name || "",
        stage: form.stage,
        country: form.country,
        region: form.region || null,
        closeDate: form.closeDate ? new Date(form.closeDate) : null,
        value: form.value ? parseFloat(form.value) : null,
        currency: form.currency,
        notes: form.notes,
        tags: form.tags,
        owner,
        coOwner,
        nextStep: "",
        solution: form.products.map((p) => p.productName).join(", "),
        initiatedById: user?.uid || "",
        initiatedByName: profile?.name || "",
        lastActivityDate: null,
      });

      if (form.products.length) {
        await setOpportunityProducts(id, form.products.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          color: p.color,
          requiresPoc: p.requiresPoc,
          pocStatus: "NOT_STARTED" as const,
        })));
      }
      await syncOpportunityTags([], form.tags);
      await logOpportunityEvent(id, {
        type: "CREATED",
        message: `Opportunity created in ${PIPELINE_STAGE_LABELS[form.stage]}`,
        actorId: user?.uid || "",
        actorName: profile?.name || "User",
      });
      navigate(`/opportunities/${id}`);
    } catch (err) {
      setError((err as Error).message || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/opportunities" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Opportunity</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <Field label="Opportunity Name *">
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={inputCls} placeholder="e.g. Campus Security Platform" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Country *">
            <select required value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={inputCls + " bg-white"}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Region">
            <select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className={inputCls + " bg-white"}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Customer *">
          <select required value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))} className={inputCls + " bg-white"}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Stage">
            <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as OpportunityStage }))} className={inputCls + " bg-white"}>
              {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>)}
            </select>
          </Field>
          <Field label="Close Date">
            <input type="date" value={form.closeDate} onChange={(e) => setForm((f) => ({ ...f, closeDate: e.target.value }))} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Owner * (Admin / Manager)">
            <select
              required
              value={form.ownerId}
              onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))}
              className={inputCls + " bg-white"}
            >
              <option value="">Select owner…</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </Field>
          <Field label="Co-Owner (optional)">
            <select value={form.coOwnerId} onChange={(e) => setForm((f) => ({ ...f, coOwnerId: e.target.value }))} className={inputCls + " bg-white"}>
              <option value="">None</option>
              {salesUsers.filter((u) => u.id !== form.ownerId).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </Field>
        </div>
        {salesUsers.length === 0 && (
          <p className="text-xs text-amber-600">No Admin/Manager users available to assign as Owner.</p>
        )}

        <Field label="Products (optional)">
          {catalog.length === 0 ? (
            <p className="text-xs text-amber-600">No active catalog products. Admin can add them under Admin → Products.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {catalog.map((p) => {
                  const selected = form.products.some((x) => x.productId === p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggleProduct(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${selected ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200"}`}
                      style={selected ? { background: p.color } : undefined}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
              {form.products.map((p) => (
                <label key={p.productId} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={p.requiresPoc} onChange={(e) => setRequiresPoc(p.productId, e.target.checked)} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                  {p.productName} — Requires PoC
                </label>
              ))}
            </div>
          )}
        </Field>

        <Field label="Tags">
          <TagAutocomplete value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Expected Value">
            <input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={inputCls + " bg-white"}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls + " resize-none"} />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/opportunities" className="px-4 py-2 text-sm text-gray-600">Cancel</Link>
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creating…" : "Create Opportunity"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
