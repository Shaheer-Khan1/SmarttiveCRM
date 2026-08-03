import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Edit2, Trash2, Plus, StickyNote, History,
} from "lucide-react";
import {
  getOpportunity, getActivities, updateOpportunity, deleteOpportunity,
  createActivity, deleteActivity, uploadFile, getComments, addComment, deleteComment,
  getUsers, type Opportunity, type Activity, type Comment, type UserProfile, type OpportunityStage,
} from "@/lib/firestore";
import {
  getOpportunityProducts, getOpportunityEvents, getMeetingNotes, getCatalogProducts,
  setOpportunityProducts, syncOpportunityTags, logOpportunityEvent, PIPELINE_STAGES,
  type OpportunityProduct, type OpportunityEvent, type MeetingNote, type CatalogProduct,
} from "@/lib/crm";
import { useAuth } from "@/context/AuthContext";
import ActivityTimeline from "@/components/ActivityTimeline";
import StatusBadge from "@/components/StatusBadge";
import FollowUpBadge from "@/components/FollowUpBadge";
import PocTracker from "@/components/PocTracker";
import TagAutocomplete from "@/components/TagAutocomplete";
import {
  getFollowUpStatus, formatDate, formatTimeAgo, ACTIVITY_TYPES, CURRENCIES,
  PIPELINE_STAGE_LABELS, COUNTRIES, REGIONS,
} from "@/lib/utils";
import {
  canEditOpportunity, canContributeToOpportunity, canChangeOwner, canChangeCoOwner,
  canAddPocUpdate, canReopenCompletedPoc, canChangeStage, canCreateCrmRecords,
  canDeleteRecord, ownerEligibleUsers, isAdmin as checkAdmin,
} from "@/lib/permissions";

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user, profile } = useAuth();
  const navigate = useNavigate();
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [products, setProducts] = useState<OpportunityProduct[]>([]);
  const [events, setEvents] = useState<OpportunityEvent[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [newComment, setNewComment] = useState("");

  const load = async () => {
    if (!id) return;
    try {
      const o = await getOpportunity(id);
      setOpp(o);

      // Load secondary data independently so a missing index / empty collection
      // cannot block the opportunity itself from rendering.
      const settled = await Promise.allSettled([
        getActivities(id),
        getComments(id),
        getOpportunityProducts(id),
        getOpportunityEvents(id),
        getMeetingNotes({ opportunityId: id }),
        getUsers(),
        getCatalogProducts({ activeOnly: true }),
      ]);

      const val = <T,>(i: number, fallback: T): T =>
        settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;

      settled.forEach((r, i) => {
        if (r.status === "rejected") console.warn(`[OpportunityDetail] load part ${i} failed:`, r.reason);
      });

      setActivities(val(0, []));
      setComments(val(1, []));
      setProducts(val(2, []));
      setEvents(val(3, []));
      setNotes(val(4, []));
      setUsers(val(5, []));
      setCatalog(val(6, []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const canEdit = canEditOpportunity(opp, profile, user?.uid);
  const canContribute = canContributeToOpportunity(opp, profile, user?.uid);
  const canOwner = canChangeOwner(profile);
  const canCo = canChangeCoOwner(opp, profile, user?.uid);
  const canPoc = canAddPocUpdate(opp, profile, user?.uid);
  const canCreate = canCreateCrmRecords(profile);
  const actor = { id: user?.uid || "", name: profile?.name || "User" };

  const handleDelete = async () => {
    if (!id || !confirm("Delete this opportunity?")) return;
    await deleteOpportunity(id);
    navigate("/opportunities");
  };

  const handleStageClick = async (stage: OpportunityStage) => {
    if (!opp || !id || !canEdit) return;
    if (!canChangeStage(opp.stage, stage, profile, canEdit)) {
      alert("You cannot move this opportunity out of a closed stage.");
      return;
    }
    const prev = opp.stage;
    await updateOpportunity(id, { stage });
    await logOpportunityEvent(id, {
      type: stage === "CLOSED_WON" || stage === "CLOSED_LOST" ? "CLOSED" : "STAGE_CHANGED",
      message: `Stage changed from ${PIPELINE_STAGE_LABELS[prev]} to ${PIPELINE_STAGE_LABELS[stage]}`,
      actorId: actor.id,
      actorName: actor.name,
      meta: { from: prev, to: stage },
    });
    load();
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!id) return;
    await deleteActivity(activityId, id);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!opp) return <div className="text-center py-20 text-gray-400">Opportunity not found</div>;

  const followUp = getFollowUpStatus(opp.lastActivityDate || null);
  const pocNeeded = products.filter((p) => p.requiresPoc);
  const pocDone = pocNeeded.filter((p) => p.pocStatus === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
          <Link to="/opportunities" className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-xl mt-0.5 flex-shrink-0"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <StatusBadge status={opp.stage} />
              <FollowUpBadge status={followUp} />
            </div>
            <h1 className="page-title break-words">{opp.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              <Link to={`/customers/${opp.customerId}`} className="text-blue-600 hover:underline">{opp.customerName}</Link>
              {" · "}{opp.country || "—"}
              {opp.closeDate ? ` · Close ${formatDate(opp.closeDate)}` : ""}
            </p>
          </div>
        </div>
        {(canEdit || canDeleteRecord(profile, opp.initiatedById, user?.uid)) && (
          <div className="flex gap-2">
            {canEdit && (
              <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            )}
            {canDeleteRecord(profile, opp.initiatedById, user?.uid) && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stage stepper */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {PIPELINE_STAGES.map((s, i) => {
            const idx = PIPELINE_STAGES.indexOf(opp.stage);
            const active = s === opp.stage;
            const done = PIPELINE_STAGES.indexOf(s) < idx;
            return (
              <div key={s} className="flex items-center">
                <button type="button" disabled={!canEdit} onClick={() => handleStageClick(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active ? "bg-blue-600 text-white border-blue-600"
                      : done ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                  } ${canEdit ? "cursor-pointer hover:opacity-90" : "cursor-default"}`}>
                  {PIPELINE_STAGE_LABELS[s]}
                </button>
                {i < PIPELINE_STAGES.length - 1 && <div className="w-4 h-px bg-gray-200 mx-0.5" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
          <section className="panel p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Details</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Info label="Owner" value={opp.owner?.name || "—"} />
              <Info label="Co-Owner" value={opp.coOwner?.name || "None"} />
              <Info label="Expected Value" value={opp.value != null ? `${opp.value.toLocaleString()} ${opp.currency || ""}` : "—"} />
              <Info label="Region" value={opp.region || "—"} />
            </div>
            {opp.notes && <p className="text-sm text-gray-600 whitespace-pre-wrap">{opp.notes}</p>}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {opp.tags.length ? opp.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">{t}</span>
                )) : <span className="text-xs text-gray-400">No tags</span>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Products</p>
              <div className="flex flex-wrap gap-1.5">
                {products.length ? products.map((p) => (
                  <span key={p.id} className="px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ background: p.color }}>
                    {p.productName}{p.requiresPoc ? " · PoC" : ""}
                  </span>
                )) : <span className="text-xs text-gray-400">No products</span>}
              </div>
              {pocNeeded.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">PoC progress: {pocDone}/{pocNeeded.length}</p>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">PoC Tracker</h2>
            <PocTracker
              opportunityId={id!}
              products={products}
              canUpdate={canPoc}
              canReopen={canReopenCompletedPoc(profile)}
              actor={actor}
              isAdmin={!!isAdmin}
              onChanged={async () => {
                await logOpportunityEvent(id!, {
                  type: checkAdmin(profile) ? "ADMIN_OVERRIDE" : "POC_UPDATED",
                  message: "PoC progress updated",
                  actorId: actor.id,
                  actorName: actor.name,
                });
                load();
              }}
            />
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Meeting Notes</h2>
              {canCreate && (
                <Link to={`/meeting-notes/new?opportunityId=${id}`}
                  className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1">
                  <StickyNote className="w-3.5 h-3.5" /> Add note
                </Link>
              )}
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-gray-400">No meeting notes linked</p>
            ) : notes.map((n) => (
              <Link key={n.id} to={`/meeting-notes/${n.id}`}
                className="block border border-gray-100 rounded-lg p-3 hover:border-blue-200">
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.meetingDate ? formatDate(n.meetingDate) : "No date"} · {n.createdByName}</p>
              </Link>
            ))}
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Activity Timeline</h2>
              {canContribute && (
                <button onClick={() => setShowActivity(true)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600">
                  <Plus className="w-3.5 h-3.5" /> Add Activity
                </button>
              )}
            </div>
            <ActivityTimeline
              activities={activities}
              canDeleteActivity={(a) => canDeleteRecord(profile, a.createdById, user?.uid)}
              onDelete={handleDeleteActivity}
            />
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Comments</h2>
            {comments.length === 0 && (
              <p className="text-sm text-gray-400">No comments yet</p>
            )}
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="text-sm border-l-2 border-gray-200 pl-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{c.authorName}</span>
                    {canDeleteRecord(profile, c.authorId, user?.uid) && (
                      <button onClick={async () => { await deleteComment(id!, c.id); load(); }} className="text-xs text-red-500">Delete</button>
                    )}
                  </div>
                  <p className="text-gray-600">{c.text}</p>
                </div>
              ))}
            </div>
            {canContribute ? (
              <div className="flex gap-2">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Add a comment…" />
                <button
                  onClick={async () => {
                    if (!newComment.trim() || !user) return;
                    await addComment(id!, newComment.trim(), user.uid, profile?.name || "User");
                    setNewComment("");
                    load();
                  }}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg">Post</button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">You can comment on opportunities you created.</p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <History className="w-4 h-4" /> Activity History
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-xs text-gray-400">No audit events yet</p>
              ) : events.map((e) => (
                <div key={e.id} className="text-xs border-b border-gray-50 pb-2">
                  <p className="text-gray-800">{e.message}</p>
                  <p className="text-gray-400 mt-0.5">{e.actorName} · {formatTimeAgo(e.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {showActivity && (
        <AddActivityModal
          opportunityId={id!}
          onClose={() => setShowActivity(false)}
          onSaved={() => { setShowActivity(false); load(); }}
        />
      )}

      {showEdit && opp && (
        <EditOpportunityModal
          opp={opp}
          products={products}
          catalog={catalog}
          users={users}
          canOwner={canOwner}
          canCo={canCo}
          canEdit={canEdit}
          actor={actor}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function AddActivityModal({ opportunityId, onClose, onSaved }: {
  opportunityId: string; onClose: () => void; onSaved: () => void;
}) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ type: "MEETING", date: new Date().toISOString().slice(0, 10), summary: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const actId = await createActivity({
        opportunityId,
        type: form.type,
        date: new Date(form.date),
        summary: form.summary,
        notes: form.notes,
      });
      if (file) await uploadFile(file, opportunityId, actId);
      await logOpportunityEvent(opportunityId, {
        type: file ? "FILE_UPLOADED" : "UPDATED",
        message: file ? `File uploaded on activity: ${form.summary}` : `Activity logged: ${form.summary}`,
        actorId: user?.uid || "",
        actorName: profile?.name || "User",
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-semibold">Add Activity</h2>
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input required placeholder="Summary" value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <textarea rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditOpportunityModal({
  opp, products, catalog, users, canOwner, canCo, canEdit, actor, onClose, onSaved,
}: {
  opp: Opportunity;
  products: OpportunityProduct[];
  catalog: CatalogProduct[];
  users: UserProfile[];
  canOwner: boolean;
  canCo: boolean;
  canEdit: boolean;
  actor: { id: string; name: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: opp.title,
    country: opp.country || "",
    region: opp.region || "",
    stage: opp.stage,
    value: opp.value?.toString() || "",
    currency: opp.currency || "SAR",
    closeDate: opp.closeDate ? new Date(opp.closeDate).toISOString().slice(0, 10) : "",
    notes: opp.notes || "",
    tags: [...opp.tags],
    ownerId: opp.owner?.id || "",
    coOwnerId: opp.coOwner?.id || "",
  });
  const [selected, setSelected] = useState(
    products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      color: p.color,
      requiresPoc: p.requiresPoc,
      pocStatus: p.pocStatus,
    })),
  );
  const [saving, setSaving] = useState(false);

  const toggleProduct = (p: CatalogProduct) => {
    setSelected((list) => {
      const exists = list.find((x) => x.productId === p.id);
      if (exists) return list.filter((x) => x.productId !== p.id);
      return [...list, { productId: p.id, productName: p.name, color: p.color, requiresPoc: false, pocStatus: "NOT_STARTED" as const }];
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const ownerUser = users.find((u) => u.id === form.ownerId);
      const coUser = form.coOwnerId ? users.find((u) => u.id === form.coOwnerId) : null;
      const owner = ownerUser ? { id: ownerUser.id, name: ownerUser.name } : opp.owner;
      const coOwner = coUser ? { id: coUser.id, name: coUser.name } : null;

      if (owner.id !== opp.owner?.id && !canOwner) {
        alert("Only Admin/Manager can change Owner");
        setSaving(false);
        return;
      }

      await updateOpportunity(opp.id, {
        title: form.title,
        country: form.country,
        region: form.region || null,
        stage: form.stage,
        value: form.value ? parseFloat(form.value) : null,
        currency: form.currency,
        closeDate: form.closeDate ? new Date(form.closeDate) : null,
        notes: form.notes,
        tags: form.tags,
        owner: canOwner ? owner : opp.owner,
        coOwner: canCo ? coOwner : opp.coOwner,
        solution: selected.map((p) => p.productName).join(", "),
      });

      await setOpportunityProducts(opp.id, selected);
      await syncOpportunityTags(opp.tags, form.tags);

      if (canOwner && owner.id !== opp.owner?.id) {
        await logOpportunityEvent(opp.id, {
          type: "OWNER_CHANGED",
          message: `Owner changed to ${owner.name}`,
          actorId: actor.id,
          actorName: actor.name,
        });
      }
      if (canCo && (coOwner?.id || null) !== (opp.coOwner?.id || null)) {
        await logOpportunityEvent(opp.id, {
          type: "CO_OWNER_CHANGED",
          message: coOwner ? `Co-Owner set to ${coOwner.name}` : "Co-Owner removed",
          actorId: actor.id,
          actorName: actor.name,
        });
      }
      if (JSON.stringify(opp.tags) !== JSON.stringify(form.tags)) {
        await logOpportunityEvent(opp.id, {
          type: "TAGS_EDITED",
          message: "Tags updated",
          actorId: actor.id,
          actorName: actor.name,
        });
      }
      if (form.stage !== opp.stage) {
        await logOpportunityEvent(opp.id, {
          type: form.stage.startsWith("CLOSED") ? "CLOSED" : "STAGE_CHANGED",
          message: `Stage → ${PIPELINE_STAGE_LABELS[form.stage]}`,
          actorId: actor.id,
          actorName: actor.name,
        });
      }
      await logOpportunityEvent(opp.id, {
        type: "UPDATED",
        message: "Opportunity details updated",
        actorId: actor.id,
        actorName: actor.name,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-semibold">Edit Opportunity</h2></div>
        <div className="p-6 space-y-3">
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Name" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={inputCls + " bg-white"}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className={inputCls + " bg-white"}>
              <option value="">Region</option>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as OpportunityStage }))} className={inputCls + " bg-white"}>
            {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select disabled={!canOwner} value={form.ownerId} onChange={(e) => setForm((f) => ({ ...f, ownerId: e.target.value }))} className={inputCls + " bg-white disabled:opacity-60"}>
              {ownerEligibleUsers(users).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
            <select disabled={!canCo} value={form.coOwnerId} onChange={(e) => setForm((f) => ({ ...f, coOwnerId: e.target.value }))} className={inputCls + " bg-white disabled:opacity-60"}>
              <option value="">No Co-Owner</option>
              {ownerEligibleUsers(users).filter((u) => u.id !== form.ownerId).map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {catalog.map((p) => {
              const on = selected.some((x) => x.productId === p.id);
              return (
                <button key={p.id} type="button" onClick={() => toggleProduct(p)}
                  className={`px-2 py-1 rounded-full text-xs font-medium border ${on ? "text-white border-transparent" : "border-gray-200"}`}
                  style={on ? { background: p.color } : undefined}>{p.name}</button>
              );
            })}
          </div>
          {selected.map((p) => (
            <label key={p.productId} className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={p.requiresPoc}
                onChange={(e) => setSelected((list) => list.map((x) => x.productId === p.productId ? { ...x, requiresPoc: e.target.checked } : x))} />
              {p.productName} Requires PoC
            </label>
          ))}
          <TagAutocomplete value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className={inputCls} placeholder="Value" />
            <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={inputCls + " bg-white"}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input type="date" value={form.closeDate} onChange={(e) => setForm((f) => ({ ...f, closeDate: e.target.value }))} className={inputCls} />
          <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} />
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
