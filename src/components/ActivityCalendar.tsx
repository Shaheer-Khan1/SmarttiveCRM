import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { Activity } from "@/lib/firestore";
import { getActivityTypeColor } from "@/lib/utils";

interface Props {
  activities: Activity[];
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date): string {
  return format(startOfDay(date), "yyyy-MM-dd");
}

export default function ActivityCalendar({ activities }: Props) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => dayKey(new Date()));

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const activityByDay = useMemo(() => {
    const byDay = new Map<string, Activity[]>();
    for (const activity of activities) {
      const key = dayKey(new Date(activity.date));
      const current = byDay.get(key) ?? [];
      current.push(activity);
      byDay.set(key, current);
    }
    return byDay;
  }, [activities]);

  const selectedActivities = activityByDay.get(selectedKey) ?? [];
  const hasAnyActivity = activities.length > 0;

  const days = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const key = dayKey(date);
    const count = activityByDay.get(key)?.length ?? 0;
    return { date, key, count };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Progress Calendar</h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-xs font-medium text-gray-700 min-w-[90px] text-center">
            {format(viewDate, "MMM yyyy")}
          </p>
          <button
            type="button"
            onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-gray-400 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, key, count }) => {
          const isCurrentMonth = date >= monthStart && date <= monthEnd;
          const isSelected = key === selectedKey;
          const isToday = key === dayKey(new Date());
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={[
                "relative rounded-lg h-9 text-xs border transition-colors",
                isCurrentMonth ? "text-gray-700" : "text-gray-300",
                isSelected ? "border-blue-400 bg-blue-50" : "border-transparent hover:border-gray-200",
              ].join(" ")}
            >
              {date.getDate()}
              {isToday && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500" />}
              {count > 0 && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-blue-600 font-semibold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-2">
          {format(new Date(selectedKey), "MMM d, yyyy")} · {selectedActivities.length} update(s)
        </p>
        {!hasAnyActivity && (
          <p className="text-xs text-gray-400">No activities recorded yet.</p>
        )}
        {hasAnyActivity && selectedActivities.length === 0 && (
          <p className="text-xs text-gray-400">No progress updates on this date.</p>
        )}
        <div className="space-y-1.5 max-h-36 overflow-auto pr-1">
          {selectedActivities.map((activity) => (
            <div key={activity.id} className="rounded-lg border border-gray-100 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getActivityTypeColor(activity.type)}`}>
                  {activity.type.replace("_", " ")}
                </span>
                <span className="text-[10px] text-gray-500">{format(new Date(activity.date), "h:mm a")}</span>
              </div>
              <p className="text-xs text-gray-700 mt-1">{activity.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
