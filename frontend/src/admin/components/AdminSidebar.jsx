import {
  BarChart3, ChevronRight, CircleDollarSign, FileClock, LayoutDashboard,
  LogOut, Settings, ShieldAlert, SlidersHorizontal, UserCog, Users, WalletCards,
  X,
} from "lucide-react";
import { createElement } from "react";
import { NavLink } from "react-router-dom";

const sections = [
  { label: null, items: [{ label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard }] },
  { label: "User Management", items: [
    { label: "All Users", to: "/admin/users", icon: Users, end: true },
    { label: "Frozen Accounts", to: "/admin/users/frozen", icon: ShieldAlert },
  ] },
  { label: "Finance", items: [
    { label: "Wallets", to: "/admin/wallets", icon: WalletCards },
    { label: "Transactions", to: "/admin/transactions", icon: CircleDollarSign },
    { label: "Balance Adjustments", to: "/admin/balance-adjustments", icon: SlidersHorizontal },
  ] },
  { label: "Analytics", items: [
    { label: "Reports", to: "/admin/reports", icon: BarChart3 },
    { label: "Audit Logs", to: "/admin/audit-logs", icon: FileClock },
  ] },
  { label: "System", items: [
    { label: "Settings", to: "/admin/settings", icon: Settings },
    { label: "Admin Profile", to: "/admin/profile", icon: UserCog },
  ] },
];

export default function AdminSidebar({ isOpen, onClose, onLogout, isLoggingOut }) {
  return (
    <>
      {isOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden" onClick={onClose} aria-label="Close navigation" />}
      <aside id="admin-sidebar" aria-label="Admin sidebar" className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 text-slate-200 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex min-h-[4.5rem] items-center justify-between border-b border-slate-800 px-6 py-5">
          <NavLink to="/admin/dashboard" onClick={onClose} className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 font-black text-slate-950">B</span>
            <span><strong className="block text-white">Bankly Admin</strong><small className="text-slate-400">Control center</small></span>
          </NavLink>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-800 lg:hidden" aria-label="Close sidebar"><X size={20} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5" aria-label="Admin navigation">
          {sections.map((section, index) => (
            <div key={section.label ?? index} className="mb-5">
              {section.label && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.label}</p>}
              <div className="space-y-1">
                {section.items.map(({ label, to, icon, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? "bg-cyan-400/15 text-cyan-300" : "text-slate-300 hover:bg-slate-900 hover:text-white"}`}>
                    {createElement(icon, { size: 18, "aria-hidden": true })}<span className="flex-1">{label}</span><ChevronRight aria-hidden="true" size={14} className="opacity-0 transition group-hover:opacity-60" />
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button type="button" onClick={onLogout} disabled={isLoggingOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-60">
            {isLoggingOut ? <span className="loading loading-spinner loading-xs" /> : <LogOut size={18} aria-hidden="true" />} {isLoggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}
