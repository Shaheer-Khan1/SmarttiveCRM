import { differenceInCalendarDays } from "date-fns";
import type { Opportunity } from "@/lib/firestore";
import { FORWARD_STAGES } from "@/lib/permissions";
import { formatDate, PIPELINE_STAGE_LABELS } from "@/lib/utils";

export default function OpportunityTimeTracker({ opp }: { opp: Opportunity }) {
  const start = opp.createdAt;
  const close = opp.closeDate || null;
  const now = new Date();
  const elapsed = Math.max(differenceInCalendarDays(now, start), 0);
  const inStage = Math.max(differenceInCalendarDays(now, opp.stageEnteredAt || start), 0);
  const remaining = close ? differenceInCalendarDays(close, now) : null;
  const span = close ? Math.max(differenceInCalendarDays(close, start), 1) : null;
  const pct = span == null ? null : Math.min(100, Math.max(0, Math.round((elapsed / span) * 100)));
  const currentIdx = FORWARD_STAGES.indexOf(opp.stage);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Timeline</h2>
        <span className="text-xs text-slate-500">
          {pct == null ? "No close date" : `${pct}% of the way to close`}
        </span>
      </div>
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>Created {formatDate(start)}</span>
        <span>{close ? `Close ${formatDate(close)}` : "Close date not set"}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${remaining != null && remaining < 0 ? "bg-red-500" : "bg-blue-600"}`}
          style={{ width: `${pct ?? Math.min(100, (currentIdx + 1) / FORWARD_STAGES.length * 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Days open" value={String(elapsed)} />
        <Metric label="In this stage" value={`${inStage}d`} />
        <Metric
          label="To close"
          value={remaining == null ? "—" : remaining < 0 ? `${-remaining}d over` : `${remaining}d`}
        />
      </div>
      <div className="flex gap-1" aria-label="Stage progress">
        {FORWARD_STAGES.map((s, i) => {
          const state = currentIdx >= 0 && i < currentIdx ? "done" : i === currentIdx ? "now" : "later";
          return (
            <div key={s} className="flex-1 min-w-0" title={PIPELINE_STAGE_LABELS[s]}>
              <div className={`h-1.5 rounded-full ${state === "later" ? "bg-slate-200" : state === "now" ? "bg-blue-600" : "bg-blue-300"}`} />
              <p className={`mt-1 text-[10px] truncate ${state === "now" ? "text-blue-700 font-semibold" : "text-slate-400"}`}>
                {PIPELINE_STAGE_LABELS[s]}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        In {PIPELINE_STAGE_LABELS[opp.stage] || opp.stage} for {inStage} day{inStage === 1 ? "" : "s"}.
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
