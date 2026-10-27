import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Target, Building2, TrendingUp, AlertTriangle, CheckCircle, PauseCircle, XCircle,
  ArrowRight, Clock, StickyNote, Search, Loader2, Activity, Package, Send,
} from "lucide-react";
import OpportunityCard from "@/components/OpportunityCard";
import GlobalProgressCalendar from "@/components/GlobalProgressCalendar";
import FilterBar, { emptyFilters, opportunityMatchesFilters, type GlobalFilters } from "@/components/FilterBar";
import {
  getDashboardData, getUsers, searchAll, getProducts,
  type Opportunity, type Activity as ActivityType, type UserProfile, type Customer, type Product,
} from "@/lib/firestore";
import { createMeetingNote, getCatalogProducts, getMeetingNotes } from "@/lib/crm";
import { useAuth } from "@/context/AuthContext";
import {
  getFollowUpStatus, RED_FLAG_EXPLANATION, formatDate,
  getActivityTypeIcon, getProductStatusLabel, byOpportunityTitle, countryFlag,
} from "@/lib/utils";
import { canCreateCrmRecords } from "@/lib/permissions";
import StatusBadge from "@/components/StatusBadge";

interface Stats {
  total: number; active: number; won: number; lost: number;
  onHold: number; customers: number; redFlags: number; warnings: number;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const canCreate = canCreateCrmRecords(profile);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GlobalFilters>(emptyFilters());
  const [productNames, setProductNames] = useState<string[]>([]);

