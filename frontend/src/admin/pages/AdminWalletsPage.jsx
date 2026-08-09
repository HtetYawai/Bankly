import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Search, SlidersHorizontal, WalletCards } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AdminErrorState from "../components/AdminErrorState";
import AdminStatusBadge from "../components/AdminStatusBadge";
import { adminWalletsApi, getAdminApiError } from "../services/adminApi";
import { formatTHB, safeDate } from "../utils/formatters";

function filtersFromParams(params) {
  return {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    minBalance: params.get("minBalance") ?? "",
    maxBalance: params.get("maxBalance") ?? "",
    sortBy: params.get("sortBy") ?? "createdAt",
    sortOrder: params.get("sortOrder") ?? "desc",
  };
}

function loadingRows() {
  return <div className="space-y-3" role="status">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-200" />)}<span className="sr-only">Loading wallets…</span></div>;
}

export default function AdminWalletsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromParams(searchParams));
  const [result, setResult] = useState({ wallets: [], total: 0, totalPages: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const loadWallets = useCallback(async (signal) => {
    setLoading(true); setError("");
    try {
      const response = await adminWalletsApi.list(Object.fromEntries(searchParams), { signal });
      setResult(response.data);
    } catch (requestError) {
      if (requestError.code !== "ERR_CANCELED") setError(getAdminApiError(requestError, "Unable to load wallets."));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [searchParams]);

  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => loadWallets(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [loadWallets]);
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters(filtersFromParams(searchParams)), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const applyFilters = (event) => {
    event.preventDefault();
    if (filters.minBalance && filters.maxBalance && Number(filters.minBalance) > Number(filters.maxBalance)) return setFilterError("Minimum balance cannot exceed maximum balance.");
    setFilterError("");
    const next = {};
    for (const [key, value] of Object.entries(filters)) if (value !== "" && !(key === "sortBy" && value === "createdAt") && !(key === "sortOrder" && value === "desc")) next[key] = value;
    next.page = "1";
    setSearchParams(next);
  };

  const changePage = (page) => { const next = new URLSearchParams(searchParams); next.set("page", String(page)); setSearchParams(next); };

  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Finance</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Wallets</h1><p className="mt-2 text-sm text-slate-500">Review customer wallet ownership, balances, status, and recent activity.</p></div>
    <form onSubmit={applyFilters} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><span className="sr-only">Search wallets</span><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} className="input input-bordered w-full bg-white pl-10" placeholder="User or account number" /></label><label><span className="sr-only">Wallet status</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="select select-bordered w-full bg-white"><option value="">All statuses</option><option>ACTIVE</option><option>FROZEN</option><option>CLOSED</option></select></label><label><span className="sr-only">Minimum balance</span><input type="number" min="0" step="0.01" value={filters.minBalance} onChange={(event) => setFilters({ ...filters, minBalance: event.target.value })} className="input input-bordered w-full bg-white" placeholder="Min balance" /></label><label><span className="sr-only">Maximum balance</span><input type="number" min="0" step="0.01" value={filters.maxBalance} onChange={(event) => setFilters({ ...filters, maxBalance: event.target.value })} className="input input-bordered w-full bg-white" placeholder="Max balance" /></label><div className="flex gap-2"><select aria-label="Sort wallets" value={filters.sortBy} onChange={(event) => setFilters({ ...filters, sortBy: event.target.value })} className="select select-bordered min-w-0 flex-1 bg-white"><option value="createdAt">Created</option><option value="balance">Balance</option><option value="fullName">User</option><option value="accountStatus">Status</option></select><select aria-label="Sort direction" value={filters.sortOrder} onChange={(event) => setFilters({ ...filters, sortOrder: event.target.value })} className="select select-bordered bg-white"><option value="desc">↓</option><option value="asc">↑</option></select></div></div><div className="mt-3 flex items-center justify-between"><p className="text-sm text-rose-600" role="alert">{filterError}</p><button className="btn btn-sm border-0 bg-slate-900 text-white"><SlidersHorizontal size={15} /> Apply</button></div></form>

    {loading ? loadingRows() : error ? <AdminErrorState message={error} onRetry={() => loadWallets()} /> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex justify-between border-b border-slate-100 px-5 py-4 text-sm"><span className="font-medium">{result.total.toLocaleString()} wallets</span><span className="text-slate-500">Page {result.page} of {Math.max(result.totalPages, 1)}</span></div>{!result.wallets.length ? <div className="p-12 text-center"><WalletCards className="mx-auto text-slate-300" size={36} /><p className="mt-3 text-sm text-slate-500">No wallets match these filters.</p></div> : <><div className="hidden overflow-x-auto md:block"><table className="table"><thead><tr><th>User</th><th>Wallet ID</th><th>Available</th><th>Pending</th><th>Status</th><th>Last transaction</th><th /></tr></thead><tbody>{result.wallets.map((wallet) => <tr key={wallet._id}><td><p className="font-medium">{wallet.fullName}</p><p className="text-xs text-slate-500">{wallet.email}</p></td><td><p className="font-mono text-xs">{wallet._id}</p><p className="text-xs text-slate-500">{wallet.accountNumber}</p></td><td className="font-semibold">{formatTHB(wallet.balance ?? 0)}</td><td className="text-xs text-slate-500">Not supported</td><td><AdminStatusBadge status={wallet.accountStatus} /></td><td>{wallet.lastTransaction ? <><p className="font-mono text-xs">{wallet.lastTransaction.reference || wallet.lastTransaction.transactionId}</p><p className="text-xs text-slate-500">{safeDate(wallet.lastTransaction.createdAt)}</p></> : <span className="text-sm text-slate-500">No transactions</span>}</td><td><Link to={`/admin/wallets/${wallet._id}`} className="btn btn-ghost btn-sm bg-cyan-50 text-cyan-700 hover:bg-cyan-100"><Eye size={15} /> View</Link></td></tr>)}</tbody></table></div><div className="divide-y divide-slate-100 md:hidden">{result.wallets.map((wallet) => <article key={wallet._id} className="p-4"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{wallet.fullName}</p><p className="truncate font-mono text-xs text-slate-500">{wallet._id}</p></div><AdminStatusBadge status={wallet.accountStatus} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Available</p><p className="font-semibold">{formatTHB(wallet.balance ?? 0)}</p></div><div><p className="text-xs text-slate-500">Last transaction</p><p className="truncate text-xs">{wallet.lastTransaction ? safeDate(wallet.lastTransaction.createdAt) : "None"}</p></div></div><Link to={`/admin/wallets/${wallet._id}`} className="btn btn-sm mt-4 w-full border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200"><Eye size={15} /> View wallet</Link></article>)}</div></>}
      <div className="flex justify-between border-t border-slate-100 p-4"><button disabled={result.page <= 1} onClick={() => changePage(result.page - 1)} className="btn btn-sm border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"><ChevronLeft size={16} /> Previous</button><button disabled={result.page >= result.totalPages} onClick={() => changePage(result.page + 1)} className="btn btn-sm border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed">Next <ChevronRight size={16} /></button></div></section>}
  </div>;
}
