import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, Target, Activity, Loader2 } from "lucide-react";
import { searchAll, type Customer, type Opportunity, type Activity as ActivityType } from "@/lib/firestore";
import { formatDate, getActivityTypeIcon } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ customers: Customer[]; opportunities: Opportunity[]; activities: ActivityType[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return; }
    const timer = setTimeout(() => {
      setLoading(true);
      searchAll(query).then(setResults).finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const total = results ? results.customers.length + results.opportunities.length + results.activities.length : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Global Search</h1>
        <p className="text-gray-500 text-sm mt-1">Search across customers, opportunities, and activities</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />}
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to search... (e.g. KFUPM, compression, proposal, OrcaTwin)"
          className="w-full pl-12 pr-12 py-4 bg-white border-2 border-gray-200 rounded-2xl text-base focus:outline-none focus:border-blue-500 shadow-sm" />
      </div>

      {!query && (
        <div className="text-center py-16 text-gray-400">
          <Search className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium text-gray-500">Search everything in one place</p>
          <p className="text-sm mt-2">Try searching for a customer name, solution, keyword, or activity type</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {["KFUPM", "proposal", "OrcaTwin", "demo", "compression"].map((hint) => (
              <button key={hint} onClick={() => setQuery(hint)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm">
                {hint}
              </button>
            ))}
          </div>
        </div>
      )}

      {query.length >= 2 && !loading && results && total === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {results && total > 0 && (
        <div className="space-y-6">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{total}</span> results for &ldquo;{query}&rdquo;
          </p>

          {results.customers.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Customers ({results.customers.length})</h2>
              </div>
              <div className="space-y-2">
                {results.customers.map((c) => (
                  <div key={c.id} onClick={() => navigate(`/customers/${c.id}`)}
                    className="bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm cursor-pointer group">
                    <p className="font-medium text-gray-900 group-hover:text-blue-600">{c.name}</p>
                    {(c.industry || c.country) && (
                      <p className="text-xs text-gray-500 mt-0.5">{[c.industry, c.country].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.opportunities.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-purple-500" />
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Opportunities ({results.opportunities.length})</h2>
              </div>
              <div className="space-y-2">
                {results.opportunities.map((opp) => (
                  <div key={opp.id} onClick={() => navigate(`/opportunities/${opp.id}`)}
                    className="bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm cursor-pointer group">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-blue-600">{opp.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opp.customerName}{opp.solution && ` · ${opp.solution}`}</p>
                      </div>
                      <StatusBadge status={opp.stage} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.activities.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-green-500" />
                <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Activities ({results.activities.length})</h2>
              </div>
              <div className="space-y-2">
                {results.activities.map((a) => (
                  <div key={a.id} onClick={() => navigate(`/opportunities/${a.opportunityId}`)}
                    className="bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{getActivityTypeIcon(a.type)}</span>
                      <span className="text-xs font-medium text-gray-500">{a.type.replace("_", " ")}</span>
                      <span className="text-xs text-gray-400">{formatDate(a.date)}</span>
                    </div>
                    <p className="text-sm text-gray-900">{a.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
