import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/useAdminAuth";
import AdminSidebar from "../components/AdminSidebar";
import AdminTopNav from "../components/AdminTopNav";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { admin, logout, sessionExpired } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} isLoggingOut={loggingOut} />
      <div className="min-w-0 flex-1">
        <AdminTopNav admin={admin} sidebarOpen={sidebarOpen} onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8" key={location.pathname}>
          {sessionExpired && <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">Your admin session expired. Please sign in again.</div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
