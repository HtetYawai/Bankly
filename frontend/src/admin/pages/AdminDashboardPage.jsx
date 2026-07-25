import { createElement, useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, CheckCircle2, CircleDollarSign,
  Snowflake, TrendingUp, UserCheck, Users, WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import AdminErrorState from "../components/AdminErrorState";
import AdminStatusBadge from "../components/AdminStatusBadge";
import { adminApi, getAdminApiError } from "../services/adminApi";

const thb = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("en-US");
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

function inputDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { dateFrom: inputDate(from), dateTo: inputDate(to) };
}

function displayName(user, fallback) {
  return user?.fullName ?? user?.accountNumber ?? fallback;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard" role="status">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-3"><div className="h-80 animate-pulse rounded-2xl bg-slate-200 xl:col-span-2" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200" /></div>
      <span className="sr-only">Loading dashboard report…</span>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone = "cyan" }) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ${tones[tone]}`}>{createElement(icon, { size: 18, "aria-hidden": true })}</div>
      <p className="mt-4 truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl" title={String(value)}>{value}</p>
    </article>
  );
}

function VolumeChart({ data }) {
  const points = data.filter((item) => Number.isFinite(Number(item.volume)));
  if (!points.length) return <div className="grid h-56 place-items-center text-sm text-slate-500">No transaction-volume data in this range.</div>;
  const width = 720;
  const height = 240;
  const padding = 28;
  const maximum = Math.max(...points.map((item) => Number(item.volume)), 1);
  const coordinates = points.map((item, index) => ({
    ...item,
    x: points.length === 1 ? width / 2 : padding + index * ((width - padding * 2) / (points.length - 1)),
    y: height - padding - (Number(item.volume) / maximum) * (height - padding * 2),
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${coordinates.at(-1).x},${height - padding}`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-labelledby="volume-chart-title volume-chart-description">
        <title id="volume-chart-title">Transaction volume trend</title>
        <desc id="volume-chart-description">Daily successful transaction volume for the selected date range.</desc>
        <defs><linearGradient id="dashboard-volume-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity="0.28" /><stop offset="100%" stopColor="#06b6d4" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3].map((row) => <line key={row} x1={padding} x2={width - padding} y1={padding + row * 56} y2={padding + row * 56} stroke="#e2e8f0" strokeDasharray="4 5" />)}
        <polygon points={area} fill="url(#dashboard-volume-fill)" />
        <polyline points={line} fill="none" stroke="#0891b2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => <circle key={new Date(point.date).toISOString()} cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#0891b2" strokeWidth="3"><title>{`${shortDate.format(new Date(point.date))}: ${thb.format(point.volume)}`}</title></circle>)}
      </svg>
      <div className="flex justify-between text-xs text-slate-400"><span>{shortDate.format(new Date(points[0].date))}</span><span>{thb.format(maximum)} peak</span><span>{shortDate.format(new Date(points.at(-1).date))}</span></div>
    </div>
  );
}

function Section({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div><h2 className="font-semibold text-slate-900">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action}
      </header>
      {children}
    </section>
  );
}

