import { Menu, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminTopNav({ admin, onMenuClick, sidebarOpen }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 pt-[calc(2.75rem+env(safe-area-inset-top))] pb-4 backdrop-blur sm:px-6 sm:pt-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onMenuClick} aria-controls="admin-sidebar" aria-expanded={sidebarOpen} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu size={22} aria-hidden="true" /></button>
        <div><p className="text-sm font-semibold text-slate-900">Administration</p><p className="hidden text-xs text-slate-500 sm:block">Secure operations workspace</p></div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block"><p className="text-sm font-medium text-slate-800">{admin?.name}</p><p className="text-xs text-slate-500">{admin?.email}</p></div>
        <Link to="/admin/profile" aria-label="Open admin profile" className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"><ShieldCheck size={18} aria-hidden="true" /></Link>
      </div>
    </header>
  );
}
