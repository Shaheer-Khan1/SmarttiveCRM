import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, LayoutGrid, Columns3 } from "lucide-react";
import { getOpportunities, getUsers, type Opportunity, type UserProfile, type OpportunityStage } from "@/lib/firestore";
import {
  getOpportunityProducts, getTags, getCatalogProducts, moveOpportunityStage,
  type OpportunityProduct,
} from "@/lib/crm";
import { useAuth } from "@/context/AuthContext";
import FilterBar, { emptyFilters, opportunityMatchesFilters, type GlobalFilters } from "@/components/FilterBar";
import PipelineBoard, { OppCard } from "@/components/PipelineBoard";
import StageMoveDialog from "@/components/StageMoveDialog";
import {
  canChangeStage, canCreateCrmRecords, stageMoveKind,
  type StageMoveKind,
} from "@/lib/permissions";
import { byOpportunityTitle } from "@/lib/utils";

export default function OpportunitiesPage() {
  const { user, profile } = useAuth();
  const canCreate = canCreateCrmRecords(profile);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [productsByOpp, setProductsByOpp] = useState<Record<string, OpportunityProduct[]>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "list">("board");
  const [filters, setFilters] = useState<GlobalFilters>(emptyFilters());
  const [stageMove, setStageMove] = useState<{
    opp: Opportunity;
    to: OpportunityStage;
    kind: Exclude<StageMoveKind, "same" | "blocked">;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    const [o, u, t, catalog] = await Promise.all([
      getOpportunities(), getUsers(), getTags(), getCatalogProducts({ activeOnly: true }),
    ]);
    setOpps(o);
    setUsers(u);
    setTagNames(t.map((x) => x.name));
    setProductNames(catalog.map((p) => p.name).sort((a, b) => a.localeCompare(b)));
    const map: Record<string, OpportunityProduct[]> = {};
    await Promise.all(o.map(async (opp) => {
      map[opp.id] = await getOpportunityProducts(opp.id);
    }));
    setProductsByOpp(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return opps
      .filter((opp) => opportunityMatchesFilters(
        opp,
        filters,
        (productsByOpp[opp.id] || []).map((p) => p.productName),
      ))
      .sort(byOpportunityTitle);
  }, [opps, filters, productsByOpp]);

  const canMove = (opp: Opportunity, to: OpportunityStage) => {
    const isOwner = !!user && opp.owner?.id === user.uid;
    return canChangeStage(opp.stage, to, profile, isOwner);
  };

  const onStageChange = async (oppId: string, stage: OpportunityStage) => {
    const opp = opps.find((o) => o.id === oppId);
    if (!opp || opp.stage === stage) return;
    const kind = stageMoveKind(opp.stage, stage);
    if (kind === "blocked" || kind === "same") return;
    setStageMove({ opp, to: stage, kind });
  };

  const confirmStageMove = async (movedAt: Date) => {
    if (!stageMove) return;
    await moveOpportunityStage({
      opportunityId: stageMove.opp.id,
      from: stageMove.opp.stage,
      to: stageMove.to,
      movedAt,
      actorId: user?.uid || "",
      actorName: profile?.name || "User",
    });
    setOpps((list) => list.map((o) => (
      o.id === stageMove.opp.id ? { ...o, stage: stageMove.to, stageEnteredAt: movedAt } : o
    )));
    setStageMove(null);
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

      <FilterBar value={filters} onChange={setFilters} users={users} tags={tagNames} products={productNames} showStage />

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

      {stageMove && (
        <StageMoveDialog
          from={stageMove.opp.stage}
          to={stageMove.to}
          kind={stageMove.kind}
          onCancel={() => setStageMove(null)}
          onConfirm={confirmStageMove}
        />
      )}
    </div>
  );
}
