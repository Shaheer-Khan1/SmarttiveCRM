import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Target, Building2, TrendingUp, AlertTriangle, CheckCircle, PauseCircle, XCircle, ArrowRight, Clock } from "lucide-react";
import OpportunityCard from "@/components/OpportunityCard";
import GlobalProgressCalendar from "@/components/GlobalProgressCalendar";
import FilterBar, { emptyFilters, type GlobalFilters } from "@/components/FilterBar";
import { getDashboardData, getUsers, type Opportunity, type Activity, type UserProfile } from "@/lib/firestore";
import { getFollowUpStatus } from "@/lib/utils";

interface Stats {
  total: number; active: number; won: number; lost: number;
  onHold: number; customers: number; redFlags: number; warnings: number;
}

export default function DashboardPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GlobalFilters>(emptyFilters());

  useEffect(() => {
    getUsers().then(setUsers).catch(() => {});
    getDashboardData().then(({ opportunities, activities: allActivities, totalCustomers }) => {
      const open = (o: Opportunity) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST";
      const active = opportunities.filter(open);
      let redFlags = 0, warnings = 0;
      active.forEach((o) => {
        const s = getFollowUpStatus(o.lastActivityDate || null);
        if (s === "RED_FLAG" || s === "NO_ACTIVITY") redFlags++;
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

  const filteredOpps = useMemo(() => opps.filter((opp) => {
    if (filters.country && opp.country !== filters.country) return false;
    if (filters.region && opp.region !== filters.region) return false;
    if (filters.stage && opp.stage !== filters.stage) return false;
    if (filters.tag && !opp.tags.includes(filters.tag)) return false;
    if (filters.peopleId && opp.owner?.id !== filters.peopleId && opp.coOwner?.id !== filters.peopleId) return false;
    return true;
  }), [opps, filters]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const active = filteredOpps.filter((o) => o.stage !== "CLOSED_WON" && o.stage !== "CLOSED_LOST");
  const redFlagOpps = active.filter((o) => {
    const s = getFollowUpStatus(o.lastActivityDate || null);
    return s === "RED_FLAG" || s === "NO_ACTIVITY";
  });
  const warningOpps = active.filter((o) => getFollowUpStatus(o.lastActivityDate || null) === "WARNING");
  const allTags = Array.from(new Set(opps.flatMap((o) => o.tags)));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your sales pipeline and follow-up status</p>
        </div>
      </div>

      <FilterBar value={filters} onChange={setFilters} users={users} tags={allTags} showStage />

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
          </div>
        </div>
      )}

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard icon={Target} label="Total Opportunities" value={stats!.total} color="blue" />
        <StatCard icon={TrendingUp} label="Active" value={stats!.active} color="blue" />
        <StatCard icon={CheckCircle} label="Won" value={stats!.won} color="green" />
        <StatCard icon={Building2} label="Customers" value={stats!.customers} color="purple" />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard icon={AlertTriangle} label="Red Flags" value={stats!.redFlags} color="red" href="/opportunities?followUp=RED_FLAG" />
        <StatCard icon={Clock} label="Warnings" value={stats!.warnings} color="amber" href="/opportunities?followUp=WARNING" />
        <StatCard icon={PauseCircle} label="On Hold" value={stats!.onHold} color="amber" />
        <StatCard icon={XCircle} label="Lost" value={stats!.lost} color="gray" />
      </div>

      {/* Red Flags */}
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {redFlagOpps.slice(0, 6).map((opp) => <OpportunityCard key={opp.id} opp={opp} />)}
          </div>
        </section>
      )}

      {/* Warnings */}
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

      {/* Recent */}
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
