import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword, deleteUser as deleteFirebaseUser,
  signInWithEmailAndPassword, signOut as fbSignOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getUsers, updateUserProfile, deleteUserProfile, type UserProfile } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Edit2, Shield, Eye } from "lucide-react";
import { seedDemoData, deleteDemoData, type DemoDeletionResult } from "@/lib/firestore";

export default function AdminUsersPage() {
  const { isAdmin, user, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DemoDeletionResult | null>(null);

  const load = () => getUsers().then(setUsers).finally(() => setLoading(false));
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const handleDelete = async (u: UserProfile) => {
    if (u.id === user?.uid) return alert("Cannot delete your own account.");
    if (!confirm(`Delete user ${u.name}?`)) return;
    await deleteUserProfile(u.id);
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
    if (!confirm("This will permanently delete all demo data (KFUPM, Saudi Aramco, Ministry of Communications and their opportunities & activities). Continue?")) return;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} users</p>
        </div>
        <div className="flex gap-2">
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

      {seeded && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          Demo data loaded — customers, opportunities, activities, calendar events, vendors and products. Refresh to see it.
        </div>
      )}
      {deleteResult && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          Demo data deleted: {deleteResult.customers} customers, {deleteResult.opportunities} opportunities,{" "}
          {deleteResult.activities} activities, {deleteResult.products} products, {deleteResult.vendors} vendors,{" "}
          {deleteResult.events} calendar events removed.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                      {u.name.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-900">{u.name}</span>
                    {u.id === user?.uid && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">You</span>}
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">{u.email}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${u.role === "ADMIN" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {u.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {u.role}
                  </span>
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
          currentUserUid={user?.uid || ""}
          currentUserPassword=""
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSaved, currentUserUid, currentUserPassword }: {
  user: UserProfile | null;
  onClose: () => void;
  onSaved: () => void;
  currentUserUid: string;
  currentUserPassword: string;
}) {
  const { user: currentAuthUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", password: "", role: user?.role || "MANAGER" as "ADMIN" | "MANAGER" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (user) {
        // Update existing
        await updateUserProfile(user.id, { name: form.name, role: form.role });
      } else {
        // Create new user using Firebase Auth
        // We need a secondary auth instance or admin SDK.
        // For now we create the user and immediately restore session.
        const savedEmail = currentAuthUser?.email || "";
        const savedPwd = ""; // we can't get this

        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await setDoc(doc(db, "users", cred.user.uid), {
          name: form.name,
          email: form.email,
          role: form.role,
          createdAt: serverTimestamp(),
        });

        // Sign out new user and sign back in as original admin
        await fbSignOut(auth);
        // Note: Admin needs to re-login. Show a message.
        alert(`User ${form.name} created. You have been signed out. Please sign back in.`);
        window.location.href = "/login";
        return;
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
            <p className="text-xs text-amber-600 mt-1">Note: Creating a user will sign you out temporarily.</p>
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
            <div className="grid grid-cols-2 gap-2">
              {(["ADMIN", "MANAGER"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setForm((f) => ({ ...f, role: r }))}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${form.role === r ? (r === "ADMIN" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-blue-500 bg-blue-50 text-blue-700") : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {r === "ADMIN" ? <Shield className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {r}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {form.role === "ADMIN"
                ? "Admins can create, edit, delete records and change opportunity status."
                : "Managers can initiate opportunities and log activities on assigned deals."}
            </p>
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
