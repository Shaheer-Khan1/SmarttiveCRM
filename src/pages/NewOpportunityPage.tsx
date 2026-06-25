import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, UserPlus, X } from "lucide-react";
import { getCustomers, getUsers, createOpportunity, type Customer, type UserProfile } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { CURRENCIES } from "@/lib/utils";

export default function NewOpportunityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", customerId: searchParams.get("customerId") || "",
    solution: "", value: "", currency: "SAR",
    nextStep: "", notes: "",
    assignedTo: [] as { id: string; name: string }[],
    tags: [] as string[],
  });

  useEffect(() => {
    getCustomers().then(setCustomers);
    getUsers().then(setUsers);
  }, []);

  const toggleAssignee = (u: UserProfile) => {
    setForm((f) => {
      const already = f.assignedTo.some((a) => a.id === u.id);
      return {
        ...f,
        assignedTo: already
          ? f.assignedTo.filter((a) => a.id !== u.id)
          : [...f.assignedTo, { id: u.id, name: u.name }],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const customer = customers.find((c) => c.id === form.customerId);
      const id = await createOpportunity({
        title: form.title,
        customerId: form.customerId,
        customerName: customer?.name || "",
        status: "ACTIVE",
        solution: form.solution,
        value: form.value ? parseFloat(form.value) : null,
        currency: form.currency,
        assignedTo: form.assignedTo,
        initiatedById: user?.uid || "",
        initiatedByName: profile?.name || "",
        nextStep: form.nextStep,
        notes: form.notes,
        tags: form.tags,
        lastActivityDate: null,
      });
      navigate(`/opportunities/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/opportunities" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Opportunity</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Opportunity Title *</label>
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. PSIM + OrcaTwin Solution"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Customer *</label>
          <select required value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">Select customer...</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Solution / Product</label>
          <input value={form.solution} onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
            placeholder="e.g. Video Compression, Parking System"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Estimated Value</label>
            <input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Currency</label>
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Multi-assign */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-2 block flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Assigned To (Smarttive)
          </label>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => {
              const selected = form.assignedTo.some((a) => a.id === u.id);
              return (
                <button key={u.id} type="button" onClick={() => toggleAssignee(u)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}>
                  {selected && <X className="w-3 h-3" />}
                  {u.name}
                </button>
              );
            })}
          </div>
          {form.assignedTo.length > 0 && (
            <p className="text-xs text-blue-600 mt-1.5">{form.assignedTo.map((a) => a.name).join(", ")} assigned</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Next Step</label>
          <input value={form.nextStep} onChange={(e) => setForm((f) => ({ ...f, nextStep: e.target.value }))}
            placeholder="What needs to happen next?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Notes</label>
          <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/opportunities" className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</Link>
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Creating..." : "Create Opportunity"}
          </button>
        </div>
      </form>
    </div>
  );
}
