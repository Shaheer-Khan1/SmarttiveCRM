import { useState } from "react";
import { format } from "date-fns";
import type { OpportunityStage } from "@/lib/firestore";
import type { StageMoveKind } from "@/lib/permissions";
import { PIPELINE_STAGE_LABELS } from "@/lib/utils";

interface Props {
  from: OpportunityStage;
  to: OpportunityStage;
  kind: Exclude<StageMoveKind, "same" | "blocked">;
  onCancel: () => void;
  onConfirm: (movedAt: Date) => Promise<void> | void;
}

export default function StageMoveDialog({ from, to, kind, onCancel, onConfirm }: Props) {
  const now = new Date();
  const [date, setDate] = useState(format(now, "yyyy-MM-dd"));
  const [time, setTime] = useState(format(now, "HH:mm"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fromLabel = PIPELINE_STAGE_LABELS[from] || from;
  const toLabel = PIPELINE_STAGE_LABELS[to] || to;

  const title = kind === "back"
    ? "Move this stage back?"
    : kind === "lost"
      ? "Mark this opportunity lost?"
      : "Move to the next stage?";

  const body = kind === "back"
    ? `Confirm moving back from ${fromLabel} to ${toLabel}. Only an admin can move a stage backward.`
    : kind === "lost"
      ? `Confirm marking this opportunity as Closed Lost. It is currently in ${fromLabel}. An admin is required to move it back.`
      : `Confirm moving from ${fromLabel} to ${toLabel}. An opportunity can only move one stage forward.`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time) {
      setError("Date and time are both required.");
      return;
    }
    const movedAt = new Date(`${date}T${time}`);
    if (Number.isNaN(movedAt.getTime())) {
      setError("Enter a valid date and time.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm(movedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the stage.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/45 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stage-move-title"
        className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6 space-y-4"
      >
        <div>
          <h2 id="stage-move-title" className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600 mt-1.5">{body}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">Date</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">Time</span>
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-slate-600">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
