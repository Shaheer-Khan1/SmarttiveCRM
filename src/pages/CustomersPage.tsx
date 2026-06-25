import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Building2, Globe, Phone, ChevronRight } from "lucide-react";
import { getCustomers, createCustomer, type Customer } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";

export default function CustomersPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = () => getCustomers().then(setCustomers).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) =>
    [c.name, c.industry, c.country, c.city].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} customers</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No customers found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} onClick={() => navigate(`/customers/${c.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{c.name}</h3>
              <div className="mt-2 space-y-1">
                {c.industry && <p className="text-xs text-gray-500">{c.industry}</p>}
                {(c.city || c.country) && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {[c.city, c.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {c.contact && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {c.contact}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CustomerModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function CustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", industry: "", country: "", city: "", contact: "", email: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await createCustomer(form);
    onSaved();
  };

  const fields = [
    { key: "name", label: "Company Name", required: true, col: 2 },
    { key: "industry", label: "Industry" },
    { key: "country", label: "Country" },
    { key: "city", label: "City" },
    { key: "contact", label: "Primary Contact" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Add Customer</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {fields.map(({ key, label, required, col, type }) => (
              <div key={key} className={col === 2 ? "col-span-2" : ""}>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">{label}{required && " *"}</label>
                <input type={type || "text"} required={required}
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
