import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Search, SlidersHorizontal, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import AdminErrorState from "../components/AdminErrorState";
import AdminStatusBadge from "../components/AdminStatusBadge";
import { adminUsersApi, getAdminApiError } from "../services/adminApi";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function UsersLoading() {
  return <div className="space-y-3" role="status" aria-label="Loading users">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-200" />)}<span className="sr-only">Loading users…</span></div>;
}

export default function AdminUsersPage({ forcedStatus = "" }) {
  const [filters, setFilters] = useState({ q: "", accountStatus: forcedStatus, registeredFrom: "", registeredTo: "", sortBy: "createdAt", sortOrder: "desc" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ users: [], total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const loadUsers = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const response = await adminUsersApi.list({
        ...appliedFilters,
        accountStatus: forcedStatus || appliedFilters.accountStatus || undefined,
        registeredFrom: appliedFilters.registeredFrom ? `${appliedFilters.registeredFrom}T00:00:00.000Z` : undefined,
        registeredTo: appliedFilters.registeredTo ? `${appliedFilters.registeredTo}T23:59:59.999Z` : undefined,
        page,
        limit: 20,
      }, { signal });
      setResult(response.data);
    } catch (requestError) {
      if (requestError.code !== "ERR_CANCELED") setError(getAdminApiError(requestError, "Unable to load users."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [appliedFilters, forcedStatus, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadUsers(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadUsers]);

  const applyFilters = (event) => {
    event.preventDefault();
    if (filters.registeredFrom && filters.registeredTo && filters.registeredFrom > filters.registeredTo) {
      setFilterError("Registration start date cannot be later than the end date.");
      return;
    }
    setFilterError("");
    setPage(1);
    setAppliedFilters(filters);
  };

  const title = forcedStatus === "FROZEN" ? "Frozen Accounts" : "All Users";
  const description = forcedStatus === "FROZEN" ? "Review accounts currently restricted from financial actions." : "Search and review customer accounts and wallet status.";

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">User management</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div>

      <form onSubmit={applyFilters} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="User filters">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2"><span className="sr-only">Search users</span><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} className="input input-bordered w-full bg-white pl-10" placeholder="Name, email or phone" /></div></label>
          {!forcedStatus && <label><span className="sr-only">Account status</span><select value={filters.accountStatus} onChange={(event) => setFilters({ ...filters, accountStatus: event.target.value })} className="select select-bordered w-full bg-white"><option value="">All statuses</option><option>ACTIVE</option><option>FROZEN</option><option>CLOSED</option></select></label>}
          <label><span className="mb-1 block text-xs text-slate-500">Registered from</span><input type="date" value={filters.registeredFrom} max={filters.registeredTo || undefined} onChange={(event) => setFilters({ ...filters, registeredFrom: event.target.value })} className="input input-bordered w-full bg-white" /></label>
          <label><span className="mb-1 block text-xs text-slate-500">Registered to</span><input type="date" value={filters.registeredTo} min={filters.registeredFrom || undefined} onChange={(event) => setFilters({ ...filters, registeredTo: event.target.value })} className="input input-bordered w-full bg-white" /></label>
          <div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Sort by</span><select value={filters.sortBy} onChange={(event) => setFilters({ ...filters, sortBy: event.target.value })} className="select select-bordered w-full bg-white"><option value="createdAt">Registration</option><option value="fullName">Name</option><option value="email">Email</option><option value="balance">Balance</option></select></label><label><span className="sr-only">Sort order</span><select value={filters.sortOrder} onChange={(event) => setFilters({ ...filters, sortOrder: event.target.value })} className="select select-bordered bg-white"><option value="desc">↓</option><option value="asc">↑</option></select></label></div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3"><p className="text-sm text-rose-600" role="alert">{filterError}</p><button type="submit" className="btn btn-sm border-0 bg-slate-900 text-white"><SlidersHorizontal size={15} /> Apply filters</button></div>
      </form>

      {loading ? <UsersLoading /> : error ? <AdminErrorState message={error} onRetry={() => loadUsers()} /> : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><p className="text-sm font-medium text-slate-700">{result.total.toLocaleString()} users</p><p className="text-xs text-slate-500">Page {result.page ?? page} of {Math.max(result.totalPages, 1)}</p></div>
          {!result.users.length ? <div className="p-12 text-center"><UserRound className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-medium text-slate-700">No users found</p><p className="mt-1 text-sm text-slate-500">Try changing the search or filters.</p></div> : <>
            <div className="hidden overflow-x-auto md:block"><table className="table"><thead><tr><th>User</th><th>Phone</th><th>Status</th><th>Wallet balance</th><th>Registered</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{result.users.map((user) => <tr key={user._id}><td><p className="font-medium text-slate-900">{user.fullName}</p><p className="text-xs text-slate-500">{user.email}</p></td><td className="text-sm">{user.phone}</td><td><AdminStatusBadge status={user.accountStatus} /></td><td className="font-semibold">{money.format(user.balance ?? 0)}</td><td className="text-sm text-slate-500">{date.format(new Date(user.createdAt))}</td><td><Link to={`/admin/users/${user._id}`} className="btn btn-ghost btn-sm bg-cyan-50 text-cyan-700 hover:bg-cyan-100"><Eye size={16} /> View</Link></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-slate-100 md:hidden">{result.users.map((user) => <article key={user._id} className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{user.fullName}</p><p className="truncate text-sm text-slate-500">{user.email}</p><p className="mt-1 text-xs text-slate-400">{user.phone}</p></div><AdminStatusBadge status={user.accountStatus} /></div><div className="mt-4 flex items-end justify-between"><div><p className="text-xs text-slate-500">Wallet balance</p><p className="font-semibold">{money.format(user.balance ?? 0)}</p></div><Link to={`/admin/users/${user._id}`} className="btn btn-sm border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200"><Eye size={15} /> Details</Link></div></article>)}</div>
          </>}
          <div className="flex items-center justify-between border-t border-slate-100 p-4"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="btn btn-sm border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"><ChevronLeft size={16} /> Previous</button><span className="text-xs text-slate-500">{page} / {Math.max(result.totalPages, 1)}</span><button type="button" disabled={page >= result.totalPages} onClick={() => setPage((value) => value + 1)} className="btn btn-sm border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed">Next <ChevronRight size={16} /></button></div>
        </section>
      )}
    </div>
  );
}
