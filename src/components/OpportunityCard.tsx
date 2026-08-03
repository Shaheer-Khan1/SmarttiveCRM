import { useNavigate } from "react-router-dom";
import { Calendar, Users } from "lucide-react";
import StatusBadge from "./StatusBadge";
import FollowUpBadge from "./FollowUpBadge";
import { getFollowUpStatus, formatTimeAgo, formatDate } from "@/lib/utils";
import type { Opportunity } from "@/lib/firestore";

export default function OpportunityCard({ opp }: { opp: Opportunity }) {
  const navigate = useNavigate();
  const followUpStatus = getFollowUpStatus(opp.lastActivityDate || null);

  return (
    <div onClick={() => navigate(`/opportunities/${opp.id}`)}
      className="panel p-4 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer h-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
            {opp.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{opp.customerName}{opp.country ? ` · ${opp.country}` : ""}</p>
        </div>
        <StatusBadge status={opp.stage} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <FollowUpBadge status={followUpStatus} />
        {opp.value != null && (
          <span className="text-xs text-gray-500">{opp.value.toLocaleString()} {opp.currency}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <Users className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {opp.owner?.name || "Unassigned"}
            {opp.coOwner ? ` + ${opp.coOwner.name}` : ""}
          </span>
        </div>
        {opp.closeDate ? (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(opp.closeDate)}
          </span>
        ) : opp.lastActivityDate ? (
          <span>{formatTimeAgo(opp.lastActivityDate)}</span>
        ) : null}
      </div>

      {opp.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {opp.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
