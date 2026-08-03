import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameMonth, isSameDay, format,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, Clock, Users, Repeat, Bell, Building2, Trash2, X,
  Target, Package, Filter, CalendarDays, GanttChartSquare,
} from "lucide-react";
import GanttTimeline, { buildGanttRows, type GanttRow } from "@/components/GanttTimeline";
import {
  getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  getUsers, getOpportunities, getProducts,
  type CalendarEvent, type UserProfile, type Opportunity, type Product, type AssignedPerson,
} from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import {
  expandRecurrence, type EventOccurrence,
  RECURRENCE_OPTIONS, REMINDER_OPTIONS, formatDateTime,
  getStatusLabel, getProductStatusLabel,
} from "@/lib/utils";
import { canCreateCrmRecords, canDeleteRecord, canEditCalendarEvent } from "@/lib/permissions";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalKind = "event" | "opportunity" | "product";

interface CalItem {
  kind: CalKind;
  id: string;
  date: Date;
  title: string;
  occ?: EventOccurrence;
  opportunity?: Opportunity;
  product?: Product;
}

const KIND_CHIP: Record<CalKind, string> = {
  event: "bg-blue-100 text-blue-700",
  opportunity: "bg-emerald-100 text-emerald-700",
  product: "bg-violet-100 text-violet-700",
};

