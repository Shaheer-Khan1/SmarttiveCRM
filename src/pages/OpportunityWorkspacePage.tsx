import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from "date-fns";
import { ExternalLink, Plus } from "lucide-react";
import {
  getOpportunities, getActivities, getUsers, getComments,
  type Opportunity, type Activity, type UserProfile, type OpportunityStage, type Comment,
} from "@/lib/firestore";
import {
  getOpportunityEvents, getMeetingNotes, getOpportunityProducts, logOpportunityEvent,
  moveOpportunityStage, opportunityEventAt, stageAtTime,
  type OpportunityEvent, type MeetingNote, type OpportunityProduct,
} from "@/lib/crm";
import {
  createOpportunityTask, updateOpportunityTask, saveStageGates, getOpportunityTasks,
  parseStageGates, opportunityHealth, overdueTaskCount, taskDueBucket, taskDueLabel,
  initials, fmtShortDate, TASK_LANES,
  type OpportunityTask, type StageGate, type TaskLane, type TaskStatus, type TaskSource,
} from "@/lib/workspace";
import { useAuth } from "@/context/AuthContext";
import {
  PIPELINE_STAGE_LABELS, formatDateTime, countryFlag, byOpportunityTitle,
  getFollowUpStatus, followUpReason, RED_FLAG_EXPLANATION,
} from "@/lib/utils";
import {
  canCreateCrmRecords, canEditOpportunity, isAdmin as checkAdmin,
  FORWARD_STAGES, nextOpportunityStage, stageMoveKind, type StageMoveKind,
} from "@/lib/permissions";
import StageMoveDialog from "@/components/StageMoveDialog";
import OpportunityTimeTracker from "@/components/OpportunityTimeTracker";
import "@/styles/workspace.css";

type TabId = "pulse" | "minutes" | "tasks" | "poc" | "calendar";
type StreamItem = {
  id: string;
  at: Date;
  kind: "minute" | "update" | "task" | "poc" | "stage" | "comm";
  title: string;
  body: string;
  by: string;
  stageLabel?: string;
};

const RAIL_FILTERS: { v: string; l: string }[] = [
  { v: "all", l: "All" },
  { v: "LEAD", l: "Lead" },
  { v: "POC", l: "PoC" },
  { v: "PROPOSAL", l: "Quote" },
  { v: "NEGOTIATION", l: "Nego" },
  { v: "CLOSED_WON", l: "Won" },
  { v: "CLOSED_LOST", l: "Lost" },
];

