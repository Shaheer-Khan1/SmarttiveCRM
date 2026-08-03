import { useMemo } from "react";
import {
  format, eachWeekOfInterval, endOfWeek, differenceInCalendarDays, isBefore, isAfter, min, max,
} from "date-fns";
import { Clock, Target, Package, ChevronRight } from "lucide-react";
import type { CalendarEvent, Opportunity, Product } from "@/lib/firestore";
import { expandRecurrence, getMaturityIndex, getMaturityLabel, getStatusLabel } from "@/lib/utils";

export type GanttKind = "event" | "opportunity" | "product";

export interface GanttRow {
  id: string;
  kind: GanttKind;
  group: string;
  title: string;
  subtitle?: string;
  assignee?: string;
  start: Date;
  end: Date;
  progress: number;
  label?: string;
  event?: CalendarEvent;
  opportunity?: Opportunity;
  product?: Product;
}

const GROUP_META: Record<string, { icon: typeof Clock; color: string; bar: string; barFill: string }> = {
  "Calendar Events": { icon: Clock, color: "text-blue-700 bg-blue-50 border-blue-100", bar: "bg-blue-200", barFill: "bg-blue-500" },
  Opportunities: { icon: Target, color: "text-emerald-700 bg-emerald-50 border-emerald-100", bar: "bg-emerald-200", barFill: "bg-emerald-500" },
  "Research": { icon: Package, color: "text-violet-700 bg-violet-50 border-violet-100", bar: "bg-violet-200", barFill: "bg-violet-500" },
};

function oppProgress(stage: Opportunity["stage"] | Opportunity["status"]): number {
  switch (stage) {
    case "CLOSED_WON":
    case "CLOSED_LOST":
    case "WON":
    case "LOST": return 100;
    case "NEGOTIATION": return 85;
    case "PROPOSAL": return 70;
    case "POC": return 55;
    case "QUALIFICATION":
    case "ON_HOLD": return 35;
    case "LEAD":
    case "ACTIVE": return 25;
    default: return 25;
  }
}

function eventProgress(start: Date, end: Date, status: string): number {
  if (status === "CANCELLED") return 0;
  const now = Date.now();
  if (now >= end.getTime()) return 100;
  if (now <= start.getTime()) return 0;
  const total = end.getTime() - start.getTime();
  return Math.round(((now - start.getTime()) / total) * 100);
}

function productProgress(p: Product): number {
  return Math.round(((getMaturityIndex(p.maturityLevel) + 1) / 6) * 100);
}

