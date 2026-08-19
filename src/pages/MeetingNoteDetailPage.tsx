import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import {
  getMeetingNote, updateMeetingNote, deleteMeetingNote,
  type MeetingNote, type NotePermission,
} from "@/lib/crm";
import { getUsers, type UserProfile } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/utils";
import { canEditMeetingNoteRecord, canDeleteRecord } from "@/lib/permissions";

export default function MeetingNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [note, setNote] = useState<MeetingNote | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [editing, setEditing] = useState(false);
  const [externalInput, setExternalInput] = useState("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    quickNotes: "",
    nextSteps: "",
    meetingDate: "",
    attendeeIds: [] as string[],
    externalAttendees: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    const [n, u] = await Promise.all([getMeetingNote(id), getUsers()]);
    setNote(n);
    setUsers(u);
    if (n) {
      setForm({
        title: n.title,
        body: n.body,
        quickNotes: n.quickNotes || "",
        nextSteps: n.nextSteps || "",
        meetingDate: n.meetingDate ? new Date(n.meetingDate).toISOString().slice(0, 10) : "",
        attendeeIds: n.attendees.map((a) => a.id),
        externalAttendees: [...(n.externalAttendees || [])],
      });
      if (n.isDraft) setEditing(true);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (!note) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canEdit = canEditMeetingNoteRecord(note, profile, user?.uid);
  const canDelete = canDeleteRecord(profile, note.createdById, user?.uid);

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

  const save = async (markComplete = false) => {
    setSaving(true);
    try {
      const attendees = users
        .filter((u) => form.attendeeIds.includes(u.id))
        .map((u) => ({ id: u.id, name: u.name }));
      await updateMeetingNote(note.id, {
        title: form.title,
        body: form.body,
        quickNotes: form.quickNotes,
        nextSteps: form.nextSteps,
        meetingDate: form.meetingDate ? new Date(form.meetingDate) : null,
        attendees,
        externalAttendees: form.externalAttendees,
        isDraft: markComplete ? false : note.isDraft,
      });
      setEditing(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const invite = async (uid: string, role: NotePermission["role"]) => {
    const u = users.find((x) => x.id === uid);
    if (!u) return;
    const permissions = [
      ...note.permissions.filter((p) => p.userId !== uid),
      { userId: uid, userName: u.name, role },
    ];
    await updateMeetingNote(note.id, { permissions });
    load();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/meeting-notes" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{note.title}</h1>
              {note.isDraft && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">Draft</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {note.meetingDate ? formatDate(note.meetingDate) : "No meeting date"} · {note.createdByName}
              {note.opportunityId && (
                <> · <Link to={`/opportunities/${note.opportunityId}`} className="text-blue-600 hover:underline">{note.opportunityTitle}</Link></>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={() => setEditing((e) => !e)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {editing ? "Cancel" : "Edit"}
            </button>
          )}
          {canDelete && (
            <button
              onClick={async () => {
                if (!confirm("Delete note?")) return;
                await deleteMeetingNote(note.id);
                navigate("/meeting-notes");
              }}
              className="p-2 border border-red-200 text-red-600 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {note.isDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          This is a draft from a quick note. Fill in the remaining fields and save to complete it.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        {editing ? (
          <>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold" />
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Quick Notes</label>
              <textarea rows={2} value={form.quickNotes} onChange={(e) => setForm((f) => ({ ...f, quickNotes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Full Notes</label>
              <textarea rows={6} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <input type="date" value={form.meetingDate} onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <textarea rows={2} value={form.nextSteps} onChange={(e) => setForm((f) => ({ ...f, nextSteps: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Next steps" />

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Internal Attendees</label>
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
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">External Attendees</label>
              <div className="flex gap-2">
                <input value={externalInput} onChange={(e) => setExternalInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExternal(); } }}
                  placeholder="Add external name…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <button type="button" onClick={addExternal} className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.externalAttendees.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-teal-50 text-teal-800 border border-teal-200">
                    {name}
                    <button type="button" onClick={() => setForm((f) => ({
                      ...f,
                      externalAttendees: f.externalAttendees.filter((x) => x !== name),
                    }))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => save(false)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              {note.isDraft && (
                <button onClick={() => save(true)} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-50">
                  Mark complete
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {note.quickNotes && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Quick Notes</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.quickNotes}</p>
              </div>
            )}
            {note.body && (
              <div>
                {note.quickNotes && <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Full Notes</p>}
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.body}</p>
              </div>
            )}
            {!note.quickNotes && !note.body && (
              <p className="text-sm text-gray-400">No notes yet</p>
            )}
            {note.nextSteps && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Next Steps</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.nextSteps}</p>
              </div>
            )}
          </>
        )}
      </div>

      {!editing && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold">Internal Attendees</h2>
          <div className="flex flex-wrap gap-2">
            {note.attendees.length ? note.attendees.map((a) => (
              <span key={a.id} className="px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">{a.name}</span>
            )) : <span className="text-xs text-gray-400">None</span>}
          </div>
          <h2 className="text-sm font-semibold pt-2">External Attendees</h2>
          <div className="flex flex-wrap gap-2">
            {(note.externalAttendees || []).length ? note.externalAttendees.map((name) => (
              <span key={name} className="px-2.5 py-1 rounded-full text-xs bg-teal-50 text-teal-800 border border-teal-200">{name}</span>
            )) : <span className="text-xs text-gray-400">None</span>}
          </div>
          <h2 className="text-sm font-semibold pt-2">Permissions</h2>
          <div className="space-y-1">
            {note.permissions.map((p) => (
              <div key={p.userId} className="flex justify-between text-sm">
                <span>{p.userName}</span>
                <span className="text-xs text-gray-500">{p.role}</span>
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 mb-2">Invite user as Collaborator / Reader</p>
              <div className="flex flex-wrap gap-2">
                {users.filter((u) => !note.permissions.some((p) => p.userId === u.id)).map((u) => (
                  <div key={u.id} className="flex gap-1">
                    <button type="button" onClick={() => invite(u.id, "COLLABORATOR")}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">{u.name} · Collab</button>
                    <button type="button" onClick={() => invite(u.id, "READER")}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">Reader</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
