import { useEffect, useState } from "react";
import { Plus, Search, Store, Globe, Mail, Edit2, Trash2, Package, X } from "lucide-react";
import {
  getVendors, createVendor, updateVendor, deleteVendor, getProducts,
  type Vendor, type Product,
} from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";

export default function VendorsPage() {
  const { isAdmin } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getVendors(), getProducts()])
      .then(([v, p]) => { setVendors(v); setProducts(p); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const countFor = (vendorId: string) => products.filter((p) => p.vendorId === vendorId).length;

  const filtered = vendors.filter((v) =>
    [v.name, v.website, v.supportEmail, v.contactInfo].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = async (v: Vendor) => {
    if (countFor(v.id) > 0) return alert("Cannot delete a vendor that still has products associated.");
    if (!confirm(`Delete vendor ${v.name}?`)) return;
    await deleteVendor(v.id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} vendors</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditVendor(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No vendors found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Store className="w-5 h-5 text-indigo-600" />
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditVendor(v); setShowModal(true); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(v)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-gray-900">{v.name}</h3>
              <div className="mt-2 space-y-1">
                {v.website && <p className="text-xs text-gray-500 flex items-center gap-1 truncate"><Globe className="w-3 h-3 flex-shrink-0" /> {v.website}</p>}
                {v.supportEmail && <p className="text-xs text-gray-500 flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" /> {v.supportEmail}</p>}
                <p className="text-xs text-gray-500 flex items-center gap-1"><Package className="w-3 h-3" /> {countFor(v.id)} product(s)</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <VendorModal vendor={editVendor} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
}

function VendorModal({ vendor, onClose, onSaved }: { vendor: Vendor | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: vendor?.name || "", website: vendor?.website || "",
    contactInfo: vendor?.contactInfo || "", supportEmail: vendor?.supportEmail || "", notes: vendor?.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (vendor) await updateVendor(vendor.id, form);
      else await createVendor(form);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{vendor ? "Edit Vendor" : "Add Vendor"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { key: "name", label: "Vendor Name", required: true },
            { key: "website", label: "Website" },
            { key: "supportEmail", label: "Support Email", type: "email" },
            { key: "contactInfo", label: "Contact Info" },
          ].map(({ key, label, required, type }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">{label}{required && " *"}</label>
              <input type={type || "text"} required={required} value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