  const [quickNote, setQuickNote] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMsg, setDraftMsg] = useState("");

  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<{
    customers: Customer[];
    opportunities: Opportunity[];
    activities: ActivityType[];
    products: Product[];
    notes: { id: string; title: string; snippet: string }[];
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
    getCatalogProducts({ activeOnly: true })
      .then((list) => setProductNames(list.map((p) => p.name).sort((a, b) => a.localeCompare(b))))
      .catch(() => {});
    getDashboardData().then(({ opportunities, activities: allActivities, totalCustomers }) => {
      const open = (o: Opportunity) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST";
      const active = opportunities.filter(open);
      let redFlags = 0, warnings = 0;
      active.forEach((o) => {
        const s = getFollowUpStatus(o.lastActivityDate || null);
        // Missing dates are not red-flagged
        if (s === "RED_FLAG") redFlags++;
        else if (s === "WARNING") warnings++;
      });
      setStats({
        total: opportunities.length,
        active: active.length,
        won: opportunities.filter((o) => o.stage === "CLOSED_WON").length,
        lost: opportunities.filter((o) => o.stage === "CLOSED_LOST").length,
        onHold: opportunities.filter((o) => o.stage === "QUALIFICATION").length,
        customers: totalCustomers,
        redFlags,
        warnings,
      });
      setOpps(opportunities);
      setActivities(allActivities);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [base, products, notes] = await Promise.all([
          searchAll(query),
          getProducts(),
          getMeetingNotes(),
        ]);
        const qLower = query.toLowerCase();
        setResults({
          ...base,
          products: products.filter((p) =>
            [p.name, p.vendorName, p.category, p.notes, p.assignedDeveloperName, p.reviewerName]
              .some((f) => f?.toLowerCase().includes(qLower))
          ).slice(0, 10),
          notes: notes.filter((n) =>
            [n.title, n.body, n.quickNotes, n.nextSteps, ...(n.externalAttendees || [])]
              .some((f) => f?.toLowerCase().includes(qLower))
          ).slice(0, 10).map((n) => ({
            id: n.id,
            title: n.title,
            snippet: n.quickNotes || n.body || "",
          })),
        });
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredOpps = useMemo(
    () => opps.filter((opp) => opportunityMatchesFilters(opp, filters)).sort(byOpportunityTitle),
    [opps, filters],
  );

  const saveQuickDraft = async () => {
    if (!quickNote.trim() || !user || !profile) return;
    setSavingDraft(true);
    setDraftMsg("");
    try {
      const stamp = new Date().toLocaleString();
      const id = await createMeetingNote({
        title: `Quick note · ${stamp}`,
        body: "",
        quickNotes: quickNote.trim(),
        isDraft: true,
        meetingDate: null,
        nextSteps: "",
        opportunityId: null,
        opportunityTitle: null,
        country: null,
        attendees: [],
        externalAttendees: [],
        createdById: user.uid,
        createdByName: profile.name,
        permissions: [{ userId: user.uid, userName: profile.name, role: "CREATOR" }],
      });
      setQuickNote("");
      setDraftMsg("Draft saved");
      navigate(`/meeting-notes/${id}`);
    } catch {
      setDraftMsg("Could not save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const active = filteredOpps.filter((o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST");
  const redFlagOpps = active.filter((o) => getFollowUpStatus(o.lastActivityDate || null) === "RED_FLAG");
  const warningOpps = active.filter((o) => getFollowUpStatus(o.lastActivityDate || null) === "WARNING");
  const allTags = Array.from(new Set(opps.flatMap((o) => o.tags)));
  const searchTotal = results
    ? results.customers.length + results.opportunities.length + results.activities.length
      + results.products.length + results.notes.length
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your sales pipeline and follow-up status</p>
        </div>
      </div>

      {canCreate && (
        <section className="panel p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <StickyNote className="w-4 h-4 text-blue-600" />
            <h2 className="font-semibold text-slate-900 text-sm">Quick Meeting Note</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">Capture a draft in one step — open it later to fill attendees, date, and full notes.</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <textarea
              rows={2}
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Quick notes (required for draft)…"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              type="button"
              disabled={!quickNote.trim() || savingDraft}
              onClick={() => void saveQuickDraft()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 self-stretch sm:self-end"
            >
              <Send className="w-4 h-4" />
              {savingDraft ? "Saving…" : "Save draft"}
            </button>
          </div>
          {draftMsg && <p className="text-xs text-slate-500 mt-2">{draftMsg}</p>}
        </section>
      )}

      <FilterBar value={filters} onChange={setFilters} users={users} tags={allTags} products={productNames} showStage />

      {(stats!.redFlags > 0 || stats!.warnings > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Attention Required</p>
            <p className="text-sm text-red-600 mt-0.5">
              {stats!.redFlags > 0 && `${stats!.redFlags} opportunit${stats!.redFlags > 1 ? "ies" : "y"} flagged red`}
              {stats!.redFlags > 0 && stats!.warnings > 0 && " · "}
              {stats!.warnings > 0 && `${stats!.warnings} warning${stats!.warnings > 1 ? "s" : ""} need follow-up`}
            </p>
            <p className="text-xs text-red-700/80 mt-1">{RED_FLAG_EXPLANATION}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard icon={Target} label="Total Opportunities" value={stats!.total} color="blue" />
        <StatCard icon={TrendingUp} label="Active" value={stats!.active} color="blue" />
        <StatCard icon={CheckCircle} label="Won" value={stats!.won} color="green" />
        <StatCard icon={Building2} label="Customers" value={stats!.customers} color="purple" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard icon={AlertTriangle} label="Red Flags" value={stats!.redFlags} color="red" href="/opportunities?followUp=RED_FLAG" />
        <StatCard icon={Clock} label="Warnings" value={stats!.warnings} color="amber" href="/opportunities?followUp=WARNING" />
        <StatCard icon={PauseCircle} label="On Hold" value={stats!.onHold} color="amber" />
        <StatCard icon={XCircle} label="Lost" value={stats!.lost} color="gray" />
      </div>

      {redFlagOpps.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <h2 className="font-semibold text-gray-900">Red Flag Opportunities</h2>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{redFlagOpps.length}</span>
            </div>
            <Link to="/opportunities?followUp=RED_FLAG" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <p className="text-xs text-slate-500 mb-3">{RED_FLAG_EXPLANATION}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {redFlagOpps.slice(0, 6).map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
          </div>
        </section>
      )}

      {warningOpps.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <h2 className="font-semibold text-gray-900">Follow-up Needed</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{warningOpps.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {warningOpps.slice(0, 3).map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
          </div>
        </section>
      )}

      <GlobalProgressCalendar activities={activities} opportunities={opps} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Opportunities</h2>
          <Link to="/opportunities" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOpps.slice(0, 6).map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
        </div>
      </section>

      {/* Global search at bottom of dashboard */}
      <section id="search" className="panel p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" /> Global Search
          </h2>
          <p className="text-xs text-slate-500 mt-1">Search customers, opportunities, research, notes, and activities</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />}
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type at least 2 characters…"
            className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {query.length >= 2 && !searchLoading && results && searchTotal === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No results for “{query}”</p>
        )}

        {results && searchTotal > 0 && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{searchTotal}</span> results
            </p>
            {results.customers.length > 0 && (
              <SearchGroup icon={Building2} label="Customers" color="text-blue-500">
                {results.customers.map((c) => (
                  <button key={c.id} type="button" onClick={() => navigate(`/customers/${c.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                    <p className="text-sm font-medium text-slate-900">{c.name}</p>
                    {(c.industry || c.country) && (
                      <p className="text-xs text-slate-500">{[c.industry, c.country].filter(Boolean).join(" · ")}</p>
                    )}
                  </button>
                ))}
              </SearchGroup>
            )}
            {results.opportunities.length > 0 && (
              <SearchGroup icon={Target} label="Opportunities" color="text-purple-500">
                {results.opportunities.map((opp) => (
                  <button key={opp.id} type="button" onClick={() => navigate(`/opportunities/${opp.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{opp.title}</p>
                      <p className="text-xs text-slate-500">
                        {opp.customerName}
                        {opp.country ? ` · ${countryFlag(opp.country)} ${opp.country}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={opp.stage} />
                  </button>
                ))}
              </SearchGroup>
            )}
            {results.products.length > 0 && (
              <SearchGroup icon={Package} label="Research" color="text-violet-500">
                {results.products.map((p) => (
                  <button key={p.id} type="button" onClick={() => navigate(`/products/${p.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{getProductStatusLabel(p.status)}{p.vendorName ? ` · ${p.vendorName}` : ""}</p>
                  </button>
                ))}
              </SearchGroup>
            )}
            {results.notes.length > 0 && (
              <SearchGroup icon={StickyNote} label="Meeting Notes" color="text-teal-500">
                {results.notes.map((n) => (
                  <button key={n.id} type="button" onClick={() => navigate(`/meeting-notes/${n.id}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    {n.snippet && <p className="text-xs text-slate-500 line-clamp-1">{n.snippet}</p>}
                  </button>
                ))}
              </SearchGroup>
            )}
            {results.activities.length > 0 && (
              <SearchGroup icon={Activity} label="Activities" color="text-green-500">
                {results.activities.map((a) => (
                  <button key={a.id} type="button" onClick={() => navigate(`/opportunities/${a.opportunityId}`)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span>{getActivityTypeIcon(a.type)}</span>
                      <span className="text-xs text-slate-500">{a.type.replace("_", " ")} · {formatDate(a.date)}</span>
                    </div>
                    <p className="text-sm text-slate-900">{a.summary}</p>
                  </button>
                ))}
              </SearchGroup>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SearchGroup({ icon: Icon, label, color, children }: {
  icon: React.ElementType; label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, href }: {
  icon: React.ElementType; label: string; value: number; color: string; href?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600", gray: "bg-gray-50 text-gray-500",
  };
  const card = (
    <div className="panel p-3.5 sm:p-4 hover:border-slate-300 hover:shadow-md transition-all h-full">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 mt-1 leading-snug">{label}</p>
    </div>
  );
  return href ? <Link to={href}>{card}</Link> : card;
}
