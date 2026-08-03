import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import {
  getPocUpdates, addPocUpdate, POC_STATUS_FLOW,
  type OpportunityProduct, type OppPocStatus, type PocUpdate,
} from "@/lib/crm";
import { getPocStatusColors, getPocStatusLabel, formatDateTime } from "@/lib/utils";

interface Props {
  opportunityId: string;
  products: OpportunityProduct[];
  canUpdate: boolean;
  canReopen: boolean;
  actor: { id: string; name: string };
  isAdmin: boolean;
  onChanged: () => void;
}

export default function PocTracker({
  opportunityId, products, canUpdate, canReopen, actor, isAdmin, onChanged,
}: Props) {
  const pocProducts = products.filter((p) => p.requiresPoc);
  if (pocProducts.length === 0) {
    return <p className="text-sm text-gray-400">No products require PoC tracking.</p>;
  }

  return (
    <div className="space-y-2">
      {pocProducts.map((p) => (
        <PocRow
          key={p.id}
          opportunityId={opportunityId}
          product={p}
          defaultCollapsed={p.pocStatus === "COMPLETED"}
          canUpdate={canUpdate}
          canReopen={canReopen}
          actor={actor}
          isAdmin={isAdmin}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function PocRow({
  opportunityId, product, defaultCollapsed, canUpdate, canReopen, actor, isAdmin, onChanged,
}: {
  opportunityId: string;
  product: OpportunityProduct;
  defaultCollapsed: boolean;
  canUpdate: boolean;
  canReopen: boolean;
  actor: { id: string; name: string };
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const [updates, setUpdates] = useState<PocUpdate[]>([]);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<OppPocStatus>(product.pocStatus);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) getPocUpdates(opportunityId, product.id).then(setUpdates);
  }, [open, opportunityId, product.id]);

  const allowed = [...(POC_STATUS_FLOW[product.pocStatus] || [])];
  if (product.pocStatus === "COMPLETED" && canReopen) allowed.push("IN_PROGRESS");

  const submit = async () => {
    if (!note.trim() || !status) return;
    const isAdminOverride = isAdmin && (
      (product.pocStatus === "COMPLETED" && status !== "COMPLETED")
      || !POC_STATUS_FLOW[product.pocStatus]?.includes(status)
    );
    if (product.pocStatus === "COMPLETED" && status !== "COMPLETED" && !canReopen) return;
    setSaving(true);
    try {
      await addPocUpdate(opportunityId, product.id, {
        status,
        note: note.trim(),
        authorId: actor.id,
        authorName: actor.name,
        isAdminOverride: isAdminOverride || undefined,
      });
      setNote("");
      onChanged();
      const next = await getPocUpdates(opportunityId, product.id);
      setUpdates(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left">
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: product.color }} />
        <span className="font-medium text-sm text-gray-900 flex-1">{product.productName}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs border ${getPocStatusColors(product.pocStatus)}`}>
          {getPocStatusLabel(product.pocStatus)}
        </span>
      </button>
      {open && (
        <div className="p-4 space-y-4">
          {canUpdate && allowed.length > 0 && (
            <div className="space-y-2 border border-dashed border-gray-200 rounded-lg p-3">
              <div className="flex flex-wrap gap-2">
                {allowed.map((s) => (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${status === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                    {getPocStatusLabel(s)}
                  </button>
                ))}
              </div>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Progress note…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={submit} disabled={saving || !note.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" /> Add Update
              </button>
            </div>
          )}
          <div className="space-y-2">
            {updates.length === 0 ? (
              <p className="text-xs text-gray-400">No updates yet</p>
            ) : updates.map((u) => (
              <div key={u.id} className="text-sm border-l-2 border-gray-200 pl-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getPocStatusColors(u.status)}`}>
                    {getPocStatusLabel(u.status)}
                  </span>
                  <span className="text-xs text-gray-500">{u.authorName}</span>
                  <span className="text-xs text-gray-400">{formatDateTime(u.createdAt)}</span>
                  {u.isAdminOverride && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">Admin override</span>
                  )}
                </div>
                <p className="text-gray-700 mt-0.5">{u.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