export default function OpportunityWorkspacePage() {
  const { user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const canCreate = canCreateCrmRecords(profile);

  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tasksByOpp, setTasksByOpp] = useState<Record<string, OpportunityTask[]>>({});
  const [loading, setLoading] = useState(true);

  const [railStage, setRailStage] = useState("all");
  const [mode, setMode] = useState<"split" | "focus">("split");
  const [tab, setTab] = useState<TabId>("pulse");
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [dayFilter, setDayFilter] = useState<string | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [events, setEvents] = useState<OpportunityEvent[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [products, setProducts] = useState<OpportunityProduct[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stageMove, setStageMove] = useState<{
    to: OpportunityStage;
    kind: Exclude<StageMoveKind, "same" | "blocked">;
  } | null>(null);

  const [showTask, setShowTask] = useState(false);
  const [gateDraft, setGateDraft] = useState("");

  const selectedId = params.get("id") || "";

  const loadList = useCallback(async () => {
    const [o, u] = await Promise.all([getOpportunities(), getUsers()]);
    const sorted = [...o].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    setOpps(sorted);
    setUsers(u);
    const taskMap: Record<string, OpportunityTask[]> = {};
    await Promise.all(sorted.map(async (opp) => {
      try { taskMap[opp.id] = await getOpportunityTasks(opp.id); }
      catch { taskMap[opp.id] = []; }
    }));
    setTasksByOpp(taskMap);
    setLoading(false);
    if (!params.get("id") && sorted[0]) {
      setParams({ id: sorted[0].id }, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => { void loadList(); }, []);

  const selected = useMemo(
    () => opps.find((o) => o.id === selectedId) || opps[0] || null,
    [opps, selectedId],
  );

  const tasks = selected ? (tasksByOpp[selected.id] || []) : [];

  const loadDetail = useCallback(async (oppId: string) => {
    setDetailLoading(true);
    try {
      const settled = await Promise.allSettled([
        getActivities(oppId),
        getOpportunityEvents(oppId),
        getMeetingNotes({ opportunityId: oppId }),
        getOpportunityProducts(oppId),
        getOpportunityTasks(oppId),
        getComments(oppId),
      ]);
      const val = <T,>(i: number, fb: T): T =>
        settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<T>).value : fb;
      setActivities(val(0, []));
      setEvents(val(1, []));
      setNotes(val(2, []));
      setProducts(val(3, []));
      setTasksByOpp((m) => ({ ...m, [oppId]: val(4, []) }));
      setComments(val(5, []));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected?.id) void loadDetail(selected.id);
  }, [selected?.id, loadDetail]);

  const filteredRail = useMemo(() => {
    const list = railStage === "all"
      ? opps
      : railStage === "LEAD"
        ? opps.filter((o) => o.stage === "LEAD" || o.stage === "QUALIFICATION")
        : opps.filter((o) => o.stage === railStage);
    return [...list].sort(byOpportunityTitle);
  }, [opps, railStage]);

  const streamItems: StreamItem[] = useMemo(() => {
    if (!selected) return [];
    const list: StreamItem[] = [];
    activities.forEach((a) => {
      list.push({
        id: `act-${a.id}`,
        at: a.date || a.createdAt,
        kind: "update",
        title: a.summary || a.type,
        body: a.notes || "",
        by: a.createdByName || "User",
      });
    });
    notes.forEach((n) => {
      list.push({
        id: `note-${n.id}`,
        at: n.meetingDate || n.createdAt,
        kind: "minute",
        title: n.title,
        body: n.quickNotes || n.body || "",
        by: n.createdByName,
      });
    });
    events.forEach((e) => {
      if (e.message.startsWith("Activity logged:") || e.message.startsWith("File uploaded on activity:")) return;
      const kind: StreamItem["kind"] =
        e.type.includes("STAGE") || e.type === "CLOSED" ? "stage"
          : e.type.includes("POC") ? "poc"
            : e.type.includes("MEETING") ? "minute"
              : "comm";
      list.push({
        id: `ev-${e.id}`,
        at: opportunityEventAt(e),
        kind,
        title: e.message,
        body: "",
        by: e.actorName,
      });
    });
    comments.forEach((c) => {
      const stage = c.stage || stageAtTime(c.createdAt, events, selected.stage);
      list.push({
        id: `comment-${c.id}`,
        at: c.createdAt,
        kind: "comm",
        title: "Comment",
        body: c.text,
        by: c.authorName,
        stageLabel: PIPELINE_STAGE_LABELS[stage] || stage,
      });
    });
    tasks.forEach((t) => {
      list.push({
        id: `task-ev-${t.id}`,
        at: t.createdAt,
        kind: "task",
        title: `Task — ${t.title}`,
        body: `${t.lane} · ${t.responsible.name}${t.dueDate ? ` · due ${fmtShortDate(t.dueDate)}` : ""}`,
        by: t.createdByName,
      });
    });
    list.sort((a, b) => b.at.getTime() - a.at.getTime());
    return list;
  }, [selected, activities, notes, events, tasks, comments]);

  const visibleStream = useMemo(() => {
    let list = streamItems;
    if (tab === "minutes") list = list.filter((x) => x.kind === "minute");
    if (dayFilter) list = list.filter((x) => format(x.at, "yyyy-MM-dd") === dayFilter);
    return list;
  }, [streamItems, tab, dayFilter]);

  const attention = useMemo(() => {
    const open = tasks.filter((t) => ["over", "today", "soon"].includes(taskDueBucket(t)));
    const rank: Record<string, number> = { over: 0, today: 1, soon: 2 };
    return open.sort((a, b) =>
      (rank[taskDueBucket(a)] ?? 9) - (rank[taskDueBucket(b)] ?? 9)
      || (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0),
    );
  }, [tasks]);

  const canEdit = canEditOpportunity(selected, profile, user?.uid);
  const isOwner = !!selected && selected.owner?.id === user?.uid;
  const gates = parseStageGates(selected?.stageGates);

  const selectOpp = (id: string) => {
    setParams({ id });
    setDayFilter(null);
    setTab("pulse");
  };

  const toggleGate = async (gateId: string) => {
    if (!selected || !canEdit) return;
    const next = gates.map((g) => (g.id === gateId ? { ...g, done: !g.done } : g));
    await saveStageGates(selected.id, next);
    setOpps((list) => list.map((o) => (o.id === selected.id ? { ...o, stageGates: next } : o)));
  };

  const addGate = async () => {
    if (!selected || !canEdit || !gateDraft.trim()) return;
    const next: StageGate[] = [
      ...gates,
      {
        id: `g_${Date.now()}`,
        text: gateDraft.trim(),
        done: false,
        ownerLabel: initials(profile?.name || "U"),
      },
    ];
    await saveStageGates(selected.id, next);
    setOpps((list) => list.map((o) => (o.id === selected.id ? { ...o, stageGates: next } : o)));
    setGateDraft("");
  };

  const cycleTaskStatus = async (task: OpportunityTask) => {
    if (!canEdit) return;
    const order: TaskStatus[] = ["todo", "doing", "blocked", "done"];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    await updateOpportunityTask(task.id, { status: next });
    setTasksByOpp((m) => ({
      ...m,
      [task.opportunityId]: (m[task.opportunityId] || []).map((t) =>
        t.id === task.id ? { ...t, status: next } : t,
      ),
    }));
  };

  const createTask = async (payload: {
    title: string;
    lane: TaskLane;
    responsibleId: string;
    assistIds: string[];
    due: string;
    source: TaskSource;
  }) => {
    if (!selected || !user || !profile) return;
    const responsible = users.find((u) => u.id === payload.responsibleId);
    if (!responsible) return;
    const assistants = users
      .filter((u) => payload.assistIds.includes(u.id) && u.id !== responsible.id)
      .map((u) => ({ id: u.id, name: u.name }));
    const id = await createOpportunityTask({
      opportunityId: selected.id,
      title: payload.title.trim(),
      lane: payload.lane,
      responsible: { id: responsible.id, name: responsible.name },
      assistants,
      dueDate: payload.due ? new Date(payload.due) : null,
      status: "todo",
      source: payload.source,
      createdById: user.uid,
      createdByName: profile.name,
    });
    await logOpportunityEvent(selected.id, {
      type: "UPDATED",
      message: `Task created — ${payload.title.trim()}`,
      actorId: user.uid,
      actorName: profile.name,
    });
    const created: OpportunityTask = {
      id,
      opportunityId: selected.id,
      title: payload.title.trim(),
      lane: payload.lane,
      responsible: { id: responsible.id, name: responsible.name },
      assistants,
      dueDate: payload.due ? new Date(payload.due) : null,
      status: "todo",
      source: payload.source,
      createdById: user.uid,
      createdByName: profile.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setTasksByOpp((m) => ({
      ...m,
      [selected.id]: [created, ...(m[selected.id] || [])],
    }));
    setShowTask(false);
    setTab("tasks");
  };

  const confirmStageMove = async (movedAt: Date) => {
    if (!selected || !stageMove || !user) return;
    await moveOpportunityStage({
      opportunityId: selected.id,
      from: selected.stage,
      to: stageMove.to,
      movedAt,
      actorId: user.uid,
      actorName: profile?.name || "User",
    });
    setOpps((list) => list.map((o) => (
      o.id === selected.id ? { ...o, stage: stageMove.to, stageEnteredAt: movedAt } : o
    )));
    setStageMove(null);
    await loadDetail(selected.id);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const doneGates = gates.filter((g) => g.done).length;
  const gatePct = gates.length ? Math.round((doneGates / gates.length) * 100) : 0;
  const stageIdx = selected ? FORWARD_STAGES.indexOf(selected.stage) : -1;
  const nextStage = selected ? nextOpportunityStage(selected.stage) : null;
  const adminUser = checkAdmin(profile);
  const backTargets: OpportunityStage[] = !selected || !adminUser
    ? []
    : selected.stage === "CLOSED_LOST"
      ? [...FORWARD_STAGES]
      : FORWARD_STAGES.filter((_, i) => stageIdx >= 0 && i < stageIdx);
  const overdue = overdueTaskCount(tasks);
  const pocProducts = products.filter((p) => p.requiresPoc);
  const pocDone = pocProducts.filter((p) => p.pocStatus === "COMPLETED").length;

  return (
    <div className="ws-root">
      <header className="ws-topbar">
        <div className="ws-brand">
          <span className="dot" />
          Pipeline
          <small>opportunity workspace</small>
        </div>
        <span className="ws-spacer" />
        <div className="ws-seg" role="group" aria-label="Layout">
          <button type="button" aria-pressed={mode === "split"} onClick={() => setMode("split")}>Split</button>
          <button type="button" aria-pressed={mode === "focus"} onClick={() => setMode("focus")}>Focus</button>
        </div>
        {selected && (
          <Link to={`/opportunities/${selected.id}`} className="ws-ghost">
            <ExternalLink className="w-3.5 h-3.5" /> Full record
          </Link>
        )}
      </header>

      <div className="ws-body">
        <nav className="ws-rail" aria-label="Opportunities">
          <div className="ws-rail-head">
            <span className="ws-eyebrow">Opportunities</span>
            <span className="ws-eyebrow">{filteredRail.length}</span>
          </div>
          <div className="ws-rail-filter">
            {RAIL_FILTERS.map((f) => (
              <button
                key={f.v}
                type="button"
                className="ws-mini-chip"
                aria-pressed={railStage === f.v}
                onClick={() => setRailStage(f.v)}
              >
                {f.l}
              </button>
            ))}
          </div>
          <div className="ws-rail-list">
            {filteredRail.length === 0 ? (
              <p className="ws-empty" style={{ padding: "16px 8px" }}>No opportunities</p>
            ) : filteredRail.map((o) => {
              const tlist = tasksByOpp[o.id] || [];
              const health = opportunityHealth(o, tlist);
              const od = overdueTaskCount(tlist);
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`ws-opp-item ${health}`}
                  aria-current={selected?.id === o.id}
                  onClick={() => selectOpp(o.id)}
                >
                  <span className="bar" />
                  <span>
                    <span className="name">{o.title}</span>
                    <span className="sub">
                      {countryFlag(o.country)} {PIPELINE_STAGE_LABELS[o.stage] || o.stage}
                      {o.solution ? ` · ${o.solution}` : ""}
                      {o.value != null && <b>{o.currency} {o.value.toLocaleString()}</b>}
                      {od > 0 && <span className="ws-od-badge">{od} overdue</span>}
                    </span>
                    {o.nextStep && <span className="sub">{o.nextStep}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <main className="ws-work" data-mode={mode}>
          {selected ? (
            <>
              <section className="ws-spine" aria-label="Opportunity detail">
                <div>
                  <h1 className="ws-opp-title">{selected.title}</h1>
                  <div className="ws-opp-meta">
                    <span>{selected.customerName}</span>
                    {selected.country && (
                      <span className="ws-tag">{countryFlag(selected.country)} {selected.country}</span>
                    )}
                    {(selected.solution || "").split(",").map((s) => s.trim()).filter(Boolean).map((name) => (
                      <span key={name} className="ws-tag accent">{name}</span>
                    ))}
                    {selected.partner && <span className="ws-tag">Partner · {selected.partner}</span>}
                  </div>
                </div>

                <div className="ws-pipe" aria-label="Stage">
                  {FORWARD_STAGES.map((s) => {
                    const idx = FORWARD_STAGES.indexOf(s);
                    const isNext = stageIdx >= 0 && idx === stageIdx + 1;
                    const isBack = selected.stage === "CLOSED_LOST" || (stageIdx >= 0 && idx < stageIdx);
                    const allowed = (isNext && isOwner) || (adminUser && isBack && s !== selected.stage);
                    const kind = stageMoveKind(selected.stage, s);
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`step ${idx < stageIdx ? "done" : ""} ${idx === stageIdx ? "now" : ""}`}
                        disabled={!allowed}
                        title={allowed
                          ? (kind === "forward" ? "Owner: move one stage forward" : "Admin: move back")
                          : isNext ? "Only the owner can move this to the next stage" : "Only the next stage is available"}
                        onClick={() => {
                          if (!allowed || kind === "same" || kind === "blocked") return;
                          setStageMove({ to: s, kind });
                        }}
                      >
                        <span className="lbl">{PIPELINE_STAGE_LABELS[s]}</span>
                      </button>
                    );
                  })}
                </div>
                {!isOwner && selected.stage !== "CLOSED_WON" && selected.stage !== "CLOSED_LOST" && (
                  <p className="text-xs text-slate-400">
                    Only the owner{selected.owner?.name ? `, ${selected.owner.name},` : ""} can move this to the next stage.
                  </p>
                )}
                <div className="ws-stage-actions">
                  {nextStage && isOwner && (
                    <button
                      type="button"
                      className="ws-solid"
                      onClick={() => setStageMove({ to: nextStage, kind: "forward" })}
                    >
                      Move to {PIPELINE_STAGE_LABELS[nextStage]}
                    </button>
                  )}
                  {isOwner && selected.stage !== "CLOSED_WON" && selected.stage !== "CLOSED_LOST" && (
                    <button
                      type="button"
                      className="ws-ghost"
                      onClick={() => setStageMove({ to: "CLOSED_LOST", kind: "lost" })}
                    >
                      Mark lost
                    </button>
                  )}
                  {backTargets.length > 0 && (
                    <label className="ws-pane-note" style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
                      Admin move back
                      <select
                        value=""
                        onChange={(e) => {
                          const to = e.target.value as OpportunityStage;
                          if (to) setStageMove({ to, kind: "back" });
                        }}
                        style={{ border: "1px solid var(--ws-line)", borderRadius: 5, padding: "4px 8px", background: "white" }}
                      >
                        <option value="">Select stage</option>
                        {backTargets.map((s) => (
                          <option key={s} value={s}>{PIPELINE_STAGE_LABELS[s]}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {selected.stageEnteredAt && (
                  <p className="ws-pane-note" style={{ margin: 0 }}>
                    In this stage since {formatDateTime(selected.stageEnteredAt)}
                  </p>
                )}
                {selected.stage === "CLOSED_LOST" && (
                  <p className="ws-pane-note" style={{ margin: 0 }}>Closed lost. Only an admin can move it back.</p>
                )}
                {(getFollowUpStatus(selected.lastActivityDate || null) === "RED_FLAG"
                  || getFollowUpStatus(selected.lastActivityDate || null) === "WARNING") && (
                  <p className="ws-pane-note" style={{ margin: 0 }}>
                    {followUpReason(selected.lastActivityDate || null)} {RED_FLAG_EXPLANATION}
                  </p>
                )}
                <OpportunityTimeTracker opp={selected} />

                <div className="ws-card">
                  <div className="ws-facts">
                    <div className="ws-fact">
                      <div className="k">Value</div>
                      <div className="v">
                        {selected.value != null
                          ? `${selected.currency || ""} ${selected.value.toLocaleString()}`
                          : "—"}
                      </div>
                    </div>
                    <div className="ws-fact">
                      <div className="k">Target close</div>
                      <div className="v">{fmtShortDate(selected.closeDate)}</div>
                    </div>
                    <div className="ws-fact" style={{ gridColumn: "1 / -1" }}>
                      <div className="k">Next step</div>
                      <div className="v">{selected.nextStep || "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="ws-card">
                  <div className="ws-card-h">
                    <h3>Stage gate — {PIPELINE_STAGE_LABELS[selected.stage]}</h3>
                    <span className="ws-eyebrow">{doneGates}/{gates.length}</span>
                  </div>
                  {gates.length > 0 && (
                    <div className="ws-meter"><i style={{ width: `${gatePct}%` }} /></div>
                  )}
                  <div className="ws-gate">
                    {gates.length === 0 && (
                      <p className="ws-pane-note">No gates yet. Add exit criteria for this stage.</p>
                    )}
                    {gates.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className={`ws-gate-row ${g.done ? "on" : ""}`}
                        onClick={() => void toggleGate(g.id)}
                        disabled={!canEdit}
                      >
                        <span className="ws-box">✓</span>
                        <span className="txt">{g.text}</span>
                        {g.ownerLabel && <span className="owner">{g.ownerLabel}</span>}
                      </button>
                    ))}
                  </div>
                  {canEdit && (
                    <div className="ws-gate-add">
                      <input
                        value={gateDraft}
                        onChange={(e) => setGateDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void addGate()}
                        placeholder="Add stage gate…"
                      />
                      <button type="button" className="ws-ghost" onClick={() => void addGate()}>Add</button>
                    </div>
                  )}
                </div>

                <div className="ws-card">
                  <div className="ws-card-h"><h3>Who&apos;s on it</h3></div>
                  <div className="ws-people">
                    {selected.owner && (
                      <div className="ws-person">
                        <span className="ws-av own">{initials(selected.owner.name)}</span>
                        <span>
                          <span className="who">{selected.owner.name}</span><br />
                          <span className="role">Owner</span>
                        </span>
                        <span className="scope">full</span>
                      </div>
                    )}
                    {selected.coOwner && (
                      <div className="ws-person">
                        <span className="ws-av">{initials(selected.coOwner.name)}</span>
                        <span>
                          <span className="who">{selected.coOwner.name}</span><br />
                          <span className="role">Co-owner</span>
                        </span>
                        <span className="scope">full</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="ws-stream" aria-label="Activity workspace">
                <div className="ws-tabs" role="tablist">
                  {([
                    { id: "pulse" as const, label: "History", count: streamItems.length, alert: overdue },
                    { id: "minutes" as const, label: "Minutes", count: streamItems.filter((x) => x.kind === "minute").length },
                    { id: "tasks" as const, label: "Tasks", count: tasks.filter((t) => t.status !== "done").length, alert: overdue },
                    { id: "poc" as const, label: "PoC record", count: pocProducts.length },
                    { id: "calendar" as const, label: "Calendar", count: null as number | null },
                  ]).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="ws-tab"
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                      {t.count != null && (
                        <span className={`count ${t.alert ? "alert" : ""}`}>{t.count}</span>
                      )}
                    </button>
                  ))}
                  {canCreate && (
                    <button type="button" className="ws-solid newtask" onClick={() => setShowTask(true)}>
                      <Plus className="w-3.5 h-3.5" /> New task
                    </button>
                  )}
                </div>

                <div className="ws-pane">
                  {detailLoading && <p className="ws-pane-note">Loading workspace…</p>}

                  {tab === "pulse" && (
                    <>
                      <p className="ws-pane-note">
                        Full history for this opportunity — notes, activities, comments, tasks, and every stage change, with date and time.
                        {dayFilter ? "" : ` ${visibleStream.length} records.`}
                      </p>
                      <AttentionBand tasks={attention} onGoTasks={() => setTab("tasks")} />
                      {dayFilter && (
                        <button type="button" className="ws-ghost" onClick={() => setDayFilter(null)}>
                          Show all history · filtered to {dayFilter}
                        </button>
                      )}
                      <StreamTimeline items={visibleStream} empty="No history yet." />
                    </>
                  )}

                  {tab === "minutes" && (
                    <StreamTimeline items={visibleStream} empty="No meeting minutes linked yet." />
                  )}

                  {tab === "tasks" && (
                    <TasksPane
                      tasks={tasks}
                      canEdit={!!canEdit}
                      onCycleStatus={(t) => void cycleTaskStatus(t)}
                    />
                  )}

                  {tab === "poc" && (
                    <PocPane products={pocProducts} done={pocDone} oppId={selected.id} />
                  )}

                  {tab === "calendar" && (
                    <CalendarPane
                      month={calMonth}
                      onMonthChange={setCalMonth}
                      tasks={tasks}
                      items={streamItems}
                      selectedDay={dayFilter}
                      onSelectDay={(iso) => {
                        setDayFilter((d) => (d === iso ? null : iso));
                        setTab("pulse");
                      }}
                    />
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="ws-empty" style={{ gridColumn: "1 / -1" }}>
              Create an opportunity to start the workspace.
            </div>
          )}
        </main>
      </div>

      {showTask && selected && (
        <NewTaskDialog
          users={users}
          defaultOwnerId={selected.owner?.id || user?.uid || ""}
          onClose={() => setShowTask(false)}
          onCreate={(p) => void createTask(p)}
        />
      )}

      {stageMove && selected && (
        <StageMoveDialog
          from={selected.stage}
          to={stageMove.to}
          kind={stageMove.kind}
          onCancel={() => setStageMove(null)}
          onConfirm={confirmStageMove}
        />
      )}
    </div>
  );
}

function Avatar({ name, own, sm }: { name: string; own?: boolean; sm?: boolean }) {
  return <span className={`ws-av ${own ? "own" : ""} ${sm ? "sm" : ""}`} title={name}>{initials(name)}</span>;
}

function AttentionBand({ tasks, onGoTasks }: { tasks: OpportunityTask[]; onGoTasks: () => void }) {
  const over = tasks.filter((t) => taskDueBucket(t) === "over").length;
  const today = tasks.filter((t) => taskDueBucket(t) === "today").length;
  const soon = tasks.filter((t) => taskDueBucket(t) === "soon").length;
  if (!tasks.length) {
    return (
      <div className="ws-attn">
        <div className="ws-attn-h">
          <span className="lead" style={{ color: "var(--ws-good)" }}>Nothing overdue</span>
          <span className="split" />
          <span className="ws-pane-note">No tasks due in the next 7 days.</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`ws-attn ${over ? "urgent" : ""}`}>
      <div className="ws-attn-h">
        <span className="lead">{over ? "Needs attention" : "Coming up"}</span>
        <span className="split" />
        <span className="ws-tally">
          {over > 0 && <span className="od">{over} overdue</span>}
          {today > 0 && <span className="dt">{today} due today</span>}
          {soon > 0 && <span className="up">{soon} this week</span>}
        </span>
      </div>
      <div>
        {tasks.map((t) => {
          const st = taskDueBucket(t);
          return (
            <button key={t.id} type="button" className={`ws-arow ${st}`} onClick={onGoTasks}>
              <span className="stripe" />
              <Avatar name={t.responsible.name} sm />
              <span>
                <span className="t">{t.title}</span>
                <span className="m">
                  {t.lane} · {t.responsible.name}
                  {t.source === "customer" && <span className="ws-pill q">Customer</span>}
                  {t.status === "blocked" && <span className="ws-pill q">Blocked</span>}
                </span>
              </span>
              <span style={{ justifySelf: "end" }}>
                <span className={`ws-whenpill ${st}`}>{taskDueLabel(t)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StreamTimeline({ items, empty = "Nothing matches." }: { items: StreamItem[]; empty?: string }) {
  if (!items.length) return <div className="ws-empty">{empty}</div>;
  const icon: Record<StreamItem["kind"], string> = {
    minute: "M", update: "P", task: "T", poc: "L", stage: "S", comm: "C",
  };
  return (
    <div className="ws-tl">
      {items.map((e) => (
        <article key={e.id} className="ws-ev">
          <div className="when">
            {format(e.at, "dd MMM yyyy")}
            <em>{format(e.at, "HH:mm")}</em>
          </div>
          <div className="spinecol">
            <span className={`knob ${e.kind}`}>{icon[e.kind]}</span>
            <span className="rule" />
          </div>
          <div>
            <div>
              <span className="ttl">{e.title}</span>
              {e.stageLabel && <span className="ws-pill">{e.stageLabel}</span>}
              <span className="by">{e.by} · {formatDateTime(e.at)}</span>
            </div>
            {e.body && <p className="txt">{e.body}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

function TasksPane({
  tasks, canEdit, onCycleStatus,
}: {
  tasks: OpportunityTask[];
  canEdit: boolean;
  onCycleStatus: (t: OpportunityTask) => void;
}) {
  const order: Record<TaskStatus, number> = { blocked: 0, doing: 1, todo: 2, done: 3 };
  return (
    <>
      <p className="ws-pane-note">
        One responsible person per task, any number of assistants. Click status to advance. Overdue rows use the red edge.
      </p>
      {TASK_LANES.map((lane) => {
        const rows = tasks.filter((t) => t.lane === lane).sort(
          (a, b) => order[a.status] - order[b.status]
            || (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0),
        );
        if (!rows.length) return null;
        const od = rows.filter((t) => taskDueBucket(t) === "over").length;
        return (
          <div key={lane} className="ws-lane">
            <div className="ws-lane-h">
              <h4>{lane}</h4>
              <span className="line" />
              {od > 0 && <span className="ws-od-badge">{od} overdue</span>}
              <span className="ws-eyebrow">{rows.filter((r) => r.status !== "done").length} open</span>
            </div>
            {rows.map((t) => {
              const st = taskDueBucket(t);
              return (
                <div key={t.id} className={`ws-task s-${t.status} ${st === "over" ? "overdue" : ""}`}>
                  <Avatar name={t.responsible.name} />
                  <span>
                    <span className="t">{t.title}</span>
                    <span className="m">
                      {t.responsible.name}
                      {t.assistants.map((a) => (
                        <Avatar key={a.id} name={a.name} sm />
                      ))}
                      {t.source === "customer" && <span className="ws-pill q">Raised by customer</span>}
                    </span>
                  </span>
                  <span className="right">
                    <span className={`ws-whenpill ${st}`}>{taskDueLabel(t)}</span>
                    <button
                      type="button"
                      className="ws-status"
                      disabled={!canEdit}
                      onClick={() => onCycleStatus(t)}
                      title="Advance status"
                    >
                      {t.status === "doing" ? "in progress" : t.status}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      {!tasks.length && <div className="ws-empty">No tasks yet. Create one with + New task.</div>}
    </>
  );
}

function PocPane({
  products, done, oppId,
}: {
  products: OpportunityProduct[];
  done: number;
  oppId: string;
}) {
  if (!products.length) {
    return (
      <div className="ws-empty">
        No PoC products on this opportunity.
        <div style={{ marginTop: 10 }}>
          <Link to={`/opportunities/${oppId}`} className="ws-ghost">Open full record</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="ws-card">
      <div className="ws-card-h">
        <h3>PoC record</h3>
        <span className="ws-eyebrow">{done}/{products.length} complete</span>
      </div>
      <div className="ws-poc-grid">
        <div className="ws-kpi"><div className="k">Products requiring PoC</div><div className="v">{products.length}</div></div>
        <div className="ws-kpi"><div className="k">Completed</div><div className="v">{done}</div></div>
        <div className="ws-kpi"><div className="k">In progress</div><div className="v">{products.filter((p) => p.pocStatus === "IN_PROGRESS").length}</div></div>
        <div className="ws-kpi"><div className="k">Blocked</div><div className="v">{products.filter((p) => p.pocStatus === "BLOCKED").length}</div></div>
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {products.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
            <span style={{ fontWeight: 500 }}>{p.productName}</span>
            <span className="ws-pill">{p.pocStatus.replace("_", " ")}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Link to={`/opportunities/${oppId}`} className="ws-ghost">Update PoC tracker →</Link>
      </div>
    </div>
  );
}

function CalendarPane({
  month, onMonthChange, tasks, items, selectedDay, onSelectDay,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  tasks: OpportunityTask[];
  items: StreamItem[];
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const byDay: Record<string, { kind: "task" | "ev"; label: string; over?: boolean }[]> = {};
  const push = (iso: string, row: { kind: "task" | "ev"; label: string; over?: boolean }) => {
    (byDay[iso] = byDay[iso] || []).push(row);
  };
  tasks.forEach((t) => {
    if (!t.dueDate) return;
    push(format(t.dueDate, "yyyy-MM-dd"), { kind: "task", label: t.title, over: taskDueBucket(t) === "over" });
  });
  items.forEach((e) => {
    push(format(e.at, "yyyy-MM-dd"), { kind: "ev", label: e.title });
  });
  const today = new Date();

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="ws-ghost" onClick={() => onMonthChange(addMonths(month, -1))}>←</button>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>
          {format(month, "MMMM yyyy")}
        </h3>
        <button type="button" className="ws-ghost" onClick={() => onMonthChange(addMonths(month, 1))}>→</button>
        <span className="ws-pane-note">Task due dates and activity. Click a day to filter Pulse.</span>
      </div>
      <div className="ws-cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="dow">{d}</div>
        ))}
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const inMonth = isSameMonth(d, month);
          const entries = byDay[iso] || [];
          const hasOver = entries.some((e) => e.over);
          if (!inMonth) return <div key={iso} className="ws-day pad" />;
          return (
            <button
              key={iso}
              type="button"
              className={`ws-day ${isSameDay(d, today) ? "today" : ""} ${hasOver ? "hasover" : ""}`}
              aria-pressed={selectedDay === iso}
              onClick={() => onSelectDay(iso)}
            >
              <span className="n">{format(d, "d")}</span>
              {entries.slice(0, 3).map((it, i) => (
                <span
                  key={i}
                  className={`ec ${it.kind === "task" ? (it.over ? "ws-ec-over" : "ws-ec-due") : ""}`}
                  style={it.kind === "ev" ? { background: "var(--ws-accent-soft)", color: "var(--ws-accent)" } : undefined}
                >
                  {it.over ? "⚑ " : it.kind === "task" ? "◷ " : ""}{it.label}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </>
  );
}

function NewTaskDialog({
  users, defaultOwnerId, onClose, onCreate,
}: {
  users: UserProfile[];
  defaultOwnerId: string;
  onClose: () => void;
  onCreate: (p: {
    title: string;
    lane: TaskLane;
    responsibleId: string;
    assistIds: string[];
    due: string;
    source: TaskSource;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [lane, setLane] = useState<TaskLane>("Sales");
  const [responsibleId, setResponsibleId] = useState(defaultOwnerId);
  const [assistIds, setAssistIds] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [source, setSource] = useState<TaskSource>("internal");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDue(format(d, "yyyy-MM-dd"));
  }, []);

  const toggleAssist = (id: string) => {
    setAssistIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  return (
    <div className="ws-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="ws-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          setSaving(true);
          onCreate({ title, lane, responsibleId, assistIds, due, source });
        }}
      >
        <h2>New task</h2>
        <div className="ws-f">
          <label htmlFor="tTitle">Task</label>
          <input id="tTitle" required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Produce PoC report with raw clip appendix" />
        </div>
        <div className="ws-frow">
          <div className="ws-f">
            <label htmlFor="tWho">Responsible</label>
            <select id="tWho" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role ? ` · ${u.role}` : ""}</option>)}
            </select>
          </div>
          <div className="ws-f">
            <label htmlFor="tDue">Due date</label>
            <input id="tDue" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <div className="ws-f">
          <label>Assisted by</label>
          <div className="ws-picker">
            {users.filter((u) => u.id !== responsibleId).map((u) => (
              <button
                key={u.id}
                type="button"
                className="ws-pk"
                aria-pressed={assistIds.includes(u.id)}
                onClick={() => toggleAssist(u.id)}
              >
                <Avatar name={u.name} sm /> {u.name}
              </button>
            ))}
          </div>
        </div>
        <div className="ws-frow">
          <div className="ws-f">
            <label htmlFor="tLane">Lane</label>
            <select id="tLane" value={lane} onChange={(e) => setLane(e.target.value as TaskLane)}>
              {TASK_LANES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="ws-f">
            <label htmlFor="tSrc">Origin</label>
            <select id="tSrc" value={source} onChange={(e) => setSource(e.target.value as TaskSource)}>
              <option value="internal">Internal</option>
              <option value="customer">Raised by customer</option>
            </select>
          </div>
        </div>
        <div className="ws-dlg-foot">
          <button type="button" className="ws-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="ws-solid" disabled={saving}>
            {saving ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </div>
  );
}
