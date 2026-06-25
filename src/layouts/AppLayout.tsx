import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-60 min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
