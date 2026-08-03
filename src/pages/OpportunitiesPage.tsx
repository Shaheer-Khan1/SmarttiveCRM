import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, LayoutGrid, Columns3 } from "lucide-react";
import { getOpportunities, getUsers, updateOpportunity, type Opportunity, type UserProfile, type OpportunityStage } from "@/lib/firestore";
import {
  getOpportunityProducts, getTags, logOpportunityEvent,
  type OpportunityProduct,
} from "@/lib/crm";
import { useAuth } from "@/context/AuthContext";
import FilterBar, { emptyFilters, type GlobalFilters } from "@/components/FilterBar";
import PipelineBoard, { OppCard } from "@/components/PipelineBoard";
import {
  canEditOpportunity, canChangeStage, canCreateCrmRecords,
} from "@/lib/permissions";
import { PIPELINE_STAGE_LABELS } from "@/lib/utils";

export default function OpportunitiesPage() {
  const { user, profile } = useAuth();
  const canCreate = canCreateCrmRecords(profile);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [productsByOpp, setProductsByOpp] = useState<Record<string, OpportunityProduct[]>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "list">("board");
  const [filters, setFilters] = useState<GlobalFilters>(emptyFilters());

  const load = async () => {
    setLoading(true);
    const [o, u, t] = await Promise.all([getOpportunities(), getUsers(), getTags()]);
    setOpps(o);
    setUsers(u);
    setTagNames(t.map((x) => x.name));
    const map: Record<string, OpportunityProduct[]> = {};
    await Promise.all(o.map(async (opp) => {
      map[opp.id] = await getOpportunityProducts(opp.id);
    }));
    setProductsByOpp(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return opps.filter((opp) => {
      if (filters.country && opp.country !== filters.country) return false;
      if (filters.region && opp.region !== filters.region) return false;
      if (filters.stage && opp.stage !== filters.stage) return false;
      if (filters.tag && !opp.tags.includes(filters.tag)) return false;
      if (filters.peopleId) {
        const hit = opp.owner?.id === filters.peopleId || opp.coOwner?.id === filters.peopleId;
        if (!hit) return false;
      }
      if (filters.dateFrom && opp.closeDate && opp.closeDate < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && opp.closeDate && opp.closeDate > new Date(filters.dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [opps, filters]);

  const canMove = (opp: Opportunity, to: OpportunityStage) => {
    const canEdit = canEditOpportunity(opp, profile, user?.uid);
    return canChangeStage(opp.stage, to, profile, canEdit);
  };

  const onStageChange = async (oppId: string, stage: OpportunityStage) => {
    const opp = opps.find((o) => o.id === oppId);
    if (!opp) return;
    const prev = opp.stage;
    await updateOpportunity(oppId, { stage });
    await logOpportunityEvent(oppId, {
      type: stage.startsWith("CLOSED") ? "CLOSED" : "STAGE_CHANGED",
      message: `Stage moved from ${PIPELINE_STAGE_LABELS[prev]} to ${PIPELINE_STAGE_LABELS[stage]}`,
      actorId: user?.uid || "",
      actorName: profile?.name || "User",
      meta: { from: prev, to: stage },
    });
    setOpps((list) => list.map((o) => (o.id === oppId ? { ...o, stage } : o)));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title">Opportunities</h1>
          <p className="page-subtitle">{filtered.length} opportunities</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-slate-100/90 rounded-xl p-0.5 flex-1 sm:flex-initial">
            <button onClick={() => setView("board")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${view === "board" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
              <Columns3 className="w-3.5 h-3.5" /> Board
            </button>
            <button onClick={() => setView("list")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${view === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
          </div>
          {canCreate && (
            <Link to="/opportunities/new" className="btn btn-primary whitespace-nowrap">
              <Plus className="w-4 h-4" />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">Add Opportunity</span>
            </Link>
          )}
        </div>
      </div>

      <FilterBar value={filters} onChange={setFilters} users={users} tags={tagNames} showStage />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === "board" ? (
        <PipelineBoard
          opportunities={filtered}
          productsByOpp={productsByOpp}
          canMove={canMove}
          onStageChange={onStageChange}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((opp) => (
            <OppCard key={opp.id} opp={opp} products={productsByOpp[opp.id] || []} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-center py-16 text-gray-400">No opportunities match filters</p>
          )}
        </div>
      )}
    </div>
  );
}
