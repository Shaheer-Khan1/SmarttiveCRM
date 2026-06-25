import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Target, X } from "lucide-react";
import { getOpportunities, type Opportunity } from "@/lib/firestore";
import OpportunityCard from "@/components/OpportunityCard";
import { getFollowUpStatus, TEAM_MEMBERS } from "@/lib/utils";

export default function OpportunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [followUpFilter, setFollowUpFilter] = useState(searchParams.get("followUp") || "");
  const [tagFilter, setTagFilter] = useState("");

  const load = () => {
    setLoading(true);
    getOpportunities({ status: statusFilter !== "ALL" ? statusFilter : undefined })
      .then(setOpps)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const filtered = opps.filter((opp) => {
    if (followUpFilter) {
      const s = getFollowUpStatus(opp.lastActivityDate || null);
      if (followUpFilter === "RED_FLAG" && s !== "RED_FLAG" && s !== "NO_ACTIVITY") return false;
      if (followUpFilter === "WARNING" && s !== "WARNING") return false;
      if (followUpFilter === "HEALTHY" && s !== "HEALTHY") return false;
    }
    if (tagFilter && !opp.tags.includes(tagFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} opportunities</p>
        </div>
        <Link to="/opportunities/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Opportunity
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-white border border-gray-200 rounded-xl p-3">
        {/* Status */}
        <div className="flex gap-1 flex-wrap">
          {["ACTIVE", "WON", "LOST", "ON_HOLD", "ALL"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s === "ALL" ? "All" : s === "ON_HOLD" ? "On Hold" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-200 self-center" />

        {/* Follow-up */}
        <div className="flex gap-1">
          {[{ v: "", l: "All" }, { v: "RED_FLAG", l: "🔴 Red Flag" }, { v: "WARNING", l: "🟡 Warning" }, { v: "HEALTHY", l: "🟢 Healthy" }].map(({ v, l }) => (
            <button key={v} onClick={() => setFollowUpFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${followUpFilter === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {l}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-gray-200 self-center" />

        {/* Team */}
        <div className="flex gap-1 flex-wrap">
          {TEAM_MEMBERS.map((m) => (
            <button key={m} onClick={() => setTagFilter(tagFilter === m ? "" : m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tagFilter === m ? "bg-slate-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {m}
            </button>
          ))}
        </div>

        {(followUpFilter || tagFilter) && (
          <button onClick={() => { setFollowUpFilter(""); setTagFilter(""); setSearchParams({}); }}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No opportunities found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
        </div>
      )}
    </div>
  );
}
