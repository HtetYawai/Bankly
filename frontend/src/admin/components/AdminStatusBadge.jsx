export default function AdminStatusBadge({ status }) {
  const styles = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    FROZEN: "bg-sky-100 text-sky-700",
    CLOSED: "bg-slate-200 text-slate-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-amber-100 text-amber-700",
    FAILED: "bg-rose-100 text-rose-700",
    LOCKED: "bg-rose-200 text-rose-900",
    CREDIT: "bg-emerald-100 text-emerald-700",
    ADMIN_CREDIT: "bg-emerald-100 text-emerald-700",
    DEBIT: "bg-rose-100 text-rose-700",
    ADMIN_DEBIT: "bg-rose-100 text-rose-700",
    TRANSFER: "bg-indigo-100 text-indigo-700",
    TOPUP: "bg-cyan-100 text-cyan-700",
    REVERSED: "bg-violet-100 text-violet-700",
    CANCELLED: "bg-orange-100 text-orange-700",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>{status ?? "UNKNOWN"}</span>;
}