export default function AdminDashboardPage() {
  const [range, setRange] = useState(defaultRange);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rangeError, setRangeError] = useState("");

  const loadDashboard = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const response = await adminApi.get("/reports/dashboard", {
        params: {
          dateFrom: `${appliedRange.dateFrom}T00:00:00.000Z`,
          dateTo: `${appliedRange.dateTo}T23:59:59.999Z`,
        },
        signal,
      });
      setReport(response.data);
    } catch (requestError) {
      if (requestError.code !== "ERR_CANCELED") setError(getAdminApiError(requestError, "Unable to load dashboard data."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [appliedRange]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadDashboard(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadDashboard]);

  const applyRange = (event) => {
    event.preventDefault();
    if (!range.dateFrom || !range.dateTo) return setRangeError("Select both start and end dates.");
    if (range.dateFrom > range.dateTo) return setRangeError("Start date cannot be later than end date.");
    const days = (new Date(range.dateTo) - new Date(range.dateFrom)) / 86400000;
    if (days > 366) return setRangeError("Date range cannot exceed 366 days.");
    setRangeError("");
    setAppliedRange(range);
  };

  const transactionTrend = report?.trendData?.transactions ?? [];
  const recentTransactions = report?.recentTransactions ?? [];
  const recentUsers = report?.recentUsers ?? [];
  const failedRecent = recentTransactions.filter((transaction) => transaction.status === "FAILED");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Operations overview</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Dashboard</h1><p className="mt-2 text-sm text-slate-500">Live account and transaction health from Bankly.</p></div>
        <form onSubmit={applyRange} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end" aria-label="Dashboard trend date range">
          <label className="text-xs font-medium text-slate-600">From<input type="date" value={range.dateFrom} max={range.dateTo} onChange={(event) => setRange({ ...range, dateFrom: event.target.value })} className="input input-sm input-bordered mt-1 block w-full bg-white" /></label>
          <label className="text-xs font-medium text-slate-600">To<input type="date" value={range.dateTo} min={range.dateFrom} max={inputDate(new Date())} onChange={(event) => setRange({ ...range, dateTo: event.target.value })} className="input input-sm input-bordered mt-1 block w-full bg-white" /></label>
          <button type="submit" className="btn btn-sm border-0 bg-slate-900 text-white">Apply</button>
        </form>
      </div>
      {rangeError && <p className="text-right text-sm text-rose-600" role="alert">{rangeError}</p>}

      {loading ? <DashboardSkeleton /> : error ? <AdminErrorState message={error} onRetry={() => loadDashboard()} /> : report && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Total users" value={integer.format(report.totalUsers ?? 0)} icon={Users} />
            <SummaryCard label="Active users" value={integer.format(report.activeUsers ?? 0)} icon={UserCheck} tone="emerald" />
            <SummaryCard label="Frozen users" value={integer.format(report.frozenUsers ?? 0)} icon={Snowflake} tone="indigo" />
            <SummaryCard label="Wallet balance" value={thb.format(report.totalWalletBalance ?? 0)} icon={WalletCards} tone="amber" />
            <SummaryCard label="Transactions today" value={integer.format(report.transactionsToday ?? 0)} icon={Activity} />
            <SummaryCard label="Volume today" value={thb.format(report.transactionVolumeToday ?? 0)} icon={TrendingUp} tone="indigo" />
            <SummaryCard label="Successful" value={integer.format(report.successfulTransactionCount ?? 0)} icon={CheckCircle2} tone="emerald" />
            <SummaryCard label="Failed" value={integer.format(report.failedTransactionCount ?? 0)} icon={AlertTriangle} tone="rose" />
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <Section title="Transaction-volume trend" subtitle="Successful volume in the selected UTC date range" className="xl:col-span-2"><div className="p-5"><VolumeChart data={transactionTrend} /></div></Section>
            <Section title="Frozen-account summary" subtitle="Current account restrictions" action={<Link to="/admin/users/frozen" className="text-xs font-semibold text-cyan-700 hover:underline">Review accounts</Link>}>
              <div className="p-5"><div className="flex items-center gap-4 rounded-xl bg-indigo-50 p-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><Snowflake size={22} /></div><div><p className="text-2xl font-bold text-slate-950">{integer.format(report.frozenUsers ?? 0)}</p><p className="text-sm text-slate-500">frozen of {integer.format(report.totalUsers ?? 0)} users</p></div></div><p className="mt-4 text-sm text-slate-500">{report.frozenUsers ? "Frozen customers remain able to view account information and contact support." : "No frozen customer accounts require review."}</p></div>
            </Section>
          </div>

          <Section title="Recent transactions" subtitle="Latest wallet activity" action={<Link to="/admin/transactions" className="text-xs font-semibold text-cyan-700 hover:underline">View all</Link>}>
            {!recentTransactions.length ? <div className="p-8 text-center text-sm text-slate-500">No transactions are available.</div> : <div className="overflow-x-auto"><table className="table"><thead><tr><th>Transaction</th><th>Sender</th><th>Receiver</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{recentTransactions.map((transaction) => <tr key={transaction._id}><td className="font-mono text-xs">{transaction.transactionId}</td><td>{displayName(transaction.sender, "System")}</td><td>{displayName(transaction.receiver, "System")}</td><td className="font-semibold">{thb.format(transaction.amount ?? 0)}</td><td><AdminStatusBadge status={transaction.status} /></td><td className="whitespace-nowrap text-xs text-slate-500">{dateTime.format(new Date(transaction.createdAt))}</td></tr>)}</tbody></table></div>}
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Recently registered users" subtitle="Newest customer accounts" action={<Link to="/admin/users" className="text-xs font-semibold text-cyan-700 hover:underline">View users</Link>}>
              {!recentUsers.length ? <div className="p-8 text-center text-sm text-slate-500">No registered users are available.</div> : <ul className="divide-y divide-slate-100">{recentUsers.slice(0, 6).map((user) => <li key={user._id} className="flex items-center gap-3 px-5 py-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{user.fullName?.charAt(0)?.toUpperCase() ?? "U"}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{user.fullName}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div><div className="text-right"><AdminStatusBadge status={user.accountStatus} /><p className="mt-1 text-xs text-slate-500">{shortDate.format(new Date(user.createdAt))}</p></div></li>)}</ul>}
            </Section>

            <Section title="Failed-transaction alerts" subtitle="Recent failures requiring attention" action={<Link to="/admin/transactions" className="text-xs font-semibold text-cyan-700 hover:underline">Investigate</Link>}>
              {!failedRecent.length ? <div className="p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={30} /><p className="mt-2 text-sm font-medium text-slate-700">No failures in recent activity</p>{report.failedTransactionCount > 0 && <p className="mt-1 text-xs text-slate-500">{integer.format(report.failedTransactionCount)} historical failed transactions remain in the full report.</p>}</div> : <ul className="divide-y divide-slate-100">{failedRecent.slice(0, 5).map((transaction) => <li key={transaction._id} className="flex items-center gap-3 px-5 py-4"><div className="grid h-9 w-9 place-items-center rounded-full bg-rose-50 text-rose-600"><AlertTriangle size={17} /></div><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs text-slate-700">{transaction.transactionId}</p><p className="text-xs text-slate-500">{dateTime.format(new Date(transaction.createdAt))}</p></div><p className="text-sm font-semibold text-rose-700">{thb.format(transaction.amount ?? 0)}</p><ArrowUpRight size={15} className="text-slate-400" /></li>)}</ul>}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
