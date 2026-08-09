import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Gauge, KeyRound, Pencil, Snowflake, UserRound, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import AdminErrorState from "../components/AdminErrorState";
import { useAdminModalKeyboard } from "../hooks/useAdminModalKeyboard";
import AdminStatusBadge from "../components/AdminStatusBadge";
import { adminUsersApi, adminSettingsApi, getAdminApiError } from "../services/adminApi";

const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Field({ label, value }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || "—"}</dd></div>;
}

function Panel({ title, icon, children, className = "" }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}><header className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-900">{icon}{title}</header><div className="p-5">{children}</div></section>;
}

function StatusActionDialog({ mode, userName, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const freezing = mode === "freeze";
  useAdminModalKeyboard("status-dialog-title", onClose, submitting);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) return setError("A reason is required.");
    if (!confirmed) return setError("Confirm that you understand the effects.");
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try { await onConfirm(reason.trim()); } catch (actionError) { setError(getAdminApiError(actionError, `Unable to ${mode} account.`)); setSubmitting(false); }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="status-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className={`grid h-11 w-11 place-items-center rounded-xl ${freezing ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>{freezing ? <Snowflake size={22} /> : <CheckCircle2 size={22} />}</div><h2 id="status-dialog-title" className="mt-4 text-xl font-bold text-slate-950">{freezing ? "Freeze" : "Unfreeze"} {userName}?</h2><p className="mt-2 text-sm leading-6 text-slate-600">{freezing ? "Freezing immediately blocks transfers, payments, withdrawals, top-ups, payment-method changes, and sensitive identity changes. The customer can still sign in, view account data, and contact support." : "Unfreezing restores the customer’s ability to perform permitted financial actions. Existing freeze history remains recorded."}</p><form onSubmit={submit} className="mt-5"><label htmlFor="status-reason" className="text-sm font-medium text-slate-700">Reason</label><textarea id="status-reason" rows="4" value={reason} onChange={(event) => setReason(event.target.value)} className="textarea textarea-bordered mt-2 w-full bg-white" placeholder={`Reason for ${mode}ing this account`} autoFocus /><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="checkbox checkbox-sm mt-0.5" /><span className="text-sm text-slate-600">I confirm this administrative action and understand that it will be audited.</span></label>{error && <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={submitting} onClick={onClose} className="btn btn-sm border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed">Cancel</button><button type="submit" disabled={submitting || !reason.trim() || !confirmed} className={`btn btn-sm border-0 text-white disabled:opacity-50 disabled:cursor-not-allowed ${freezing ? "bg-sky-700" : "bg-emerald-700"}`}>{submitting && <span className="loading loading-spinner loading-xs" />}{freezing ? "Freeze account" : "Unfreeze account"}</button></div></form></div></div>;
}

function TransferLimitDialog({ userName, currentLimit, defaultLimit, onClose, onConfirm }) {
  const [useCustom, setUseCustom] = useState(currentLimit != null);
  const [amount, setAmount] = useState(currentLimit ?? defaultLimit ?? "");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useAdminModalKeyboard("limit-dialog-title", onClose, submitting);

  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) return setError("A reason is required.");
    if (useCustom) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value < 0) return setError("Enter a valid non-negative amount.");
    }
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm({
        maximumTransferAmount: useCustom ? Number(amount) : null,
        reason: reason.trim(),
      });
    } catch (actionError) {
      setError(getAdminApiError(actionError, "Unable to update transfer limit."));
      setSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="limit-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-100 text-cyan-700"><Gauge size={22} /></div><h2 id="limit-dialog-title" className="mt-4 text-xl font-bold text-slate-950">Transfer limit for {userName}</h2><p className="mt-2 text-sm leading-6 text-slate-600">Sets the maximum amount allowed on a single transfer or top-up for this customer. Leave it on the standard limit to follow the global setting.</p><form onSubmit={submit} className="mt-5 space-y-4"><div className="flex gap-4"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="radio" className="radio radio-sm" checked={!useCustom} onChange={() => setUseCustom(false)} /> Standard limit (฿{Number(defaultLimit ?? 0).toLocaleString()})</label><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="radio" className="radio radio-sm" checked={useCustom} onChange={() => setUseCustom(true)} /> Custom limit</label></div>{useCustom && <label><span className="text-sm font-medium text-slate-700">Maximum per transfer/top-up</span><div className="relative mt-2"><span className="absolute left-3 top-3 text-sm text-slate-500">฿</span><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="input input-bordered w-full bg-white pl-8" autoFocus /></div></label>}<label className="block"><span className="text-sm font-medium text-slate-700">Reason</span><textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} className="textarea textarea-bordered mt-2 w-full bg-white" placeholder="Reason for this change" /></label>{error && <p className="text-sm text-rose-600" role="alert">{error}</p>}<div className="mt-2 flex justify-end gap-3"><button type="button" disabled={submitting} onClick={onClose} className="btn btn-sm border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed">Cancel</button><button type="submit" disabled={submitting || !reason.trim()} className="btn btn-sm border-0 bg-slate-900 text-white disabled:opacity-50 disabled:cursor-not-allowed">{submitting && <span className="loading loading-spinner loading-xs" />}Save limit</button></div></form></div></div>;
}