export function buildGanttRows(
  events: CalendarEvent[],
  opportunities: Opportunity[],
  products: Product[],
  rangeStart: Date,
  rangeEnd: Date,
  filter: "ALL" | GanttKind,
): GanttRow[] {
  const rows: GanttRow[] = [];
  const minSpan = 24 * 60 * 60 * 1000;

  const clip = (start: Date, end: Date) => {
    const s = max([start, rangeStart]);
    const e = min([end, rangeEnd]);
    if (isAfter(s, rangeEnd) || isBefore(e, rangeStart)) return null;
    return { start: s, end: e.getTime() > s.getTime() ? e : new Date(s.getTime() + minSpan) };
  };

  if (filter === "ALL" || filter === "event") {
    const seen = new Set<string>();
    events.forEach((ev) => {
      expandRecurrence(ev, rangeStart, rangeEnd).forEach((occ, i) => {
        const key = `${ev.id}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        const clipped = clip(occ.start, occ.end);
        if (!clipped) return;
        rows.push({
          id: key,
          kind: "event",
          group: "Calendar Events",
          title: ev.title,
          subtitle: ev.allDay ? "All day" : format(occ.start, "MMM d · h:mm a"),
          assignee: ev.attendees.map((a) => a.name).join(", ") || ev.createdByName,
          start: clipped.start,
          end: clipped.end,
          progress: eventProgress(occ.start, occ.end, ev.status),
          label: ev.status === "CANCELLED" ? "Cancelled" : undefined,
          event: ev,
        });
      });
    });
  }

  if (filter === "ALL" || filter === "opportunity") {
    opportunities.forEach((o) => {
      const start = o.createdAt;
      const end = o.lastActivityDate || o.updatedAt || o.createdAt;
      const clipped = clip(start, end.getTime() > start.getTime() ? end : new Date(start.getTime() + minSpan * 7));
      if (!clipped) return;
      rows.push({
        id: o.id,
        kind: "opportunity",
        group: "Opportunities",
        title: o.title,
        subtitle: o.customerName,
        assignee: [o.owner?.name, o.coOwner?.name].filter(Boolean).join(", ") || undefined,
        start: clipped.start,
        end: clipped.end,
        progress: oppProgress(o.stage),
        label: getStatusLabel(o.stage),
        opportunity: o,
      });
    });
  }

  if (filter === "ALL" || filter === "product") {
    products.forEach((p) => {
      const start = p.createdAt;
      const end = p.updatedAt || p.createdAt;
      const clipped = clip(start, end.getTime() > start.getTime() ? end : new Date(start.getTime() + minSpan * 14));
      if (!clipped) return;
      rows.push({
        id: p.id,
        kind: "product",
        group: "Research",
        title: p.name,
        subtitle: [p.vendorName, p.type === "SOFTWARE" ? "Software" : "Hardware"].filter(Boolean).join(" · "),
        assignee: p.assignedDeveloperName || p.createdByName,
        start: clipped.start,
        end: clipped.end,
        progress: productProgress(p),
        label: `${p.maturityLevel} · ${getMaturityLabel(p.maturityLevel)}`,
        product: p,
      });
    });
  }

  const order = ["Calendar Events", "Opportunities", "Research"];
  return rows.sort((a, b) => {
    const g = order.indexOf(a.group) - order.indexOf(b.group);
    if (g !== 0) return g;
    return a.start.getTime() - b.start.getTime();
  });
}

interface GanttTimelineProps {
  rows: GanttRow[];
  rangeStart: Date;
  rangeEnd: Date;
  loading?: boolean;
  onRowClick: (row: GanttRow) => void;
}

export default function GanttTimeline({ rows, rangeStart, rangeEnd, loading, onRowClick }: GanttTimelineProps) {
  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart) + 1);

  const weeks = useMemo(
    () => eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 0 }),
    [rangeStart, rangeEnd],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, GanttRow[]>();
    for (const r of rows) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  const barStyle = (start: Date, end: Date) => {
    const startOff = Math.max(0, differenceInCalendarDays(start, rangeStart));
    const endOff = Math.min(totalDays - 1, differenceInCalendarDays(end, rangeStart));
    const span = Math.max(1, endOff - startOff + 1);
    const left = (startOff / totalDays) * 100;
    const width = Math.max((span / totalDays) * 100, 1.5);
    return { left: `${left}%`, width: `${width}%` };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No items in this period for the selected filter.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex min-h-[420px]">
        {/* Task labels */}
        <div className="w-56 sm:w-64 flex-shrink-0 border-r border-gray-100 bg-gray-50/80">
          <div className="h-14 border-b border-gray-100 px-4 flex items-end pb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Task / Owner</span>
          </div>
          {grouped.map(([group, groupRows]) => {
            const meta = GROUP_META[group] || GROUP_META["Calendar Events"];
            const Icon = meta.icon;
            return (
              <div key={group}>
                <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b border-gray-100 ${meta.color}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{group}</span>
                  <span className="ml-auto text-[10px] opacity-70">{groupRows.length}</span>
                </div>
                {groupRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => onRowClick(row)}
                    className="w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-white transition-colors group min-h-[52px]">
                    <p className="text-xs font-medium text-gray-900 truncate group-hover:text-blue-600">{row.title}</p>
                    {row.subtitle && <p className="text-[10px] text-gray-500 truncate mt-0.5">{row.subtitle}</p>}
                    {row.assignee && <p className="text-[10px] text-gray-400 truncate mt-0.5">{row.assignee}</p>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Timeline grid */}
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Week headers */}
            <div className="h-14 border-b border-gray-100 flex">
              {weeks.map((w) => {
                const wEnd = endOfWeek(w, { weekStartsOn: 0 });
                const visibleStart = isBefore(w, rangeStart) ? rangeStart : w;
                const visibleEnd = isAfter(wEnd, rangeEnd) ? rangeEnd : wEnd;
                const days = differenceInCalendarDays(visibleEnd, visibleStart) + 1;
                const pct = (days / totalDays) * 100;
                return (
                  <div key={w.toISOString()} className="border-r border-gray-100 px-2 py-2 flex flex-col justify-end" style={{ width: `${pct}%` }}>
                    <span className="text-[10px] font-semibold text-gray-600">{format(w, "MMM d")}</span>
                    <span className="text-[9px] text-gray-400">{format(visibleEnd, "MMM d")}</span>
                  </div>
                );
              })}
            </div>

            {/* Day grid + bars */}
            {grouped.map(([group, groupRows]) => {
              const meta = GROUP_META[group] || GROUP_META["Calendar Events"];
              return (
                <div key={group}>
                  <div className={`h-9 border-b border-gray-100 ${meta.color.split(" ")[1]}`} />
                  {groupRows.map((row) => {
                    const pos = barStyle(row.start, row.end);
                    return (
                      <button key={row.id} type="button" onClick={() => onRowClick(row)}
                        className="relative w-full h-[52px] border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                        {/* vertical week lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {weeks.map((w) => {
                            const wEnd = endOfWeek(w, { weekStartsOn: 0 });
                            const visibleStart = isBefore(w, rangeStart) ? rangeStart : w;
                            const visibleEnd = isAfter(wEnd, rangeEnd) ? rangeEnd : wEnd;
                            const days = differenceInCalendarDays(visibleEnd, visibleStart) + 1;
                            return (
                              <div key={w.toISOString()} className="border-r border-gray-100/80 h-full" style={{ width: `${(days / totalDays) * 100}%` }} />
                            );
                          })}
                        </div>
                        {/* bar */}
                        <div className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md overflow-hidden shadow-sm" style={pos}>
                          <div className={`absolute inset-0 ${meta.bar} opacity-90`} />
                          <div className={`absolute inset-y-0 left-0 ${meta.barFill}`} style={{ width: `${row.progress}%` }} />
                          <div className="relative z-10 h-full flex items-center px-2 gap-1 min-w-0">
                            <span className="text-[10px] font-medium text-white truncate drop-shadow-sm">{row.progress}%</span>
                            {row.label && (
                              <span className="text-[9px] text-white/90 truncate hidden sm:inline">{row.label}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
        <span className="font-medium text-gray-600">Bar fill = progress</span>
        <span className="flex items-center gap-1"><span className="w-8 h-2 rounded bg-blue-500" /> Events</span>
        <span className="flex items-center gap-1"><span className="w-8 h-2 rounded bg-emerald-500" /> Opportunities</span>
        <span className="flex items-center gap-1"><span className="w-8 h-2 rounded bg-violet-500" /> Research (maturity)</span>
        <span className="ml-auto flex items-center gap-1 text-gray-400">Click a row to open <ChevronRight className="w-3 h-3" /></span>
      </div>
    </div>
  );
}
