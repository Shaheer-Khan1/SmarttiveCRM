import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, Check, CheckCheck } from "lucide-react";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  type AppNotification,
} from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { formatTimeAgo } from "@/lib/utils";

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!user) return;
    setLoading(true);
    getNotifications(user.uid).then(setItems).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [user?.uid]);

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 text-sm mt-1">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={markAll} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
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
    </div>
  );
}
