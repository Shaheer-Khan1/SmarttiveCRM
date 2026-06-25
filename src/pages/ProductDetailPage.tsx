import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit2, Trash2, Code, Cpu, Globe, ExternalLink, Store, User,
  FlaskConical, Upload, FileText, MessageSquare, Send, X, History, Plus, Download,
  Gauge, Award, Grid2x2, Gavel,
} from "lucide-react";
import {
  getProduct, updateProduct, deleteProduct,
  getProductPOCs, createProductPOC, updateProductPOC, deleteProductPOC,
  getProductComments, addProductComment, deleteProductComment,
  getProductDocuments, uploadProductDocument, deleteProductDocument,
  getActivityLogs, logActivity, createNotification, getUsers,
  type Product, type ProductPOC, type ProductComment, type ProductDocument,
  type ActivityLog, type ProductStatus, type UserProfile, type ProductPriority,
  type MaturityLevel, type EvaluationScore, type CompatibilityEntry,
} from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import {
  PRODUCT_STATUSES, getProductStatusLabel, getProductStatusColors,
  getPriorityColors, getPocStatusColors, POC_STATUSES, POC_STAGES, getPocStageLabel, PRODUCT_PRIORITIES,
  MATURITY_LEVELS, getMaturityLabel, getMaturityIndex, getMaturityColors,
  computeScore, getScoreColors, getCompatibilityColors, getCompatibilityLabel,
  formatTimeAgo, formatDate,
} from "@/lib/utils";

