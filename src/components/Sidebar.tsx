import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Target, Search, Calendar, Package, Bell,
  Users, LogOut, TrendingUp, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getNotifications } from "@/lib/firestore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Building2 },
  { to: "/opportunities", label: "Opportunities", icon: Target },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/products", label: "Product Research", icon: Package },
  { to: "/search", label: "Search", icon: Search },
];

export default function Sidebar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    getNotifications(user.uid).then((n) => setUnread(n.filter((x) => !x.read).length));
  }, [user?.uid, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-slate-900 flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Smarttive</p>
            <p className="text-slate-400 text-xs mt-0.5">Sales Tracker</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`
            }>
            {({ isActive }) => (
              <>
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </>
            )}
          </NavLink>
        ))}

        <NavLink to="/notifications"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`
          }>
          <Bell className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Notifications</span>
          {unread > 0 && (
            <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </NavLink>

        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</p>
            </div>
            <NavLink to="/admin/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`
              }>
              <Users className="w-[18px] h-[18px]" />
              <span>Users</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {(profile?.name || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile?.name || "User"}</p>
            <p className="text-slate-400 text-xs">{profile?.role || "—"}</p>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-all">
          <LogOut className="w-[18px] h-[18px]" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
