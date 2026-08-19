import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, Check, CheckCheck, Package, Target, StickyNote, ClipboardList } from "lucide-react";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  getProducts, getOpportunities,
  type AppNotification, type Product, type Opportunity,
} from "@/lib/firestore";
import { getMeetingNotes, type MeetingNote } from "@/lib/crm";
import { useAuth } from "@/context/AuthContext";
import { formatTimeAgo, getProductStatusLabel, PIPELINE_STAGE_LABELS } from "@/lib/utils";

interface AssignedTask {
  id: string;
  kind: "research" | "opportunity" | "draft_note";
  title: string;
  subtitle: string;
  link: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [notifs, products, opps, notes] = await Promise.all([
        getNotifications(user.uid),
        getProducts(),
        getOpportunities(),
        getMeetingNotes(),
      ]);
      setItems(notifs);

      const assigned: AssignedTask[] = [];

      products.forEach((p: Product) => {
        if (p.assignedDeveloperId === user.uid || p.reviewerId === user.uid) {
          const role = p.assignedDeveloperId === user.uid ? "Assigned developer" : "Reviewer";
          assigned.push({
            id: `product-${p.id}`,
            kind: "research",
            title: p.name,
            subtitle: `${role} · ${getProductStatusLabel(p.status)}`,
            link: `/products/${p.id}`,
          });
        }
      });

      opps.forEach((o: Opportunity) => {
        if (o.owner?.id === user.uid || o.coOwner?.id === user.uid) {
          const role = o.owner?.id === user.uid ? "Owner" : "Co-Owner";
          assigned.push({
            id: `opp-${o.id}`,
            kind: "opportunity",
            title: o.title,
            subtitle: `${role} · ${PIPELINE_STAGE_LABELS[o.stage] || o.stage} · ${o.customerName}`,
            link: `/opportunities/${o.id}`,
          });
        }
      });

      notes.forEach((n: MeetingNote) => {
        if (n.isDraft && n.createdById === user.uid) {
          assigned.push({
            id: `note-${n.id}`,
            kind: "draft_note",
            title: n.title,
            subtitle: "Draft meeting note — complete remaining fields",
            link: `/meeting-notes/${n.id}`,
          });
        } else if (
          n.attendees.some((a) => a.id === user.uid)
          || n.permissions.some((p) => p.userId === user.uid && p.role !== "CREATOR")
        ) {
          assigned.push({
            id: `note-${n.id}`,
            kind: "draft_note",
            title: n.title,
            subtitle: "Meeting note you’re involved in",
            link: `/meeting-notes/${n.id}`,
          });
        }
      });

      setTasks(assigned);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.uid]);

  const unread = items.filter((n) => !n.read).length;

  const open = async (n: AppNotification) => {
    if (!n.read) { await markNotificationRead(n.id); setItems((x) => x.map((y) => (y.id === n.id ? { ...y, read: true } : y))); }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.uid);
    setItems((x) => x.map((y) => ({ ...y, read: true })));
  };

  const taskIcon = (kind: AssignedTask["kind"]) => {
    if (kind === "research") return Package;
    if (kind === "opportunity") return Target;
    return StickyNote;
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">{unread} unread · {tasks.length} assigned task{tasks.length === 1 ? "" : "s"}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-gray-900">My assigned tasks</h2>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tasks.length}</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
            <p className="text-sm">No tasks assigned to you right now</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {tasks.map((t) => {
              const Icon = taskIcon(t.kind);
              return (
                <button key={t.id} type="button" onClick={() => navigate(t.link)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-3">Activity alerts</h2>
        {loading ? null : items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BellOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {items.map((n) => (
              <button key={n.id} onClick={() => open(n)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${n.read ? "" : "bg-blue-50/50"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${n.read ? "bg-gray-100 text-gray-400" : "bg-blue-100 text-blue-600"}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.read ? "text-gray-600" : "text-gray-900 font-medium"}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(n.createdAt)}</p>
                </div>
                {!n.read && <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1" />}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
