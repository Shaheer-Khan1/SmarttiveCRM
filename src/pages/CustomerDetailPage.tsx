import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Building2, Globe, Phone, Mail, Edit2, Trash2, Plus } from "lucide-react";
import { getCustomer, updateCustomer, deleteCustomer, getOpportunities, type Customer, type Opportunity } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import OpportunityCard from "@/components/OpportunityCard";
import { canCreateCrmRecords } from "@/lib/permissions";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, profile } = useAuth();
  const canCreate = canCreateCrmRecords(profile);
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});

  const load = async () => {
    const [c, o] = await Promise.all([
      getCustomer(id!),
      getOpportunities({ customerId: id }),
    ]);
    setCustomer(c);
    setOpps(o);
    setEditForm(c || {});
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    await updateCustomer(id!, editForm);
    setEditing(false);
    load();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this customer?")) return;
    await deleteCustomer(id!);
    navigate("/customers");
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!customer) return <div className="text-center py-16 text-gray-500">Customer not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/customers")} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          {customer.industry && <p className="text-gray-500 text-sm">{customer.industry}</p>}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {customer.contact && <Detail icon={<Building2 className="w-4 h-4" />} label="Contact" value={customer.contact} />}
          {customer.email && <Detail icon={<Mail className="w-4 h-4" />} label="Email" value={customer.email} />}
          {customer.phone && <Detail icon={<Phone className="w-4 h-4" />} label="Phone" value={customer.phone} />}
          {(customer.city || customer.country) && (
            <Detail icon={<Globe className="w-4 h-4" />} label="Location" value={[customer.city, customer.country].filter(Boolean).join(", ")} />
          )}
        </div>
        {customer.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{customer.notes}</p>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">
            Opportunities
            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{opps.length}</span>
          </h2>
          {canCreate && (
            <Link to={`/opportunities/new?customerId=${id}`}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus className="w-4 h-4" /> Add Opportunity
            </Link>
          )}
        </div>
        {opps.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-200">
            <p className="text-sm">No opportunities yet</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {opps.map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Edit Customer</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "name", label: "Company Name", col: 2 },
                  { key: "industry", label: "Industry" }, { key: "country", label: "Country" },
                  { key: "city", label: "City" }, { key: "contact", label: "Contact" },
                  { key: "email", label: "Email" }, { key: "phone", label: "Phone" },
                ].map(({ key, label, col }) => (
                  <div key={key} className={col === 2 ? "col-span-2" : ""}>
                    <label className="text-xs font-medium text-gray-700 mb-1.5 block">{label}</label>
                    <input value={(editForm as Record<string, string>)[key] || ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">Notes</label>
                  <textarea rows={2} value={editForm.notes || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div><p className="text-xs text-gray-500">{label}</p><p className="text-gray-900">{value}</p></div>
    </div>
  );
}
