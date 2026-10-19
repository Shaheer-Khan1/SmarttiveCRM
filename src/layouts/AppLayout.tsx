import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import PendingAccessPage from "@/pages/PendingAccessPage";

export default function AppLayout() {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!hasRole) return <PendingAccessPage />;

  const isWorkspace = location.pathname.startsWith("/workspace");

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <button
          type="button"
          className="app-logo-btn"
          aria-expanded={navOpen}
          aria-controls="app-menu"
          onClick={() => setNavOpen((open) => !open)}
        >
          <span className="app-logo-mark" aria-hidden>
            <TrendingUp className="w-4 h-4 text-white" />
          </span>
          <span className="text-left">
            <span className="block font-display text-sm font-semibold leading-none text-slate-900">Smarttive</span>
            <span className="block text-[11px] text-slate-500 mt-1">CRM</span>
          </span>
        </button>
      </header>

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <main className="app-main">
        <div className={isWorkspace ? "app-content app-content--bleed" : "app-content"}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