export default function AdminUserDetailsPage() {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [defaultLimit, setDefaultLimit] = useState(null);

  const loadUser = useCallback(async (signal) => {
    setLoading(true); setError("");
    try { const response = await adminUsersApi.getById(userId, { signal }); setData(response.data); return true; }
    catch (requestError) { if (requestError.code !== "ERR_CANCELED") setError(getAdminApiError(requestError, "Unable to load user details.")); return false; }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [userId]);

  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => loadUser(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [loadUser]);
  useEffect(() => { adminSettingsApi.get().then((response) => setDefaultLimit(response.data.settings.maximumTransferAmount)).catch(() => {}); }, []);

  const updateLimit = async ({ maximumTransferAmount, reason }) => {
    await adminUsersApi.updateTransferLimit(userId, { maximumTransferAmount, reason });
    setLimitDialogOpen(false);
    const refreshed = await loadUser();
    if (refreshed) toast.success("Transfer limit updated.");
    else toast.error("Limit updated, but refreshed data could not be loaded.");
  };

  const changeStatus = async (reason) => {
    if (dialog === "freeze") await adminUsersApi.freeze(userId, reason); else await adminUsersApi.unfreeze(userId, reason);
    const action = dialog;
    setDialog(null);
    const refreshed = await loadUser();
    if (refreshed) toast.success(`Account ${action === "freeze" ? "frozen" : "unfrozen"} successfully.`);
    else toast.error(`Account ${action === "freeze" ? "freeze" : "unfreeze"} completed, but refreshed data could not be loaded.`);
  };

  const revokeSessions = async () => {
    if (!window.confirm("Revoke all active customer sessions? The customer will need to sign in again.")) return;
    setRevoking(true);
    try { await adminUsersApi.revokeSessions(userId); const refreshed = await loadUser(); if (refreshed) toast.success("Customer sessions revoked."); else toast.error("Sessions were revoked, but refreshed user data could not be loaded."); }
    catch (requestError) { toast.error(getAdminApiError(requestError, "Unable to revoke sessions.")); }
    finally { setRevoking(false); }
  };

  if (loading && !data) return <div className="space-y-4" role="status"><div className="h-28 animate-pulse rounded-2xl bg-slate-200" /><div className="grid gap-4 lg:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /><div className="h-64 animate-pulse rounded-2xl bg-slate-200" /></div><span className="sr-only">Loading user details…</span></div>;
  if (error && !data) return <AdminErrorState message={error} onRetry={() => loadUser()} />;
  const { user, recentTransactions = [] } = data;

  return <div className="space-y-6"><div><Link to={user.accountStatus === "FROZEN" ? "/admin/users/frozen" : "/admin/users"} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:underline"><ArrowLeft size={16} /> Back to users</Link><div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100 text-lg font-bold text-slate-600">{user.fullName?.charAt(0)?.toUpperCase()}</div><div className="min-w-0"><h1 className="truncate text-2xl font-bold text-slate-950">{user.fullName}</h1><p className="truncate text-sm text-slate-500">{user.email}</p></div><AdminStatusBadge status={user.accountStatus} /></div><div className="flex flex-wrap gap-2">{user.accountStatus === "ACTIVE" && <button onClick={() => setDialog("freeze")} className="btn btn-sm border-sky-200 bg-sky-50 text-sky-700"><Snowflake size={16} /> Freeze Account</button>}{user.accountStatus === "FROZEN" && <button onClick={() => setDialog("unfreeze")} className="btn btn-sm border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 size={16} /> Unfreeze Account</button>}<button onClick={revokeSessions} disabled={revoking} className="btn btn-sm border-0 bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">{revoking ? <span className="loading loading-spinner loading-xs" /> : <KeyRound size={16} />} Revoke Sessions</button></div></div></div>

    {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-2"><Panel title="Personal information" icon={<UserRound size={17} />}><dl className="grid grid-cols-1 gap-5 sm:grid-cols-2"><Field label="Full name" value={user.fullName} /><Field label="Email" value={user.email} /><Field label="Phone" value={user.phone} /><Field label="Account number" value={user.accountNumber} /></dl></Panel><Panel title="Wallet summary" icon={<WalletCards size={17} />}><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Available balance</p><p className="mt-2 text-3xl font-bold text-slate-950">{money.format(user.balance ?? 0)}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm text-slate-500">Wallet status</span><AdminStatusBadge status={user.accountStatus} /></div></Panel>
      <Panel title="Account status" icon={<Ban size={17} />}><dl className="grid grid-cols-1 gap-5 sm:grid-cols-2"><Field label="Current status" value={user.accountStatus} /><Field label="Frozen at" value={user.frozenAt ? dateTime.format(new Date(user.frozenAt)) : "Not frozen"} /><Field label="Freeze reason" value={user.frozenReason} /><Field label="Last unfrozen" value={user.unfrozenAt ? dateTime.format(new Date(user.unfrozenAt)) : "—"} /></dl></Panel><Panel title="Verification information" icon={<CheckCircle2 size={17} />}><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-medium text-slate-700">Verification workflow not configured</p><p className="mt-1 text-sm text-slate-500">This application currently has no customer verification-status field. No verification state is inferred or displayed.</p></div></Panel>
      <Panel title="Transfer limit" icon={<Gauge size={17} />}><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Maximum per transfer/top-up</p><p className="mt-2 text-2xl font-bold text-slate-950">{user.customMaximumTransferAmount != null ? money.format(user.customMaximumTransferAmount) : (defaultLimit != null ? `${money.format(defaultLimit)} (standard)` : "—")}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm text-slate-500">{user.customMaximumTransferAmount != null ? "Custom limit set for this customer" : "Following the standard system limit"}</span><button onClick={() => setLimitDialogOpen(true)} className="btn btn-sm border-slate-300 bg-white text-slate-700"><Pencil size={14} /> Edit</button></div></Panel>
    </div>

    <Panel title="Recent transactions" icon={<WalletCards size={17} />}>{!recentTransactions.length ? <p className="py-6 text-center text-sm text-slate-500">No recent transactions.</p> : <div className="overflow-x-auto"><table className="table"><thead><tr><th>Transaction ID</th><th>Type</th><th>Amount</th><th>Date</th></tr></thead><tbody>{recentTransactions.map((transaction) => <tr key={transaction._id}><td className="font-mono text-xs">{transaction.transactionId}</td><td>{transaction.type ?? "TRANSFER"}</td><td className="font-semibold">{money.format(transaction.amount ?? 0)}</td><td className="whitespace-nowrap text-sm text-slate-500">{dateTime.format(new Date(transaction.createdAt))}</td></tr>)}</tbody></table></div>}</Panel>

    <Panel title="Account activity" icon={<KeyRound size={17} />}><ol className="space-y-4 border-l border-slate-200 pl-5"><li><p className="text-sm font-medium text-slate-800">Account registered</p><p className="text-xs text-slate-500">{dateTime.format(new Date(user.createdAt))}</p></li>{user.frozenAt && <li><p className="text-sm font-medium text-sky-700">Account frozen</p><p className="text-xs text-slate-500">{dateTime.format(new Date(user.frozenAt))} · {user.frozenReason}</p></li>}{user.unfrozenAt && <li><p className="text-sm font-medium text-emerald-700">Account unfrozen</p><p className="text-xs text-slate-500">{dateTime.format(new Date(user.unfrozenAt))}</p></li>}</ol></Panel>
    {dialog && <StatusActionDialog mode={dialog} userName={user.fullName} onClose={() => setDialog(null)} onConfirm={changeStatus} />}
    {limitDialogOpen && <TransferLimitDialog userName={user.fullName} currentLimit={user.customMaximumTransferAmount} defaultLimit={defaultLimit} onClose={() => setLimitDialogOpen(false)} onConfirm={updateLimit} />}
  </div>;
}
