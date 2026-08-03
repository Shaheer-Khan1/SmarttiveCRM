import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function PendingAccessPage() {
  const { profile, user, signOut, refreshProfile } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm max-w-md w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
          <Clock className="w-7 h-7 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Access pending</h1>
          <p className="text-sm text-gray-500 mt-2">
            Signed in as <span className="font-medium text-gray-800">{profile?.email || user?.email}</span>.
            An admin must assign you a role (Admin, Manager, or Developer) before you can use the CRM.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Check again
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
