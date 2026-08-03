import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent, useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PIPELINE_STAGES, TERMINAL_STAGES, type OpportunityStage } from "@/lib/crm";
import type { Opportunity } from "@/lib/firestore";
import type { OpportunityProduct } from "@/lib/crm";
import { PIPELINE_STAGE_LABELS, formatDate } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Props {
  opportunities: Opportunity[];
  productsByOpp: Record<string, OpportunityProduct[]>;
  canMove: (opp: Opportunity, to: OpportunityStage) => boolean;
  onStageChange: (oppId: string, stage: OpportunityStage) => Promise<void>;
}

export default function PipelineBoard({ opportunities, productsByOpp, canMove, onStageChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const map: Record<string, Opportunity[]> = {};
    for (const s of PIPELINE_STAGES) map[s] = [];
    for (const o of opportunities) {
      const stage = o.stage || "LEAD";
      (map[stage] || (map[stage] = [])).push(o);
    }
    return map;
  }, [opportunities]);

  const activeOpp = opportunities.find((o) => o.id === activeId) || null;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const oppId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const toStage = (PIPELINE_STAGES.includes(overId as OpportunityStage)
      ? overId
      : opportunities.find((o) => o.id === overId)?.stage) as OpportunityStage | undefined;
    if (!toStage) return;
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp || opp.stage === toStage) return;
    if (!canMove(opp, toStage)) return;
    await onStageChange(oppId, toStage);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="pipeline-scroll flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 min-h-[380px] sm:min-h-[420px]">
        {PIPELINE_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            items={byStage[stage] || []}
            productsByOpp={productsByOpp}
            terminal={TERMINAL_STAGES.includes(stage)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeOpp ? <OppCard opp={activeOpp} products={productsByOpp[activeOpp.id] || []} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stage, items, productsByOpp, terminal,
}: {
  stage: OpportunityStage;
  items: Opportunity[];
  productsByOpp: Record<string, OpportunityProduct[]>;
  terminal: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef}
      className={`flex-shrink-0 w-[min(18rem,85vw)] sm:w-72 rounded-2xl border ${terminal ? "border-slate-300 bg-slate-50/90" : "border-slate-200 bg-white/70"} ${isOver ? "ring-2 ring-blue-400" : ""} shadow-sm`}>
      <div className="px-3 py-2.5 border-b border-slate-200/80 flex items-center justify-between sticky top-0 bg-inherit rounded-t-2xl">
        <h3 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
          {PIPELINE_STAGE_LABELS[stage]}
        </h3>
        <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </div>
      <div className="p-2 space-y-2 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
        {items.map((opp) => (
          <DraggableCard key={opp.id} opp={opp} products={productsByOpp[opp.id] || []} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ opp, products }: { opp: Opportunity; products: OpportunityProduct[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <OppCard opp={opp} products={products} />
    </div>
  );
}

function Avatar({ name }: { name?: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className="w-6 h-6 rounded-full bg-slate-600 text-white text-[10px] font-semibold flex items-center justify-center" title={name}>
      {initial}
    </div>
  );
}

export function OppCard({
  opp, products, dragging,
}: {
  opp: Opportunity;
  products: OpportunityProduct[];
  dragging?: boolean;
}) {
  const navigate = useNavigate();
  const pocNeeded = products.filter((p) => p.requiresPoc);
  const pocDone = pocNeeded.filter((p) => p.pocStatus === "COMPLETED").length;
  const engagementTag = opp.tags[0];

  return (
    <div
      onClick={() => !dragging && navigate(`/opportunities/${opp.id}`)}
      className={`bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer ${dragging ? "shadow-lg rotate-1" : ""}`}
    >
      <p className="text-sm font-semibold text-slate-900 line-clamp-2 mb-2">{opp.title}</p>
      <div className="flex items-center gap-1.5 mb-2">
        <Avatar name={opp.owner?.name} />
        {opp.coOwner && <Avatar name={opp.coOwner.name} />}
        <span className="text-[11px] text-gray-500 ml-1 truncate">{opp.country || "—"}</span>
      </div>
      {opp.closeDate && (
        <p className="text-[11px] text-gray-500 mb-2">Close {formatDate(opp.closeDate)}</p>
      )}
      <div className="flex flex-wrap gap-1 mb-2">
        {products.slice(0, 4).map((p) => (
          <span key={p.id} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
            style={{ background: p.color }}>{p.productName}</span>
        ))}
        {engagementTag && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {engagementTag}
          </span>
        )}
      </div>
      {pocNeeded.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>PoC {pocDone}/{pocNeeded.length}</span>
          <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${(pocDone / pocNeeded.length) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
