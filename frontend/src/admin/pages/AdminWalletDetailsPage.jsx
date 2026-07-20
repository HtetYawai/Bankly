import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowUpRight, CircleDollarSign, MinusCircle, PlusCircle, ShieldAlert, UserRound, WalletCards, X } from "lucide-react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import AdminErrorState from "../components/AdminErrorState";
import { useAdminModalKeyboard } from "../hooks/useAdminModalKeyboard";
import AdminStatusBadge from "../components/AdminStatusBadge";
import { adminWalletsApi, getAdminApiError } from "../services/adminApi";
import { formatTHB, partyName, safeDate } from "../utils/formatters";

function Panel({ title, children, className = "" }) { return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}><h2 className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">{title}</h2><div className="p-5">{children}</div></section>; }

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `admin-adjustment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function BalanceAdjustmentDialog({ wallet, ownerName, onClose, onSuccess }) {
  const [form, setForm] = useState({ type: "CREDIT", amount: "", reason: "", referenceNumber: "", note: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(newIdempotencyKey);
  useAdminModalKeyboard("adjustment-dialog-title", onClose, submitting);
  const amount = Number(form.amount);
  const validAmount = Number.isFinite(amount) && amount > 0 && Math.round(amount * 100) / 100 === amount;
  const exceedsBalance = form.type === "DEBIT" && validAmount && amount > wallet.availableBalance;
  const balanceAfter = validAmount
    ? wallet.availableBalance + (form.type === "CREDIT" ? amount : -amount)
    : wallet.availableBalance;

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!validAmount) return setError("Amount must be positive and have no more than two decimal places.");
    if (exceedsBalance) return setError("Debit amount exceeds the available wallet balance.");
    if (!form.reason.trim()) return setError("A reason is required.");
    if (!confirmed) return setError("Confirm that you understand and authorize this adjustment.");

    setSubmitting(true);
    setError("");
    try {
      const response = await adminWalletsApi.adjust(wallet._id, {
        type: form.type,
        amount,
        reason: form.reason.trim(),
        referenceNumber: form.referenceNumber.trim() || undefined,
        note: form.note.trim() || undefined,
      }, idempotencyKey);
      await onSuccess(response.data);
    } catch (requestError) {
      setError(getAdminApiError(requestError, "Unable to apply the balance adjustment."));
      setSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/70 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="adjustment-dialog-title" className="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">Secure financial action</p><h2 id="adjustment-dialog-title" className="mt-1 text-xl font-bold text-slate-950">Balance adjustment</h2><p className="mt-1 text-sm text-slate-500">{ownerName} · {wallet.accountNumber}</p></div><button type="button" disabled={submitting} onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close adjustment dialog"><X size={20} /></button></div>
    <form onSubmit={submit} className="p-5 sm:p-6"><fieldset disabled={submitting}><legend className="text-sm font-medium text-slate-700">Adjustment type</legend><div className="mt-2 grid grid-cols-2 gap-3"><label className={`cursor-pointer rounded-xl border p-4 transition ${form.type === "CREDIT" ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : "border-slate-200"}`}><input type="radio" name="adjustment-type" value="CREDIT" checked={form.type === "CREDIT"} onChange={(event) => update("type", event.target.value)} className="sr-only" /><div className="flex items-center gap-2 font-semibold text-emerald-700"><PlusCircle size={19} /> Credit</div><p className="mt-1 text-xs text-slate-500">Increase the wallet balance</p></label><label className={`cursor-pointer rounded-xl border p-4 transition ${form.type === "DEBIT" ? "border-rose-500 bg-rose-50 ring-1 ring-rose-500" : "border-slate-200"}`}><input type="radio" name="adjustment-type" value="DEBIT" checked={form.type === "DEBIT"} onChange={(event) => update("type", event.target.value)} className="sr-only" /><div className="flex items-center gap-2 font-semibold text-rose-700"><MinusCircle size={19} /> Debit</div><p className="mt-1 text-xs text-slate-500">Decrease the wallet balance</p></label></div></fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-1"><span className="text-sm font-medium text-slate-700">Amount</span><div className="relative mt-2"><span className="absolute left-3 top-3 text-sm text-slate-500">฿</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => update("amount", event.target.value)} disabled={submitting} className="input input-bordered w-full bg-white pl-8" placeholder="0.00" autoFocus /></div></label><label><span className="text-sm font-medium text-slate-700">Reference number <span className="font-normal text-slate-400">(optional)</span></span><input value={form.referenceNumber} onChange={(event) => update("referenceNumber", event.target.value)} disabled={submitting} maxLength={200} className="input input-bordered mt-2 w-full bg-white" placeholder="External reference" /></label><label className="sm:col-span-2"><span className="text-sm font-medium text-slate-700">Reason <span className="text-rose-600">*</span></span><textarea required rows="3" value={form.reason} onChange={(event) => update("reason", event.target.value)} disabled={submitting} maxLength={1000} className="textarea textarea-bordered mt-2 w-full bg-white" placeholder="Business reason for this adjustment" /></label><label className="sm:col-span-2"><span className="text-sm font-medium text-slate-700">Internal note <span className="font-normal text-slate-400">(optional)</span></span><textarea rows="2" value={form.note} onChange={(event) => update("note", event.target.value)} disabled={submitting} maxLength={1000} className="textarea textarea-bordered mt-2 w-full bg-white" placeholder="Additional internal context" /></label></div>
      <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200"><div className="p-4"><p className="text-xs text-slate-500">Current balance</p><p className="mt-1 font-bold text-slate-900">{formatTHB(wallet.availableBalance)}</p></div><div className={`border-l border-slate-200 p-4 ${exceedsBalance ? "bg-rose-50" : form.type === "CREDIT" ? "bg-emerald-50" : "bg-slate-50"}`}><p className="text-xs text-slate-500">Balance after adjustment</p><p className={`mt-1 font-bold ${exceedsBalance ? "text-rose-700" : "text-slate-900"}`}>{formatTHB(balanceAfter)}</p></div></div>
      {exceedsBalance && <div className="mt-3 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert"><AlertTriangle className="shrink-0" size={18} /> This debit exceeds the available balance and cannot be submitted.</div>}
      <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="shrink-0" size={20} /><div><p className="font-semibold">Security warning</p><p className="mt-1 leading-5">This changes real wallet funds and creates permanent transaction, ledger, notification, and audit records. Verify the type, amount, and customer before continuing.</p></div></div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={submitting} className="checkbox checkbox-sm mt-0.5" /><span className="text-sm text-slate-700">I have verified this adjustment and explicitly authorize the balance change.</span></label>
      {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={submitting} onClick={onClose} className="btn btn-sm bg-white">Cancel</button><button type="submit" disabled={submitting || !confirmed || !form.reason.trim() || !validAmount || exceedsBalance} className={`btn btn-sm border-0 text-white ${form.type === "CREDIT" ? "bg-emerald-700" : "bg-rose-700"}`}>{submitting && <span className="loading loading-spinner loading-xs" />}{submitting ? "Processing…" : `${form.type === "CREDIT" ? "Credit" : "Debit"} wallet`}</button></div>
    </form></div></div>;
}

export default function AdminWalletDetailsPage() {
  const { walletId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [createdReference, setCreatedReference] = useState("");
  const loadWallet = useCallback(async (signal) => { setLoading(true); setError(""); try { const response = await adminWalletsApi.getById(walletId, { signal }); setData(response.data); return true; } catch (requestError) { if (requestError.code !== "ERR_CANCELED") setError(getAdminApiError(requestError, "Unable to load wallet.")); return false; } finally { if (!signal?.aborted) setLoading(false); } }, [walletId]);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => loadWallet(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [loadWallet]);
  if (loading && !data) return <div className="h-80 animate-pulse rounded-2xl bg-slate-200" role="status"><span className="sr-only">Loading wallet…</span></div>;
  if (error && !data) return <AdminErrorState message={error} onRetry={() => loadWallet()} />;
  const { wallet, owner, totalSent, totalReceived, recentLedgerEntries = [], recentTransactions = [] } = data;
  const adjustmentSucceeded = async (result) => {
    const refreshed = await loadWallet();
    const reference = result.adjustment?.referenceNumber || result.adjustment?.transactionId || result.adjustment?._id;
    setCreatedReference(reference);
    setAdjustmentOpen(false);
    if (refreshed) toast.success(`Balance adjustment completed: ${reference}`);
    else toast.error(`Adjustment ${reference} completed, but authoritative wallet data could not be refreshed.`);
  };
  return <div className="space-y-6"><div><Link to="/admin/wallets" className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700"><ArrowLeft size={16} /> Back to wallets</Link><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Wallet details</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{owner.fullName}</h1><p className="mt-1 font-mono text-xs text-slate-500">{wallet._id}</p></div><button type="button" onClick={() => { setCreatedReference(""); setAdjustmentOpen(true); }} className="btn btn-sm border-0 bg-slate-900 text-white"><CircleDollarSign size={16} /> Balance Adjustment</button></div></div>
    {error && <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{error}</span><button type="button" onClick={() => loadWallet()} className="btn btn-sm bg-white">Retry refresh</button></div>}
    {createdReference && <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between" role="status"><span><strong>Adjustment completed.</strong> Created reference: <span className="font-mono">{createdReference}</span></span><button type="button" onClick={() => setCreatedReference("")} className="self-start text-xs font-semibold hover:underline">Dismiss</button></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs text-slate-400">Current balance</p><p className="mt-2 text-2xl font-bold">{formatTHB(wallet.availableBalance ?? 0)}</p><div className="mt-4"><AdminStatusBadge status={wallet.status} /></div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Total received</p><p className="mt-2 text-2xl font-bold text-emerald-700">{formatTHB(totalReceived ?? 0)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Total sent</p><p className="mt-2 text-2xl font-bold text-rose-700">{formatTHB(totalSent ?? 0)}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">Pending balance</p><p className="mt-2 text-sm font-medium text-slate-400">Not supported by this wallet model</p></div></div>
    <Panel title="User summary"><div className="flex items-start gap-4"><div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100"><UserRound size={20} /></div><dl className="grid flex-1 gap-4 sm:grid-cols-2"><div><dt className="text-xs text-slate-500">Owner</dt><dd className="font-medium">{owner.fullName}</dd></div><div><dt className="text-xs text-slate-500">Email</dt><dd className="break-all text-sm">{owner.email}</dd></div><div><dt className="text-xs text-slate-500">Phone</dt><dd className="text-sm">{owner.phone}</dd></div><div><dt className="text-xs text-slate-500">Account number</dt><dd className="font-mono text-sm">{wallet.accountNumber}</dd></div></dl></div></Panel>
    <Panel title="Recent ledger entries">{!recentLedgerEntries.length ? <p className="py-6 text-center text-sm text-slate-500">No ledger entries available.</p> : <div className="overflow-x-auto"><table className="table"><thead><tr><th>Date</th><th>Transaction</th><th>Entry</th><th>Amount</th><th>Before</th><th>After</th></tr></thead><tbody>{recentLedgerEntries.map((entry) => <tr key={entry._id}><td className="whitespace-nowrap text-xs">{safeDate(entry.createdAt)}</td><td className="font-mono text-xs">{entry.transactionId?.reference || entry.transactionId?.transactionId || "—"}</td><td><AdminStatusBadge status={entry.type} /></td><td className="font-semibold">{formatTHB(entry.amount ?? 0)}</td><td>{formatTHB(entry.balanceBefore ?? 0)}</td><td>{formatTHB(entry.balanceAfter ?? 0)}</td></tr>)}</tbody></table></div>}</Panel>
    <Panel title="Recent transactions">{!recentTransactions.length ? <div className="py-8 text-center text-sm text-slate-500"><WalletCards className="mx-auto mb-2 text-slate-300" />No recent transactions.</div> : <div className="overflow-x-auto"><table className="table"><thead><tr><th>Reference</th><th>Sender</th><th>Receiver</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{recentTransactions.map((transaction) => <tr key={transaction._id}><td className="font-mono text-xs">{transaction.reference || transaction.transactionId}</td><td>{partyName(transaction.sender)}</td><td>{partyName(transaction.receiver)}</td><td className="text-xs">{transaction.type}</td><td className="font-semibold">{formatTHB(transaction.amount ?? 0)}</td><td><AdminStatusBadge status={transaction.status} /></td><td className="whitespace-nowrap text-xs">{safeDate(transaction.createdAt)}</td><td><Link to={`/admin/transactions/${transaction._id}`} aria-label="View transaction"><ArrowUpRight size={16} /></Link></td></tr>)}</tbody></table></div>}</Panel>
    {adjustmentOpen && <BalanceAdjustmentDialog wallet={wallet} ownerName={owner.fullName} onClose={() => setAdjustmentOpen(false)} onSuccess={adjustmentSucceeded} />}
  </div>;
}
