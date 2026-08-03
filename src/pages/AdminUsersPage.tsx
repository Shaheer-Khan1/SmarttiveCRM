import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, createSecondaryAuth, disposeSecondaryApp } from "@/lib/firebase";
import {
  getUsers, updateUserProfile, deleteUserProfile, seedDemoData, deleteDemoData,
  type UserProfile, type UserRole, type DemoDeletionResult,
} from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Edit2, Shield, Eye, UserX, Code } from "lucide-react";

const ROLE_STYLES: Record<UserRole, { badge: string; icon: typeof Shield }> = {
  ADMIN: { badge: "bg-purple-50 text-purple-700 border-purple-200", icon: Shield },
  MANAGER: { badge: "bg-gray-50 text-gray-600 border-gray-200", icon: Eye },
  DEVELOPER: { badge: "bg-teal-50 text-teal-700 border-teal-200", icon: Code },
};

export default function AdminUsersPage() {
  const { isAdmin, user, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DemoDeletionResult | null>(null);

  const load = () => { void getUsers().then(setUsers); };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aPending = a.role ? 1 : 0;
      const bPending = b.role ? 1 : 0;
      if (aPending !== bPending) return aPending - bPending;
      return a.name.localeCompare(b.name);
    });
  }, [users]);

  const pendingCount = users.filter((u) => !u.role).length;

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const handleDelete = async (u: UserProfile) => {
    if (u.id === user?.uid) return alert("Cannot delete your own account.");
    if (!confirm(`Delete user ${u.name}?`)) return;
    await deleteUserProfile(u.id);
    load();
  };

  const assignRole = async (u: UserProfile, role: UserRole) => {
    await updateUserProfile(u.id, { role });
    load();
  };

  const handleSeed = async () => {
    if (!confirm("This will add demo customers, opportunities, and activities. Continue?")) return;
    setSeeding(true);
    await seedDemoData(user!.uid, profile?.name || "Admin");
    setSeeded(true);
    setDeleteResult(null);
    setSeeding(false);
  };

  const handleDeleteDemo = async () => {
    if (!confirm("This will permanently delete all demo data. Continue?")) return;
    setDeleting(true);
    try {
      const result = await deleteDemoData();
      setDeleteResult(result);
      setSeeded(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">
            {users.length} users
            {pendingCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· {pendingCount} awaiting role</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {!seeded && (
            <button onClick={handleSeed} disabled={seeding}
              className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50">
              {seeding ? "Seeding..." : "Load Demo Data"}
            </button>
          )}
          <button onClick={handleDeleteDemo} disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
            {deleting ? "Deleting..." : "Delete Demo Data"}
          </button>
          <button onClick={() => { setEditUser(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          Google sign-ups appear here with no role. Assign Admin or Manager so they can access the CRM.
        </div>
      )}

      {seeded && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          Demo data loaded. Refresh related pages to see it.
        </div>
      )}
      {deleteResult && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          Demo data deleted: {deleteResult.customers} customers, {deleteResult.opportunities} opportunities,{" "}
          {deleteResult.activities} activities removed.
        </div>
      )}

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedUsers.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 ${!u.role ? "bg-amber-50/40" : ""}`}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {(u.name || "?").charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-gray-900">{u.name}</span>
                    {u.id === user?.uid && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">You</span>}
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">{u.email}</td>
                <td className="px-5 py-4">
                  {!u.role ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                        <UserX className="w-3 h-3" /> Unassigned
                      </span>
                      <button type="button" onClick={() => assignRole(u, "DEVELOPER")}
                        className="text-xs px-2 py-1 rounded-lg bg-teal-600 text-white hover:bg-teal-700">Developer</button>
                      <button type="button" onClick={() => assignRole(u, "MANAGER")}
                        className="text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700">Manager</button>
                      <button type="button" onClick={() => assignRole(u, "ADMIN")}
                        className="text-xs px-2 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700">Admin</button>
                    </div>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ROLE_STYLES[u.role].badge}`}>
                      {(() => { const Icon = ROLE_STYLES[u.role].icon; return <Icon className="w-3 h-3" />; })()}
                      {u.role}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => { setEditUser(u); setShowModal(true); }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(u)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: {
  user: UserProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    role: (user?.role || "MANAGER") as UserRole,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (user) {
        await updateUserProfile(user.id, { name: form.name, role: form.role });
      } else {
        const { app: secondaryApp, auth: secondaryAuth } = createSecondaryAuth();
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
          await setDoc(doc(db, "users", cred.user.uid), {
            name: form.name,
            email: form.email,
            role: form.role,
            createdAt: serverTimestamp(),
          });
        } finally {
          await disposeSecondaryApp(secondaryApp);
        }
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold">{user ? "Edit User" : "Add User"}</h2>
          {!user && (
            <p className="text-xs text-gray-500 mt-1">Creates an Auth account and a Firestore profile with the selected role.</p>
          )}
          {user && !user.role && (
            <p className="text-xs text-amber-600 mt-1">This user signed up with Google and needs a role assigned.</p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Full Name *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {!user && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">Password *</label>
                <input required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { r: "ADMIN" as const, active: "border-purple-500 bg-purple-50 text-purple-700", Icon: Shield },
                { r: "MANAGER" as const, active: "border-blue-500 bg-blue-50 text-blue-700", Icon: Eye },
                { r: "DEVELOPER" as const, active: "border-teal-500 bg-teal-50 text-teal-700", Icon: Code },
              ]).map(({ r, active, Icon }) => (
                <button key={r} type="button" onClick={() => setForm((f) => ({ ...f, role: r }))}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${form.role === r ? active : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <Icon className="w-4 h-4" /> {r}
                </button>
              ))}
            </div>
            {form.role === "DEVELOPER" && (
              <p className="text-xs text-teal-700 mt-2">
                Can create opportunities, meeting notes, calendar events, and research. Can edit only their own records. Cannot delete. Cannot be Owner/Co-Owner.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : user ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
