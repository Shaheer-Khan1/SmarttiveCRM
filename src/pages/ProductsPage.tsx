import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus, Search, Package, Cpu, Code, Store, FlaskConical, CheckCircle2, Layers, X,
} from "lucide-react";
import { getProducts, getVendors, type Product, type Vendor, type ProductStatus, type ProductType } from "@/lib/firestore";
import {
  PRODUCT_STATUSES, getProductStatusLabel, getProductStatusColors, getPriorityColors,
} from "@/lib/utils";

export default function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ProductType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProductStatus>("ALL");
  const [vendorFilter, setVendorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    Promise.all([getProducts(), getVendors()])
      .then(([p, v]) => { setProducts(p); setVendors(v); })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean) as string[])].sort(),
    [products]
  );

  const stats = useMemo(() => ({
    underResearch: products.filter((p) => ["RESEARCH_STARTED", "IN_PROGRESS", "UNDER_REVIEW"].includes(p.status)).length,
    approved: products.filter((p) => p.status === "APPROVED").length,
    activePocs: products.filter((p) => p.status === "POC_ONGOING").length,
    integrated: products.filter((p) => p.status === "INTEGRATED").length,
    software: products.filter((p) => p.type === "SOFTWARE").length,
    hardware: products.filter((p) => p.type === "HARDWARE").length,
  }), [products]);

  const filtered = products.filter((p) => {
    if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (vendorFilter && p.vendorId !== vendorFilter) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [p.name, p.category, p.vendorName, p.version, p.features.join(" "), p.notes].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const hasFilters = typeFilter !== "ALL" || statusFilter !== "ALL" || vendorFilter || categoryFilter;

  const statCards = [
    { label: "Under Research", value: stats.underResearch, icon: FlaskConical, color: "text-blue-600 bg-blue-50" },
    { label: "Active POCs", value: stats.activePocs, icon: Cpu, color: "text-indigo-600 bg-indigo-50" },
    { label: "Approved", value: stats.approved, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
    { label: "Integrated", value: stats.integrated, icon: Layers, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Research</h1>
          <p className="text-gray-500 text-sm mt-1">
            {products.length} products · {stats.software} software · {stats.hardware} hardware
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/products/vendors" className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Store className="w-4 h-4" /> Vendors
          </Link>
          <Link to="/products/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Product
          </Link>
        </div>
      </div>

      {/* Dashboard stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products, features, vendor..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex gap-1">
          {(["ALL", "SOFTWARE", "HARDWARE"] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${typeFilter === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {t === "SOFTWARE" && <Code className="w-3 h-3" />}
              {t === "HARDWARE" && <Cpu className="w-3 h-3" />}
              {t === "ALL" ? "All Types" : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-gray-200 self-center" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="ALL">All Statuses</option>
          {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{getProductStatusLabel(s)}</option>)}
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setTypeFilter("ALL"); setStatusFilter("ALL"); setVendorFilter(""); setCategoryFilter(""); }}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No products found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} onClick={() => navigate(`/products/${p.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${p.type === "SOFTWARE" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}>
                    {p.type === "SOFTWARE" ? <Code className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors truncate">{p.name}</h3>
                    {p.vendorName && <p className="text-xs text-gray-500 truncate">{p.vendorName}</p>}
                  </div>
                </div>
              </div>
              {p.category && <p className="text-xs text-gray-500 mb-2">{p.category}{p.version ? ` · v${p.version}` : ""}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getProductStatusColors(p.status)}`}>
                  {getProductStatusLabel(p.status)}
                </span>
                {p.priority && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getPriorityColors(p.priority)}`}>
                    {p.priority}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
