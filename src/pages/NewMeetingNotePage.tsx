import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";
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
  const [externalInput, setExternalInput] = useState("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    quickNotes: "",
    meetingDate: "",
    nextSteps: "",
    opportunityId: params.get("opportunityId") || "",
    country: "Saudi Arabia",
    attendeeIds: [] as string[],
    externalAttendees: [] as string[],
    inviteIds: [] as string[],
  });

  useEffect(() => {
    getOpportunities().then(setOpps);
    getUsers().then(setUsers);
  }, []);

  if (!canCreateCrmRecords(profile)) {
    return <Navigate to="/meeting-notes" replace />;
  }

  const addExternal = () => {
    const name = externalInput.trim();
    if (!name) return;
    if (form.externalAttendees.some((x) => x.toLowerCase() === name.toLowerCase())) {
      setExternalInput("");
      return;
    }
    setForm((f) => ({ ...f, externalAttendees: [...f.externalAttendees, name] }));
    setExternalInput("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !user || !profile) return;
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
        quickNotes: form.quickNotes.trim(),
        isDraft: false,
        meetingDate: form.meetingDate ? new Date(form.meetingDate) : null,
        nextSteps: form.nextSteps,
        opportunityId: form.opportunityId || null,
        opportunityTitle: opp?.title || null,
        country: form.country || opp?.country || null,
        attendees,
        externalAttendees: form.externalAttendees,
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
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Quick Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea rows={2} value={form.quickNotes} onChange={(e) => setForm((f) => ({ ...f, quickNotes: e.target.value }))}
            placeholder="Short capture / bullet points…"
            className={inputCls + " resize-none"} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Full Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className={inputCls + " resize-none"} />
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
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">Internal Attendees</label>
          <p className="text-[11px] text-gray-400 mb-2">Select from CRM users</p>
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
          <label className="text-xs font-medium text-gray-700 mb-1.5 block">External Attendees</label>
          <p className="text-[11px] text-gray-400 mb-2">Type a name and press Add or Enter</p>
          <div className="flex gap-2">
            <input value={externalInput} onChange={(e) => setExternalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExternal(); } }}
              placeholder="e.g. John Smith, Acme Corp"
              className={inputCls} />
            <button type="button" onClick={addExternal}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {form.externalAttendees.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {form.externalAttendees.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-teal-50 text-teal-800 border border-teal-200">
                  {name}
                  <button type="button" onClick={() => setForm((f) => ({
                    ...f,
                    externalAttendees: f.externalAttendees.filter((x) => x !== name),
                  }))} className="hover:text-teal-950">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
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
