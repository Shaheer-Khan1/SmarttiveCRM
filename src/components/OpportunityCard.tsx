import { useNavigate } from "react-router-dom";
import { Calendar, Users, ArrowRight } from "lucide-react";
import StatusBadge from "./StatusBadge";
import FollowUpBadge from "./FollowUpBadge";
import { getFollowUpStatus, formatTimeAgo } from "@/lib/utils";
import type { Opportunity } from "@/lib/firestore";

export default function OpportunityCard({ opp }: { opp: Opportunity }) {
  const navigate = useNavigate();
  const followUpStatus = getFollowUpStatus(opp.lastActivityDate || null);

  return (
    <div onClick={() => navigate(`/opportunities/${opp.id}`)}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors truncate">
            {opp.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{opp.customerName}</p>
        </div>
        <StatusBadge status={opp.status} />
      </div>

      {opp.solution && (
        <p className="text-xs text-gray-600 mb-3 truncate">
          <span className="font-medium">Solution:</span> {opp.solution}
        </p>
      )}

      {opp.nextStep && (
        <div className="flex items-start gap-1.5 mb-3 bg-blue-50 rounded-lg px-2.5 py-1.5">
          <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 line-clamp-2">
            <span className="font-medium">Next:</span> {opp.nextStep}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {opp.assignedTo.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {opp.assignedTo.length === 1
                ? opp.assignedTo[0].name
                : `${opp.assignedTo[0].name} +${opp.assignedTo.length - 1}`}
            </span>
          )}
          {opp.lastActivityDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatTimeAgo(opp.lastActivityDate)}
            </span>
          )}
        </div>
        <FollowUpBadge status={followUpStatus} />
      </div>

      {opp.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {opp.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