const TABS = ["Overview", "Technical", "Compatibility", "Commercial", "Evaluation", "Development"] as const;
type Tab = typeof TABS[number];

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [pocs, setPocs] = useState<ProductPOC[]>([]);
  const [comments, setComments] = useState<ProductComment[]>([]);
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showPocModal, setShowPocModal] = useState(false);
  const [editPoc, setEditPoc] = useState<ProductPOC | null>(null);
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);

  const me = { id: user?.uid || "", name: profile?.name || "User" };

  const load = async () => {
    const [p, pc, cm, dc, lg] = await Promise.all([
      getProduct(id!), getProductPOCs(id!), getProductComments(id!),
      getProductDocuments(id!), getActivityLogs({ entityType: "product", entityId: id! }),
    ]);
    setProduct(p); setPocs(pc); setComments(cm); setDocuments(dc); setLogs(lg);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const refreshLogs = async () => setLogs(await getActivityLogs({ entityType: "product", entityId: id! }));

  const handleStatusChange = async (status: ProductStatus) => {
    if (!product || status === product.status) return;
    await updateProduct(id!, { status });
    await logActivity({
      entityType: "product", entityId: id!, action: "Changed status",
      performedById: me.id, performedByName: me.name,
      oldValue: getProductStatusLabel(product.status), newValue: getProductStatusLabel(status),
    });
    const recipients = [product.assignedDeveloperId, product.reviewerId, product.createdById].filter(Boolean) as string[];
    await createNotification(recipients, `"${product.name}" status → ${getProductStatusLabel(status)}`, undefined, `/products/${id}`);
    load();
  };

  const handleMaturityChange = async (level: MaturityLevel) => {
    if (!product || level === product.maturityLevel) return;
    await updateProduct(id!, { maturityLevel: level });
    await logActivity({
      entityType: "product", entityId: id!, action: "Advanced maturity",
      performedById: me.id, performedByName: me.name,
      oldValue: `${product.maturityLevel} ${getMaturityLabel(product.maturityLevel)}`,
      newValue: `${level} ${getMaturityLabel(level)}`,
    });
    load();
  };

  const handleRecordDecision = async () => {
    if (!product) return;
    const text = prompt("Record a decision (e.g. Approved for KFUPM bid, Rejected — price too high):");
    if (!text || !text.trim()) return;
    await logActivity({
      entityType: "product", entityId: id!, action: "Decision",
      performedById: me.id, performedByName: me.name, newValue: text.trim(),
    });
    const recipients = [product.assignedDeveloperId, product.reviewerId, product.createdById].filter(Boolean) as string[];
    await createNotification(recipients, `Decision recorded on "${product.name}"`, text.trim(), `/products/${id}`);
    refreshLogs();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this product and all its POCs, comments and documents?")) return;
    await deleteProduct(id!);
    navigate("/products");
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !product) return;
    await addProductComment(id!, newComment.trim(), me.id, me.name);
    setNewComment("");
    setComments(await getProductComments(id!));
    const recipients = [product.assignedDeveloperId, product.reviewerId, product.createdById].filter((r) => r && r !== me.id) as string[];
    await createNotification(recipients, `New comment on "${product.name}"`, newComment.trim(), `/products/${id}`);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadProductDocument(file, id!, me);
      await logActivity({ entityType: "product", entityId: id!, action: "Uploaded document", performedById: me.id, performedByName: me.name, newValue: file.name });
      setDocuments(await getProductDocuments(id!));
      refreshLogs();
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!product) return <div className="text-center py-16 text-gray-500">Product not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate("/products")} className="p-2 hover:bg-gray-100 rounded-lg mt-1"><ArrowLeft className="w-4 h-4 text-gray-600" /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${product.type === "SOFTWARE" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}>
              {product.type === "SOFTWARE" ? <Code className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getProductStatusColors(product.status)}`}>{getProductStatusLabel(product.status)}</span>
            {product.priority && <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColors(product.priority)}`}>{product.priority}</span>}
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {[product.category, product.vendorName, product.version && `v${product.version}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4" /> Edit</button>
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {/* Maturity ladder */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Gauge className="w-4 h-4 text-gray-500" /> Research Maturity</h3>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getMaturityColors(product.maturityLevel)}`}>
            {product.maturityLevel} · {getMaturityLabel(product.maturityLevel)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {MATURITY_LEVELS.map((m, i) => {
            const reached = i <= getMaturityIndex(product.maturityLevel);
            return (
              <button key={m.value} disabled={!isAdmin} onClick={() => handleMaturityChange(m.value)}
                title={`${m.value} · ${m.label} — ${m.description}`}
                className={`group flex-1 ${isAdmin ? "cursor-pointer" : "cursor-default"}`}>
                <div className={`h-2 rounded-full transition-colors ${reached ? "bg-blue-500" : "bg-gray-100"}`} />
                <span className={`mt-1.5 block text-center text-[10px] font-medium ${reached ? "text-blue-600" : "text-gray-400"}`}>{m.value}</span>
                <span className="block text-center text-[9px] text-gray-400 leading-tight">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status workflow */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-gray-400 px-1">Status</span>
          {PRODUCT_STATUSES.map((s) => (
            <button key={s} onClick={() => handleStatusChange(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${product.status === s ? getProductStatusColors(s) + " border-current" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
              {getProductStatusLabel(s)}
            </button>
          ))}
          <button onClick={handleRecordDecision}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-white hover:bg-slate-900">
            <Gavel className="w-3.5 h-3.5" /> Record Decision
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="p-5 space-y-4">
              {tab === "Overview" && (
                <>
                  {product.website && <InfoLink label="Website" value={product.website} />}
                  <ListBlock label="Documentation Links" items={product.documentationLinks} links />
                  <TextBlock label="Notes" value={product.notes} />
                  {!product.website && product.documentationLinks.length === 0 && !product.notes && <Empty />}
                </>
              )}
              {tab === "Technical" && (
                <>
                  <ListBlock label="Features" items={product.features} />
                  <ListBlock label="Specifications" items={product.specifications} />
                  <TextBlock label="Integration Complexity" value={product.integrationComplexity} />
                  <TextBlock label="Compatibility" value={product.compatibility} />
                  <ListBlock label="Supported APIs" items={product.supportedApis} />
                  <ListBlock label="Dependencies" items={product.dependencies} />
                </>
              )}
              {tab === "Compatibility" && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5"><Grid2x2 className="w-3.5 h-3.5" /> Technical Compatibility Matrix</p>
                  {product.compatibilityMatrix.length === 0 ? <Empty /> : (
                    <div className="overflow-hidden rounded-xl border border-gray-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-left text-xs text-gray-500">
                            <th className="px-3 py-2 font-medium">Item</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                            <th className="px-3 py-2 font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {product.compatibilityMatrix.map((c, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-gray-800">{c.item}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getCompatibilityColors(c.status)}`}>{getCompatibilityLabel(c.status)}</span>
                              </td>
                              <td className="px-3 py-2 text-gray-500 text-xs">{c.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {tab === "Commercial" && (
                <div className="grid grid-cols-2 gap-4">
                  <TextBlock label="Licensing Model" value={product.licenseType} />
                  <TextBlock label="Pricing" value={product.pricing} />
                  <TextBlock label="Support Availability" value={product.supportInfo} />
                  <TextBlock label="Subscription Details" value={product.subscriptionDetails} />
                </div>
              )}
              {tab === "Evaluation" && (
                <>
                  <ScoreSummary scores={product.scores} />
                  <div className="grid grid-cols-2 gap-4">
                    <ListBlock label="Pros" items={product.pros} tone="green" />
                    <ListBlock label="Cons" items={product.cons} tone="red" />
                    <ListBlock label="Risks" items={product.risks} tone="amber" />
                    <ListBlock label="Limitations" items={product.limitations} />
                  </div>
                  <TextBlock label="Comparison Notes" value={product.comparisonNotes} />
                </>
              )}
              {tab === "Development" && (
                <div className="grid grid-cols-2 gap-4">
                  <TextBlock label="Development Status" value={product.developmentStatus} />
                  <TextBlock label="Integration Status" value={product.integrationStatus} />
                  <TextBlock label="Assigned Developer" value={product.assignedDeveloperName || undefined} />
                  <TextBlock label="Reviewer" value={product.reviewerName || undefined} />
                  <TextBlock label="Priority" value={product.priority} />
                </div>
              )}
            </div>
          </div>

          {/* POCs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FlaskConical className="w-4 h-4 text-gray-500" /> Proof of Concept
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{pocs.length}</span>
              </h2>
              <button onClick={() => { setEditPoc(null); setShowPocModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"><Plus className="w-3.5 h-3.5" /> Add POC</button>
            </div>
            {pocs.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No POCs recorded.</p> : (
              <div className="space-y-3">
                {pocs.map((p) => (
                  <div key={p.id} className="border border-gray-100 rounded-lg p-3 group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border border-indigo-200 bg-indigo-50 text-indigo-700">{p.stage} · {getPocStageLabel(p.stage)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getPocStatusColors(p.status)}`}>{p.status.replace("_", " ")}</span>
                        <span className="text-sm font-medium text-gray-900">{p.owner}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditPoc(p); setShowPocModal(true); }} className="p-1 text-gray-400 hover:text-gray-600"><Edit2 className="w-3.5 h-3.5" /></button>
                        {isAdmin && <button onClick={async () => { if (confirm("Delete POC?")) { await deleteProductPOC(p.id); load(); } }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </div>
                    </div>
                    {p.findings && <p className="text-xs text-gray-600 mt-2"><span className="font-medium">Findings:</span> {p.findings}</p>}
                    {p.recommendations && <p className="text-xs text-gray-600 mt-1"><span className="font-medium">Recommendation:</span> {p.recommendations}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{formatDate(p.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-gray-500" /> Discussion
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{comments.length}</span>
            </h2>
            {comments.length === 0 && <p className="text-sm text-gray-400 text-center py-3">No comments yet.</p>}
            <div className="space-y-3 mb-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 group">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{c.userName.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-gray-900">{c.userName}</span>
                      <span className="text-xs text-gray-400">{formatTimeAgo(c.createdAt)}</span>
                      {(isAdmin || c.userId === me.id) && (
                        <button onClick={async () => { if (confirm("Delete comment?")) { await deleteProductComment(c.id); setComments((x) => x.filter((y) => y.id !== c.id)); } }}
                          className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{c.comment}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handlePostComment()}
                placeholder="Add a comment..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handlePostComment} disabled={!newComment.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meta */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm space-y-3">
            <h3 className="font-semibold text-gray-900">Details</h3>
            {product.vendorName && <Meta icon={<Store className="w-3.5 h-3.5" />} label="Vendor" value={product.vendorName} />}
            <Meta icon={<User className="w-3.5 h-3.5" />} label="Research Owner" value={product.createdByName} />
            {product.assignedDeveloperName && <Meta icon={<Code className="w-3.5 h-3.5" />} label="Developer" value={product.assignedDeveloperName} />}
            {product.reviewerName && <Meta icon={<User className="w-3.5 h-3.5" />} label="Reviewer" value={product.reviewerName} />}
            <Meta icon={<History className="w-3.5 h-3.5" />} label="Created" value={formatDate(product.createdAt)} />
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-gray-500" /> Documents</h3>
              <label className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg cursor-pointer hover:bg-blue-100">
                <Upload className="w-3.5 h-3.5" /> {uploading ? "..." : "Upload"}
                <input type="file" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] || null)} />
              </label>
            </div>
            {documents.length === 0 ? <p className="text-xs text-gray-400 text-center py-3">No documents.</p> : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 group">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-gray-700 hover:text-blue-600 truncate flex-1">{d.documentName}</a>
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="p-1 text-gray-300 hover:text-blue-500"><Download className="w-3.5 h-3.5" /></a>
                    {isAdmin && <button onClick={async () => { if (confirm("Delete document?")) { await deleteProductDocument(d.id, d.storagePath); setDocuments((x) => x.filter((y) => y.id !== d.id)); } }} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity log */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2"><History className="w-4 h-4 text-gray-500" /> Activity History</h3>
            {logs.length === 0 ? <p className="text-xs text-gray-400 text-center py-3">No activity yet.</p> : (
              <div className="space-y-3">
                {logs.map((l) => (
                  <div key={l.id} className="text-xs">
                    <p className="text-gray-700">
                      <span className="font-medium">{l.performedByName}</span> {l.action.toLowerCase()}
                      {l.oldValue && l.newValue && <> from <span className="font-medium">{l.oldValue}</span> to <span className="font-medium">{l.newValue}</span></>}
                      {!l.oldValue && l.newValue && <> <span className="font-medium">{l.newValue}</span></>}
                    </p>
                    <p className="text-gray-400 mt-0.5">{formatTimeAgo(l.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && <EditProductModal product={product} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} performedBy={me} />}
      {showPocModal && (
        <PocModal product={product} poc={editPoc} performedBy={me}
          onClose={() => setShowPocModal(false)}
          onSaved={() => { setShowPocModal(false); load(); }} />
      )}
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 flex items-center gap-1.5">{icon} {label}</span>
      <span className="text-gray-900 font-medium text-right truncate ml-2">{value}</span>
    </div>
  );
}

function Empty() { return <p className="text-sm text-gray-400 text-center py-4">No information recorded.</p>; }

function ScoreSummary({ scores }: { scores: EvaluationScore[] }) {
  if (!scores || scores.length === 0) return null;
  const { weighted, max, pct } = computeScore(scores);
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Evaluation Score</p>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getScoreColors(pct)}`}>{pct}% · {weighted}/{max}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="space-y-1.5">
        {scores.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-gray-600 flex-1 truncate">{s.criterion}</span>
            <span className="text-gray-400">w{s.weight}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`w-1.5 h-1.5 rounded-full ${n <= s.score ? "bg-blue-500" : "bg-gray-200"}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-800 whitespace-pre-line">{value}</p>
    </div>
  );
}

function ListBlock({ label, items, links, tone }: { label: string; items: string[]; links?: boolean; tone?: "green" | "red" | "amber" }) {
  if (!items || items.length === 0) return null;
  const dot = tone === "green" ? "bg-green-500" : tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-gray-400";
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
            {links ? <a href={it} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all flex items-center gap-1">{it}<ExternalLink className="w-3 h-3" /></a> : <span className="break-words">{it}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoLink({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <a href={value} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1"><Globe className="w-3.5 h-3.5" />{value}</a>
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function PocModal({ product, poc, performedBy, onClose, onSaved }: {
  product: Product; poc: ProductPOC | null; performedBy: { id: string; name: string };
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    owner: poc?.owner || performedBy.name,
    stage: poc?.stage || "PoC-1",
    status: poc?.status || "NOT_STARTED",
    findings: poc?.findings || "",
    recommendations: poc?.recommendations || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (poc) {
        await updateProductPOC(poc.id, { owner: form.owner, stage: form.stage as ProductPOC["stage"], status: form.status as ProductPOC["status"], findings: form.findings, recommendations: form.recommendations });
        if (form.status === "COMPLETED" && poc.status !== "COMPLETED") {
          await logActivity({ entityType: "poc", entityId: product.id, action: "Completed POC", performedById: performedBy.id, performedByName: performedBy.name, newValue: `${form.stage} · ${form.owner}` });
          const recipients = [product.assignedDeveloperId, product.reviewerId, product.createdById].filter(Boolean) as string[];
          await createNotification(recipients, `POC completed for "${product.name}"`, form.recommendations, `/products/${product.id}`);
        }
      } else {
        await createProductPOC({
          productId: product.id, owner: form.owner, ownerId: performedBy.id,
          stage: form.stage as ProductPOC["stage"],
          status: form.status as ProductPOC["status"], findings: form.findings,
          recommendations: form.recommendations, attachments: [],
        }, performedBy);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{poc ? "Edit POC" : "Add POC"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">POC Owner *</label>
            <input required value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Lifecycle Stage</label>
              <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as ProductPOC["stage"] }))} className={inputCls + " bg-white"}>
                {POC_STAGES.map((s) => <option key={s.value} value={s.value}>{s.value} · {s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1.5 block">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProductPOC["status"] }))} className={inputCls + " bg-white"}>
                {POC_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Findings</label>
            <textarea rows={3} value={form.findings} onChange={(e) => setForm((f) => ({ ...f, findings: e.target.value }))} className={inputCls + " resize-none"} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Recommendations</label>
            <textarea rows={2} value={form.recommendations} onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))} className={inputCls + " resize-none"} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save POC"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const linesToArray = (s: string): string[] => s.split("\n").map((x) => x.trim()).filter(Boolean);
const arrayToLines = (a: string[]): string => (a || []).join("\n");

function EditProductModal({ product, performedBy, onClose, onSaved }: {
  product: Product; performedBy: { id: string; name: string }; onClose: () => void; onSaved: () => void;
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [scores] = useState<EvaluationScore[]>(product.scores || []);
  const [matrix] = useState<CompatibilityEntry[]>(product.compatibilityMatrix || []);
  const [form, setForm] = useState({
    name: product.name, category: product.category || "", version: product.version || "", website: product.website || "",
    maturityLevel: product.maturityLevel || "L1",
    documentationLinks: arrayToLines(product.documentationLinks),
    features: arrayToLines(product.features), specifications: arrayToLines(product.specifications),
    integrationComplexity: product.integrationComplexity || "", compatibility: product.compatibility || "",
    supportedApis: arrayToLines(product.supportedApis), dependencies: arrayToLines(product.dependencies),
    licenseType: product.licenseType || "", pricing: product.pricing || "", supportInfo: product.supportInfo || "", subscriptionDetails: product.subscriptionDetails || "",
    pros: arrayToLines(product.pros), cons: arrayToLines(product.cons), risks: arrayToLines(product.risks), limitations: arrayToLines(product.limitations), comparisonNotes: product.comparisonNotes || "",
    developmentStatus: product.developmentStatus || "", integrationStatus: product.integrationStatus || "",
    assignedDeveloperId: product.assignedDeveloperId || "", reviewerId: product.reviewerId || "",
    priority: (product.priority || "MEDIUM") as ProductPriority, notes: product.notes || "",
  });

  useEffect(() => { getUsers().then(setUsers); }, []);
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dev = users.find((u) => u.id === form.assignedDeveloperId);
      const reviewer = users.find((u) => u.id === form.reviewerId);
      await updateProduct(product.id, {
        name: form.name, category: form.category, version: form.version, website: form.website,
        maturityLevel: form.maturityLevel as MaturityLevel,
        documentationLinks: linesToArray(form.documentationLinks),
        features: linesToArray(form.features), specifications: linesToArray(form.specifications),
        integrationComplexity: form.integrationComplexity, compatibility: form.compatibility,
        supportedApis: linesToArray(form.supportedApis), dependencies: linesToArray(form.dependencies),
        licenseType: form.licenseType, pricing: form.pricing, supportInfo: form.supportInfo, subscriptionDetails: form.subscriptionDetails,
        pros: linesToArray(form.pros), cons: linesToArray(form.cons), risks: linesToArray(form.risks), limitations: linesToArray(form.limitations), comparisonNotes: form.comparisonNotes,
        developmentStatus: form.developmentStatus, integrationStatus: form.integrationStatus,
        assignedDeveloperId: form.assignedDeveloperId || null, assignedDeveloperName: dev?.name || null,
        reviewerId: form.reviewerId || null, reviewerName: reviewer?.name || null,
        priority: form.priority, notes: form.notes,
        scores: scores.filter((s) => s.criterion.trim()),
        compatibilityMatrix: matrix.filter((m) => m.item.trim()),
      });
      await logActivity({ entityType: "product", entityId: product.id, action: "Updated product", performedById: performedBy.id, performedByName: performedBy.name });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const ta = inputCls + " resize-none";
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-4">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Product</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <FieldE label="Name *" full><input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Category"><input value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Version"><input value={form.version} onChange={(e) => set("version", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Website" full><input value={form.website} onChange={(e) => set("website", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Documentation Links" full><textarea rows={2} value={form.documentationLinks} onChange={(e) => set("documentationLinks", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Features" full><textarea rows={3} value={form.features} onChange={(e) => set("features", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Specifications" full><textarea rows={3} value={form.specifications} onChange={(e) => set("specifications", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Integration Complexity"><input value={form.integrationComplexity} onChange={(e) => set("integrationComplexity", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Compatibility"><input value={form.compatibility} onChange={(e) => set("compatibility", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Supported APIs" full><textarea rows={2} value={form.supportedApis} onChange={(e) => set("supportedApis", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Dependencies" full><textarea rows={2} value={form.dependencies} onChange={(e) => set("dependencies", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Licensing"><input value={form.licenseType} onChange={(e) => set("licenseType", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Pricing"><input value={form.pricing} onChange={(e) => set("pricing", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Support Availability"><input value={form.supportInfo} onChange={(e) => set("supportInfo", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Subscription Details"><input value={form.subscriptionDetails} onChange={(e) => set("subscriptionDetails", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Pros"><textarea rows={3} value={form.pros} onChange={(e) => set("pros", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Cons"><textarea rows={3} value={form.cons} onChange={(e) => set("cons", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Risks"><textarea rows={2} value={form.risks} onChange={(e) => set("risks", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Limitations"><textarea rows={2} value={form.limitations} onChange={(e) => set("limitations", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Comparison Notes" full><textarea rows={2} value={form.comparisonNotes} onChange={(e) => set("comparisonNotes", e.target.value)} className={ta} /></FieldE>
            <FieldE label="Development Status"><input value={form.developmentStatus} onChange={(e) => set("developmentStatus", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Integration Status"><input value={form.integrationStatus} onChange={(e) => set("integrationStatus", e.target.value)} className={inputCls} /></FieldE>
            <FieldE label="Assigned Developer">
              <select value={form.assignedDeveloperId} onChange={(e) => set("assignedDeveloperId", e.target.value)} className={inputCls + " bg-white"}>
                <option value="">None</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FieldE>
            <FieldE label="Reviewer">
              <select value={form.reviewerId} onChange={(e) => set("reviewerId", e.target.value)} className={inputCls + " bg-white"}>
                <option value="">None</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </FieldE>
            <FieldE label="Priority">
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className={inputCls + " bg-white"}>
                {PRODUCT_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
              </select>
            </FieldE>
            <FieldE label="Notes" full><textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={ta} /></FieldE>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FieldE({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-700 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
