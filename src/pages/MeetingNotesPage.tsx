import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, StickyNote } from "lucide-react";
import { getMeetingNotes, getTags, type MeetingNote } from "@/lib/crm";
import { getUsers, type UserProfile } from "@/lib/firestore";
import FilterBar, { emptyFilters, type GlobalFilters } from "@/components/FilterBar";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { canCreateCrmRecords } from "@/lib/permissions";

export default function MeetingNotesPage() {
  const { profile } = useAuth();
  const canCreate = canCreateCrmRecords(profile);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GlobalFilters>(emptyFilters());

  useEffect(() => {
    Promise.all([getMeetingNotes(), getUsers(), getTags()]).then(([n, u, t]) => {
      setNotes(n);
      setUsers(u);
      setTags(t.map((x) => x.name));
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (filters.country && n.country !== filters.country) return false;
      if (filters.standalone === true && n.opportunityId) return false;
      if (filters.standalone === false && !n.opportunityId) return false;
      if (filters.peopleId) {
        const hit = n.createdById === filters.peopleId
          || n.attendees.some((a) => a.id === filters.peopleId)
          || n.permissions.some((p) => p.userId === filters.peopleId);
        if (!hit) return false;
      }
      if (filters.dateFrom && n.meetingDate && n.meetingDate < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && n.meetingDate && n.meetingDate > new Date(filters.dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [notes, filters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meeting Notes</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} notes</p>
        </div>
        {canCreate && (
          <Link to="/meeting-notes/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Note
          </Link>
        )}
      </div>

      <FilterBar
        value={filters}
        onChange={setFilters}
        users={users}
        tags={tags}
        showStage={false}
        showStandalone
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <StickyNote className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No meeting notes found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((n) => (
            <Link key={n.id} to={`/meeting-notes/${n.id}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all">
              <h3 className="font-semibold text-gray-900 text-sm">{n.title}</h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.body}</p>
              <div className="flex items-center justify-between mt-3 text-[11px] text-gray-400">
                <span>{n.meetingDate ? formatDate(n.meetingDate) : "No date"}</span>
                <span>{n.opportunityTitle || "Standalone"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