export default function CalendarPage() {
  const { user, profile, isAdmin } = useAuth();
  const canCreate = canCreateCrmRecords(profile);
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [filter, setFilter] = useState<"ALL" | CalKind>("ALL");
  const [viewMode, setViewMode] = useState<"calendar" | "timeline">("calendar");
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [modalDate, setModalDate] = useState<Date | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      getCalendarEvents({ userId: user?.uid, isAdmin }),
      getOpportunities(),
      getProducts(),
    ])
      .then(([ev, opps, prods]) => { setEvents(ev); setOpportunities(opps); setProducts(prods); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [user?.uid, isAdmin]);

  const gridStart = startOfWeek(startOfMonth(cursor));
  const gridEnd = endOfWeek(endOfMonth(cursor));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const items = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    const inRange = (d: Date) => d.getTime() >= gridStart.getTime() && d.getTime() <= gridEnd.getTime();

    if (filter === "ALL" || filter === "event") {
      events.forEach((e) => {
        expandRecurrence(e, gridStart, gridEnd).forEach((occ, i) => {
          out.push({ kind: "event", id: `e-${e.id}-${i}`, date: occ.start, title: e.title, occ });
        });
      });
    }
    if (filter === "ALL" || filter === "opportunity") {
      opportunities.forEach((o) => {
        const d = o.lastActivityDate || o.updatedAt || o.createdAt;
        if (d && inRange(d)) out.push({ kind: "opportunity", id: `o-${o.id}`, date: d, title: o.title, opportunity: o });
      });
    }
    if (filter === "ALL" || filter === "product") {
      products.forEach((p) => {
        const d = p.updatedAt || p.createdAt;
        if (d && inRange(d)) out.push({ kind: "product", id: `p-${p.id}`, date: d, title: p.name, product: p });
      });
    }
    return out;
  }, [events, opportunities, products, filter, gridStart, gridEnd]);

  const itemsOnDay = (day: Date) =>
    items.filter((it) => isSameDay(it.date, day)).sort((a, b) => a.date.getTime() - b.date.getTime());

  const selectedItems = itemsOnDay(selectedDay);

  const ganttRows = useMemo(
    () => buildGanttRows(events, opportunities, products, gridStart, gridEnd, filter),
    [events, opportunities, products, gridStart, gridEnd, filter],
  );

  const openNew = (date: Date) => {
    if (!canCreate) return;
    setEditEvent(null);
    setModalDate(date);
    setShowModal(true);
  };
  const openEdit = (e: CalendarEvent) => {
    if (!canEditCalendarEvent(e, profile, user?.uid)) return;
    setEditEvent(e);
    setModalDate(null);
    setShowModal(true);
  };

  const handleGanttClick = (row: GanttRow) => {
    if (row.kind === "event" && row.event) openEdit(row.event);
    else if (row.kind === "opportunity" && row.opportunity) navigate(`/opportunities/${row.opportunity.id}`);
    else if (row.kind === "product" && row.product) navigate(`/products/${row.product.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Calendar & Timeline</h1>
          <p className="text-gray-500 text-sm mt-1">Month view or Gantt timeline for events, opportunities & research</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-gray-200 bg-white p-0.5 shadow-sm">
            <button onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${viewMode === "calendar" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>
              <CalendarDays className="w-3.5 h-3.5" /> Calendar
            </button>
            <button onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${viewMode === "timeline" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>
              <GanttChartSquare className="w-3.5 h-3.5" /> Timeline
            </button>
          </div>
          {canCreate && (
            <button onClick={() => openNew(selectedDay)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Event
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
        <span className="text-xs font-medium text-gray-400 px-2 flex items-center gap-1"><Filter className="w-3.5 h-3.5" /> Show</span>
        {([
          { v: "ALL", label: "All", Icon: null },
          { v: "event", label: "Events", Icon: Clock },
          { v: "opportunity", label: "Opportunities", Icon: Target },
          { v: "product", label: "Research", Icon: Package },
        ] as const).map(({ v, label, Icon }) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {Icon && <Icon className="w-3.5 h-3.5" />} {label}
          </button>
        ))}
        <div className="ml-auto hidden sm:flex items-center gap-3 px-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Events</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Opportunities</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-400" /> Products</span>
        </div>
      </div>

      {/* Month navigation (shared) */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-4 py-3 shadow-sm">
        <h2 className="font-semibold text-gray-900">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setCursor((c) => subMonths(c, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button onClick={() => { setCursor(new Date()); setSelectedDay(new Date()); }}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            Today
          </button>
          <button onClick={() => setCursor((c) => addMonths(c, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {viewMode === "timeline" ? (
        <GanttTimeline
          rows={ganttRows}
          rangeStart={gridStart}
          rangeEnd={gridEnd}
          loading={loading}
          onRowClick={handleGanttClick}
        />
      ) : (
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dayItems = itemsOnDay(day);
                const isCurrentMonth = isSameMonth(day, cursor);
                const isSelected = isSameDay(day, selectedDay);
                const isToday = isSameDay(day, new Date());
                return (
                  <button key={day.toISOString()} onClick={() => setSelectedDay(day)}
                    onDoubleClick={() => openNew(day)}
                    className={`min-h-[68px] rounded-lg border p-1.5 text-left transition-colors ${
                      isSelected ? "border-blue-500 bg-blue-50"
                        : "border-gray-100 hover:border-gray-300"
                    } ${isCurrentMonth ? "" : "opacity-40"}`}>
                    <span className={`text-xs font-medium inline-flex w-5 h-5 items-center justify-center rounded-full ${
                      isToday ? "bg-blue-600 text-white" : "text-gray-700"
                    }`}>{format(day, "d")}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayItems.slice(0, 2).map((it) => (
                        <div key={it.id}
                          className={`truncate text-[10px] px-1 py-0.5 rounded ${
                            it.kind === "event" && it.occ?.event.status === "CANCELLED"
                              ? "bg-gray-100 text-gray-400 line-through"
                              : KIND_CHIP[it.kind]
                          }`}>
                          {it.title}
                        </div>
                      ))}
                      {dayItems.length > 2 && (
                        <div className="text-[10px] text-gray-400 px-1">+{dayItems.length - 2} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Day detail */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-1">{format(selectedDay, "EEEE, MMM d")}</h3>
          <p className="text-xs text-gray-400 mb-4">{selectedItems.length} item(s)</p>

          {selectedItems.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nothing scheduled</p>
              {canCreate && (
                <button onClick={() => openNew(selectedDay)} className="mt-3 text-xs text-blue-600 hover:underline">
                  + Add an event
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((it) => {
                if (it.kind === "event" && it.occ) {
                  const o = it.occ;
                  return (
                    <button key={it.id} onClick={() => openEdit(o.event)}
                      className="w-full text-left border border-gray-100 rounded-lg p-3 hover:border-blue-300 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />{o.event.title}
                        </span>
                        {o.event.recurrence !== "NONE" && <Repeat className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {o.event.allDay ? "All day" : `${format(o.start, "h:mm a")} – ${format(o.end, "h:mm a")}`}
                      </p>
                      {o.event.attendees.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {o.event.attendees.map((a) => a.name).join(", ")}
                        </p>
                      )}
                      {o.event.relatedProjectName && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {o.event.relatedProjectName}
                        </p>
                      )}
                      {o.event.reminder?.enabled && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <Bell className="w-3 h-3" /> Reminder set
                        </p>
                      )}
                    </button>
                  );
                }
                if (it.kind === "opportunity" && it.opportunity) {
                  const op = it.opportunity;
                  return (
                    <button key={it.id} onClick={() => navigate(`/opportunities/${op.id}`)}
                      className="w-full text-left border border-gray-100 rounded-lg p-3 hover:border-emerald-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="font-medium text-sm text-gray-900 truncate">{op.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> {op.customerName}</p>
                      <p className="text-xs text-gray-400 mt-1">Opportunity · {getStatusLabel(op.stage)}</p>
                    </button>
                  );
                }
                if (it.kind === "product" && it.product) {
                  const pr = it.product;
                  return (
                    <button key={it.id} onClick={() => navigate(`/products/${pr.id}`)}
                      className="w-full text-left border border-gray-100 rounded-lg p-3 hover:border-violet-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        <span className="font-medium text-sm text-gray-900 truncate">{pr.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{pr.type === "SOFTWARE" ? "Software" : "Hardware"}{pr.vendorName ? ` · ${pr.vendorName}` : ""}</p>
                      <p className="text-xs text-gray-400 mt-1">Research · {getProductStatusLabel(pr.status)}</p>
                    </button>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {showModal && (
        <EventModal
          event={editEvent}
          defaultDate={modalDate}
          currentUser={{ id: user!.uid, name: profile?.name || "User" }}
          canDelete={canDeleteRecord(profile, editEvent?.createdById, user?.uid)}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function EventModal({ event, defaultDate, currentUser, canDelete, onClose, onSaved }: {
  event: CalendarEvent | null;
  defaultDate: Date | null;
  currentUser: AssignedPerson;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const base = defaultDate || new Date();
  const defaultStart = event ? event.startDate : new Date(base.setHours(9, 0, 0, 0));
  const defaultEnd = event ? event.endDate : new Date(new Date(defaultStart).getTime() + 60 * 60 * 1000);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: event?.title || "",
    description: event?.description || "",
    start: toLocalInput(defaultStart),
    end: toLocalInput(defaultEnd),
    allDay: event?.allDay || false,
    recurrence: event?.recurrence || "NONE",
    recurrenceEnd: event?.recurrenceEndDate ? toLocalInput(event.recurrenceEndDate).slice(0, 10) : "",
    attendees: event?.attendees ? [...event.attendees] : [],
    relatedProjectId: event?.relatedProjectId || "",
    reminderEnabled: event?.reminder?.enabled ?? true,
    reminderMinutes: event?.reminder?.minutesBefore ?? 30,
    status: event?.status || "CONFIRMED",
  });

  useEffect(() => {
    getUsers().then(setUsers);
    getOpportunities().then(setOpps);
  }, []);

  const toggleAttendee = (u: UserProfile) => {
    setForm((f) => {
      const has = f.attendees.some((a) => a.id === u.id);
      return { ...f, attendees: has ? f.attendees.filter((a) => a.id !== u.id) : [...f.attendees, { id: u.id, name: u.name }] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const opp = opps.find((o) => o.id === form.relatedProjectId);
      const payload = {
        title: form.title,
        description: form.description,
        startDate: new Date(form.start),
        endDate: new Date(form.end),
        allDay: form.allDay,
        recurrence: form.recurrence as CalendarEvent["recurrence"],
        recurrenceEndDate: form.recurrence !== "NONE" && form.recurrenceEnd ? new Date(form.recurrenceEnd) : null,
        attendees: form.attendees,
        createdById: event?.createdById || currentUser.id,
        createdByName: event?.createdByName || currentUser.name,
        relatedProjectId: form.relatedProjectId || null,
        relatedProjectName: opp?.title || null,
        reminder: { enabled: form.reminderEnabled, minutesBefore: Number(form.reminderMinutes) },
        status: form.status as CalendarEvent["status"],
      };
      if (event) await updateCalendarEvent(event.id, payload);
      else await createCalendarEvent(payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!confirm("Delete this event?")) return;
    await deleteCalendarEvent(event.id);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{event ? "Edit Event" : "New Event"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Title *</label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Kickoff meeting with KFUPM"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))} />
            All-day event
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Start *</label>
              <input type="datetime-local" required value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">End *</label>
              <input type="datetime-local" required value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> Repeat</label>
              <select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as CalendarEvent["recurrence"] }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {RECURRENCE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {form.recurrence !== "NONE" && (
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1.5 block">Repeat until</label>
                <input type="date" value={form.recurrenceEnd} onChange={(e) => setForm((f) => ({ ...f, recurrenceEnd: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Attendees</label>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => {
                const selected = form.attendees.some((a) => a.id === u.id);
                return (
                  <button key={u.id} type="button" onClick={() => toggleAttendee(u)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}>
                    {u.name}
                  </button>
                );
              })}
              {users.length === 0 && <span className="text-xs text-gray-400">No users available</span>}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Related Opportunity</label>
            <select value={form.relatedProjectId} onChange={(e) => setForm((f) => ({ ...f, relatedProjectId: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">None</option>
              {opps.map((o) => <option key={o.id} value={o.id}>{o.title} — {o.customerName}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block flex items-center gap-1"><Bell className="w-3.5 h-3.5" /> Reminder</label>
              <select value={form.reminderEnabled ? String(form.reminderMinutes) : "off"}
                onChange={(e) => {
                  if (e.target.value === "off") setForm((f) => ({ ...f, reminderEnabled: false }));
                  else setForm((f) => ({ ...f, reminderEnabled: true, reminderMinutes: Number(e.target.value) }));
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="off">No reminder</option>
                {REMINDER_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CalendarEvent["status"] }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="CONFIRMED">Confirmed</option>
                <option value="TENTATIVE">Tentative</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {event && (
            <p className="text-xs text-gray-400">Created by {event.createdByName} · {formatDateTime(event.createdAt)}</p>
          )}

          <div className="flex justify-between items-center gap-3 pt-2">
            {event && canDelete ? (
              <button type="button" onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            ) : <span />}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : event ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
