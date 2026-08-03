import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createMeetingNote, type NotePermission } from "@/lib/crm";
import { getOpportunities, getUsers, type Opportunity, type UserProfile } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { COUNTRIES } from "@/lib/utils";
import { canCreateCrmRecords } from "@/lib/permissions";

export default function NewMeetingNotePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, profile } = useAuth();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    meetingDate: "",
    nextSteps: "",
    opportunityId: params.get("opportunityId") || "",
    country: "Saudi Arabia",
    attendeeIds: [] as string[],
    inviteIds: [] as string[],
  });

  useEffect(() => {
    getOpportunities().then(setOpps);
    getUsers().then(setUsers);
  }, []);

  if (!canCreateCrmRecords(profile)) {
    return <Navigate to="/meeting-notes" replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim() || !user || !profile) return;
    setSaving(true);
    try {
      const opp = opps.find((o) => o.id === form.opportunityId);
      const attendees = users
        .filter((u) => form.attendeeIds.includes(u.id))
        .map((u) => ({ id: u.id, name: u.name }));
      const permissions: NotePermission[] = [
        { userId: user.uid, userName: profile.name, role: "CREATOR" },
        ...form.inviteIds
          .filter((id) => id !== user.uid)
          .map((id) => {
            const u = users.find((x) => x.id === id);
            return { userId: id, userName: u?.name || "", role: "COLLABORATOR" as const };
          }),
      ];
      const id = await createMeetingNote({
        title: form.title.trim(),
        body: form.body.trim(),
        meetingDate: form.meetingDate ? new Date(form.meetingDate) : null,
        nextSteps: form.nextSteps,
        opportunityId: form.opportunityId || null,
        opportunityTitle: opp?.title || null,
        country: form.country || opp?.country || null,
        attendees,
        createdById: user.uid,
        createdByName: profile.name,
        permissions,
      });
      navigate(`/meeting-notes/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/meeting-notes" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-2xl font-bold text-gray-900">New Meeting Note</h1>
      </div>
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Title *</label>
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Body *</label>
          <textarea required rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className={inputCls + " resize-none"} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Meeting Date</label>
            <input type="date" value={form.meetingDate} onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Country</label>
            <select value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={inputCls + " bg-white"}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Link Opportunity (optional)</label>
          <select value={form.opportunityId} onChange={(e) => setForm((f) => ({ ...f, opportunityId: e.target.value }))} className={inputCls + " bg-white"}>
            <option value="">Standalone note</option>
            {opps.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Attendees</label>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => {
              const on = form.attendeeIds.includes(u.id);
              return (
                <button key={u.id} type="button"
                  onClick={() => setForm((f) => ({
                    ...f,
                    attendeeIds: on ? f.attendeeIds.filter((x) => x !== u.id) : [...f.attendeeIds, u.id],
                  }))}
                  className={`px-2.5 py-1 rounded-full text-xs border ${on ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600"}`}>
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Invite collaborators</label>
          <div className="flex flex-wrap gap-2">
            {users.filter((u) => u.id !== user?.uid).map((u) => {
              const on = form.inviteIds.includes(u.id);
              return (
                <button key={u.id} type="button"
                  onClick={() => setForm((f) => ({
                    ...f,
                    inviteIds: on ? f.inviteIds.filter((x) => x !== u.id) : [...f.inviteIds, u.id],
                  }))}
                  className={`px-2.5 py-1 rounded-full text-xs border ${on ? "bg-slate-700 text-white border-slate-700" : "border-gray-200 text-gray-600"}`}>
                  {u.name}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Next Steps</label>
          <textarea rows={2} value={form.nextSteps} onChange={(e) => setForm((f) => ({ ...f, nextSteps: e.target.value }))} className={inputCls + " resize-none"} />
        </div>
        <div className="flex justify-end gap-2">
          <Link to="/meeting-notes" className="px-4 py-2 text-sm text-gray-600">Cancel</Link>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
            {saving ? "Saving…" : "Create Note"}
          </button>
        </div>
      </form>
    </div>
  );
}
