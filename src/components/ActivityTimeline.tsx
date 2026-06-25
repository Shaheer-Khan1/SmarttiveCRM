import { useState } from "react";
import { Paperclip, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { getActivityTypeColor, getActivityTypeIcon, formatDateTime } from "@/lib/utils";
import type { Activity } from "@/lib/firestore";

interface Props {
  activities: Activity[];
  isAdmin: boolean;
  onDelete?: (id: string) => void;
}

export default function ActivityTimeline({ activities, isAdmin, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-sm">No activities recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[22px] top-4 bottom-4 w-px bg-gray-200" />
      <div className="space-y-1">
        {activities.map((activity) => {
          const isExpanded = expanded.has(activity.id);
          const hasExtra = activity.notes || (activity.attachments && activity.attachments.length > 0);
          return (
            <div key={activity.id} className="flex gap-4">
              <div className="flex-shrink-0 w-11 flex items-start justify-center pt-4">
                <div className="w-5 h-5 rounded-full bg-white border-2 border-blue-400 z-10 flex items-center justify-center text-xs">
                  {getActivityTypeIcon(activity.type)}
                </div>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 mb-3 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getActivityTypeColor(activity.type)}`}>
                      {activity.type.replace("_", " ")}
                    </span>
                    <span className="text-xs text-gray-500">{formatDateTime(activity.date)}</span>
                    {activity.createdByName && (
                      <span className="text-xs text-gray-400">by {activity.createdByName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasExtra && (
                      <button onClick={() => toggle(activity.id)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                    {isAdmin && onDelete && (
                      <button onClick={() => onDelete(activity.id)}
                        className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-gray-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-800 mt-2">{activity.summary}</p>
                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {activity.notes && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{activity.notes}</p>
                    )}
                    {activity.attachments && activity.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {activity.attachments.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100 transition-colors">
                            <Paperclip className="w-3.5 h-3.5" />
                            {f.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
