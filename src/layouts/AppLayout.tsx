import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Menu, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import PendingAccessPage from "@/pages/PendingAccessPage";

export default function AppLayout() {
  const { user, loading, hasRole, profile } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!hasRole) return <PendingAccessPage />;

  return (
    <div className="app-shell">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 lg:hidden border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-slate-900 truncate">Smarttive</p>
              <p className="text-[11px] text-slate-500 truncate">{profile?.name || "CRM"}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main lg:ml-60">
        <div className="app-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
