import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Edit2, Trash2, Plus, Users, Building2, DollarSign,
  ArrowRight, CheckCircle, XCircle, PauseCircle, RefreshCw, Paperclip,
  MessageSquare, Send, UserPlus, X,
} from "lucide-react";
import {
  getOpportunity, getActivities, updateOpportunity, deleteOpportunity,
  createActivity, deleteActivity, uploadFile, getComments, addComment, deleteComment,
  type Opportunity, type Activity, type Comment,
} from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import ActivityTimeline from "@/components/ActivityTimeline";
import ActivityCalendar from "@/components/ActivityCalendar";
import StatusBadge from "@/components/StatusBadge";
import FollowUpBadge from "@/components/FollowUpBadge";
import { getFollowUpStatus, formatDate, formatTimeAgo, ACTIVITY_TYPES, CURRENCIES } from "@/lib/utils";
import { getUsers, type UserProfile, type AssignedPerson } from "@/lib/firestore";

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const isAssigned = opp?.assignedTo.some((a) => a.id === user?.uid) ?? false;
  const canAddActivity = isAdmin || isAssigned;

  const load = async () => {
    const [o, a, c] = await Promise.all([
      getOpportunity(id!),
      getActivities(id!),
      getComments(id!),
    ]);
    setOpp(o);
    setActivities(a);
    setComments(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Delete this activity?")) return;
    await deleteActivity(activityId, id!);
    load();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this opportunity and all activities?")) return;
    await deleteOpportunity(id!);
    navigate("/opportunities");
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setPostingComment(true);
    await addComment(id!, newComment.trim(), user!.uid, profile?.name || "Admin");
    setNewComment("");
    const updated = await getComments(id!);
    setComments(updated);
    setPostingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    await deleteComment(id!, commentId);
    setComments((c) => c.filter((x) => x.id !== commentId));
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!opp) return <div className="text-center py-16">Opportunity not found</div>;

  const followUpStatus = getFollowUpStatus(opp.lastActivityDate || null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate("/opportunities")} className="p-2 hover:bg-gray-100 rounded-lg mt-1">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{opp.title}</h1>
            <StatusBadge status={opp.status} />
            {opp.status === "ACTIVE" && <FollowUpBadge status={followUpStatus} />}
          </div>
          <Link to={`/customers/${opp.customerId}`}
            className="text-gray-500 text-sm hover:text-blue-600 flex items-center gap-1 mt-1">
            <Building2 className="w-3.5 h-3.5" />{opp.customerName}
          </Link>
          {opp.initiatedByName && (
            <p className="text-xs text-gray-400 mt-0.5">Initiated by {opp.initiatedByName}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-4 h-4" /> Status
            </button>
            <button onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              <Edit2 className="w-4 h-4" /> Edit
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {opp.solution && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Solution / Product</p>
                  <p className="text-gray-900 font-medium">{opp.solution}</p>
                </div>
              )}
              {opp.assignedTo.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Assigned To</p>
                  <div className="flex flex-wrap gap-2">
                    {opp.assignedTo.map((a) => (
                      <span key={a.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${a.id === user?.uid ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}>
                        <span className="w-4 h-4 rounded-full bg-gray-300 text-gray-700 text-[10px] flex items-center justify-center font-bold">{a.name.charAt(0)}</span>
                        {a.name}
                        {a.id === user?.uid && <span className="text-blue-500 text-[10px]">you</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {opp.value && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estimated Value</p>
                  <p className="flex items-center gap-1.5 font-semibold"><DollarSign className="w-3.5 h-3.5 text-gray-400" />{opp.value.toLocaleString()} {opp.currency}</p>
                </div>
              )}
              {opp.holdReason && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 mb-1">Hold Reason</p>
                  <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{opp.holdReason}</p>
                </div>
              )}
            </div>
            {opp.nextStep && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Next Step</p>
                <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2">
                  <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">{opp.nextStep}</p>
                </div>
              </div>
            )}
            {opp.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{opp.notes}</p>
              </div>
            )}
            {opp.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Team</p>
                <div className="flex flex-wrap gap-1.5">
                  {opp.tags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">
                Activity Timeline
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{activities.length}</span>
              </h2>
              {canAddActivity && (
                <button onClick={() => setShowActivityModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                  <Plus className="w-3.5 h-3.5" /> Add Activity
                </button>
              )}
            </div>
            <ActivityTimeline activities={activities} isAdmin={isAdmin} onDelete={handleDeleteActivity} />
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              Comments
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{comments.length}</span>
            </h2>

            {comments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No comments yet.</p>
            )}

            <div className="space-y-3 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 group">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {c.authorName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-gray-900">{c.authorName}</span>
                      <span className="text-xs text-gray-400">{formatTimeAgo(c.createdAt)}</span>
                      {isAdmin && (
                        <button onClick={() => handleDeleteComment(c.id)}
                          className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {isAdmin && (
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handlePostComment()}
                  placeholder="Add a comment..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={handlePostComment} disabled={postingComment || !newComment.trim()}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">Quick Actions</h3>
              {opp.status === "ACTIVE" ? (
                <div className="space-y-2">
                  <button onClick={() => setShowStatusModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg">
                    <CheckCircle className="w-4 h-4" /> Mark as Won
                  </button>
                  <button onClick={() => setShowStatusModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg">
                    <XCircle className="w-4 h-4" /> Mark as Lost
                  </button>
                  <button onClick={() => setShowStatusModal(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg">
                    <PauseCircle className="w-4 h-4" /> Put on Hold
                  </button>
                </div>
              ) : (
                <button onClick={async () => { await updateOpportunity(id!, { status: "ACTIVE", holdReason: "" }); load(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                  <RefreshCw className="w-4 h-4" /> Reactivate
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Follow-up Status</h3>
            <FollowUpBadge status={followUpStatus} className="mb-3" />
            {opp.lastActivityDate ? (
              <p className="text-xs text-gray-500">Last activity: {formatDate(opp.lastActivityDate)}</p>
            ) : (
              <p className="text-xs text-gray-400">No activities recorded</p>
            )}
          </div>

          <ActivityCalendar activities={activities} />
        </div>
      </div>

      {showActivityModal && (
        <AddActivityModal opportunityId={id!} onClose={() => setShowActivityModal(false)} onSaved={() => { setShowActivityModal(false); load(); }} />
      )}
      {showEditModal && opp && (
        <EditOpportunityModal opp={opp} onClose={() => setShowEditModal(false)} onSaved={() => { setShowEditModal(false); load(); }} />
      )}
      {showStatusModal && opp && (
        <ChangeStatusModal opportunityId={id!} currentStatus={opp.status} onClose={() => setShowStatusModal(false)} onSaved={() => { setShowStatusModal(false); load(); }} />
      )}
    </div>
  );
}

function AddActivityModal({ opportunityId, onClose, onSaved }: { opportunityId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: "MEETING", date: new Date().toISOString().slice(0, 16), summary: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const activityId = await createActivity({ opportunityId, type: form.type, date: new Date(form.date), summary: form.summary, notes: form.notes });
    if (file) await uploadFile(file, opportunityId, activityId);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="px-6 py-5 border-b border-gray-100"><h2 className="text-lg font-semibold">Add Activity</h2></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Type *</label>
              <select required value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Date & Time *</label>
              <input type="datetime-local" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Summary *</label>
            <input required value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="Brief description of what happened"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" />Attachment (optional)</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Add Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditOpportunityModal({ opp, onClose, onSaved }: { opp: Opportunity; onClose: () => void; onSaved: () => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [form, setForm] = useState({
    title: opp.title, solution: opp.solution || "", value: opp.value?.toString() || "",
    currency: opp.currency || "SAR", nextStep: opp.nextStep || "", notes: opp.notes || "",
    assignedTo: [...opp.assignedTo],
    tags: [...opp.tags],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { getUsers().then(setUsers); }, []);

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
    await updateOpportunity(opp.id, {
      ...form,
      value: form.value ? parseFloat(form.value) : null,
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
        <div className="px-6 py-5 border-b border-gray-100"><h2 className="text-lg font-semibold">Edit Opportunity</h2></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[{ key: "title", label: "Title", required: true }, { key: "solution", label: "Solution" }, { key: "nextStep", label: "Next Step" }].map(({ key, label, required }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">{label}{required && " *"}</label>
              <input required={required} value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Value</label>
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
              <UserPlus className="w-3.5 h-3.5" /> Assigned To
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
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py py-2 text-sm text-gray-600 font-medium">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangeStatusModal({ opportunityId, currentStatus, onClose, onSaved }: {
  opportunityId: string; currentStatus: string; onClose: () => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [holdReason, setHoldReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateOpportunity(opportunityId, { status: status as Opportunity["status"], holdReason: status === "ON_HOLD" ? holdReason : "" });
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-5 border-b border-gray-100"><h2 className="text-lg font-semibold">Change Status</h2></div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "ACTIVE", l: "Active", icon: <RefreshCw className="w-4 h-4" />, cls: "text-blue-700 border-blue-300 bg-blue-50" },
              { v: "WON", l: "Won", icon: <CheckCircle className="w-4 h-4" />, cls: "text-green-700 border-green-300 bg-green-50" },
              { v: "LOST", l: "Lost", icon: <XCircle className="w-4 h-4" />, cls: "text-red-700 border-red-300 bg-red-50" },
              { v: "ON_HOLD", l: "On Hold", icon: <PauseCircle className="w-4 h-4" />, cls: "text-amber-700 border-amber-300 bg-amber-50" },
            ].map(({ v, l, icon, cls }) => (
              <button key={v} onClick={() => setStatus(v)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${status === v ? cls + " border-current" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                {icon} {l}
              </button>
            ))}
          </div>
          {status === "ON_HOLD" && (
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Hold Reason *</label>
              <input required value={holdReason} onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Why is this on hold?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
            <button onClick={handleSave} disabled={saving || (status === "ON_HOLD" && !holdReason)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Update Status"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
