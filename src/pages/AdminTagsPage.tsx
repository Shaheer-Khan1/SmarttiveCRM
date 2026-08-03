import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { GitMerge, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getTags, renameTag, mergeTags, cleanupDuplicateTags, type CrmTag,
} from "@/lib/crm";

export default function AdminTagsPage() {
  const { isAdmin } = useAuth();
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => getTags().then(setTags).finally(() => setLoading(false));
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const handleRename = async (t: CrmTag) => {
    const next = prompt("Rename tag", t.name);
    if (!next || next.trim() === t.name) return;
    setBusy(true);
    try {
      await renameTag(t.id, next.trim());
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    if (!confirm("Merge source into target? Source tag will be deleted.")) return;
    setBusy(true);
    try {
      await mergeTags(mergeSource, mergeTarget);
      setMergeSource("");
      setMergeTarget("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("Merge duplicate tags (case-insensitive)?")) return;
    setBusy(true);
    try {
      const n = await cleanupDuplicateTags();
      alert(`Merged ${n} duplicate tag(s).`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tag Management</h1>
          <p className="text-sm text-gray-500 mt-1">Rename, merge, and clean up opportunity tags</p>
        </div>
        <button onClick={handleCleanup} disabled={busy}
          className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50">
          Cleanup Duplicates
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><GitMerge className="w-4 h-4" /> Merge Tags</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Source (removed)</label>
            <select value={mergeSource} onChange={(e) => setMergeSource(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Select…</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Target (kept)</label>
            <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Select…</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button onClick={handleMerge} disabled={busy || !mergeSource || !mergeTarget}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">Merge</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tags.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500">{t.usageCount}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleRename(t)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Rename">
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
              {tags.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">No tags yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
