import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Target, Search, Calendar, Package, Bell,
  Users, LogOut, TrendingUp, ChevronRight, StickyNote, Tags, Palette, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getNotifications } from "@/lib/firestore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Building2 },
  { to: "/opportunities", label: "Opportunities", icon: Target },
  { to: "/meeting-notes", label: "Meeting Notes", icon: StickyNote },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/products", label: "Research", icon: Package },
  { to: "/search", label: "Search", icon: Search },
];

interface Props {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onClose }: Props) {
  const location = useLocation();

  useEffect(() => {
    onClose?.();
    // Close mobile drawer after route changes (AppLayout also resets state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-60">
        <SidebarPanel />
      </div>

      {mobileOpen && (
        <>
          <button type="button" className="nav-overlay lg:hidden" aria-label="Close menu" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden sidebar-drawer shadow-2xl">
            <SidebarPanel onClose={onClose} />
          </div>
        </>
      )}
    </>
  );
}

function SidebarPanel({ onClose }: { onClose?: () => void }) {
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

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive ? "bg-blue-600 text-white shadow-sm shadow-blue-900/30" : "text-slate-300 hover:text-white hover:bg-slate-800/80"
    }`;

  return (
    <aside className="flex h-full w-[min(17.5rem,85vw)] lg:w-60 flex-col bg-slate-950 text-slate-100 border-r border-slate-800/80">
      <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40 flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-white font-semibold text-sm leading-none truncate">Smarttive</p>
            <p className="text-slate-400 text-[11px] mt-1">CRM</p>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass}>
            {({ isActive }) => (
              <>
                <Icon className="w-[18px] h-[18px] flex-shrink-0 opacity-90" />
                <span className="truncate">{label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </>
            )}
          </NavLink>
        ))}

        <NavLink to="/notifications" className={linkClass}>
          <>
            <Bell className="w-[18px] h-[18px] flex-shrink-0" />
            <span>Notifications</span>
            {unread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </>
        </NavLink>

        {isAdmin && (
          <>
            <div className="pt-4 pb-1.5 px-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.14em]">Admin</p>
            </div>
            <NavLink to="/admin/users" className={linkClass}>
              <Users className="w-[18px] h-[18px]" />
              <span>Users</span>
            </NavLink>
            <NavLink to="/admin/products" className={linkClass}>
              <Palette className="w-[18px] h-[18px]" />
              <span>Products</span>
            </NavLink>
            <NavLink to="/admin/tags" className={linkClass}>
              <Tags className="w-[18px] h-[18px]" />
              <span>Tags</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="px-2.5 py-3 border-t border-slate-800">
        <div className="flex items-center gap-3 px-2.5 py-2 mb-1 rounded-xl bg-slate-900/60">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {(profile?.name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile?.name || "User"}</p>
            <p className="text-slate-400 text-xs">{profile?.role || "—"}</p>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition-colors">
          <LogOut className="w-[18px] h-[18px]" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
