import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, Save, Settings } from "lucide-react";
import toast from "react-hot-toast";
import AdminErrorState from "../components/AdminErrorState";
import { adminSettingsApi, getAdminApiError } from "../services/adminApi";

const FIELDS = ["applicationName", "currency", "minimumTransferAmount", "maximumTransferAmount", "dailyTransferLimit", "transferFee", "withdrawalFee", "maintenanceMode"];
const MONEY_FIELDS = ["minimumTransferAmount", "maximumTransferAmount", "dailyTransferLimit", "transferFee", "withdrawalFee"];
function editable(settings) { return Object.fromEntries(FIELDS.map((field) => [field, settings[field]])); }

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const dirty = useMemo(() => saved && form && FIELDS.some((field) => String(saved[field]) !== String(form[field])), [saved, form]);
  const load = useCallback(async (signal) => { setLoading(true); setError(""); try { const response = await adminSettingsApi.get({ signal }); const values = editable(response.data.settings); setSaved(values); setForm(values); } catch (requestError) { if (requestError.code !== "ERR_CANCELED") setError(getAdminApiError(requestError, "Unable to load settings.")); } finally { if (!signal?.aborted) setLoading(false); } }, []);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => load(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);
  useEffect(() => { const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);

  const update = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setValidationError(""); };
  const validate = () => {
    if (!form.applicationName.trim()) return "Application name is required.";
    if (form.currency !== "THB") return "Currency must be THB.";
    for (const field of MONEY_FIELDS) { const value = Number(form[field]); if (!Number.isFinite(value) || value < 0) return `${field} must be a non-negative number.`; if (Math.round(value * 100) / 100 !== value) return `${field} cannot have more than two decimal places.`; }
    if (Number(form.minimumTransferAmount) > Number(form.maximumTransferAmount)) return "Minimum transfer cannot exceed maximum transfer.";
    return "";
  };
  const submit = async (event) => {
    event.preventDefault(); if (saving || !dirty) return;
    const invalid = validate(); if (invalid) return setValidationError(invalid);
    if (!saved.maintenanceMode && form.maintenanceMode && !window.confirm("Enable maintenance mode? User-initiated transfers will be unavailable until maintenance mode is disabled.")) { setForm((current) => ({ ...current, maintenanceMode: false })); return; }
    setSaving(true); setError("");
    try { const payload = { ...form, ...Object.fromEntries(MONEY_FIELDS.map((field) => [field, Number(form[field])])) }; await adminSettingsApi.update(payload); const refreshed = await adminSettingsApi.get(); const values = editable(refreshed.data.settings); setSaved(values); setForm(values); toast.success("System settings saved."); }
    catch (requestError) { const message = getAdminApiError(requestError, "Unable to save settings."); setError(message); toast.error(message); }
    finally { setSaving(false); }
  };
  if (loading && !form) return <div className="h-96 animate-pulse rounded-2xl bg-slate-200" role="status"><span className="sr-only">Loading settings…</span></div>;
  if (error && !form) return <AdminErrorState message={error} onRetry={() => load()} />;
  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">System</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Settings</h1><p className="mt-2 text-sm text-slate-500">Configure application identity, transfer limits, fees, and availability.</p></div>
    {dirty && <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status"><AlertTriangle className="shrink-0" size={20} /><div><p className="font-semibold">Unsaved changes</p><p className="mt-1">Save or discard your changes before leaving this page.</p></div></div>}
    {error && <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</div>}
    <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-semibold"><Settings size={18} /> System configuration</div><fieldset disabled={saving} className="grid gap-5 p-5 md:grid-cols-2"><label><span className="text-sm font-medium text-slate-700">Application name</span><input value={form.applicationName} onChange={(event) => update("applicationName", event.target.value)} maxLength={100} className="input input-bordered mt-2 w-full bg-white" /></label><label><span className="text-sm font-medium text-slate-700">Currency</span><select value={form.currency} onChange={(event) => update("currency", event.target.value)} className="select select-bordered mt-2 w-full bg-white"><option value="THB">THB — Thai baht</option></select></label>{MONEY_FIELDS.map((field) => <label key={field}><span className="text-sm font-medium text-slate-700">{{ minimumTransferAmount: "Minimum transfer", maximumTransferAmount: "Maximum transfer", dailyTransferLimit: "Daily transfer limit", transferFee: "Transfer fee", withdrawalFee: "Withdrawal fee" }[field]}</span><div className="relative mt-2"><span className="absolute left-3 top-3 text-sm text-slate-500">฿</span><input type="number" min="0" step="0.01" value={form[field]} onChange={(event) => update(field, event.target.value)} className="input input-bordered w-full bg-white pl-8" /></div></label>)}<label className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 md:col-span-2 ${form.maintenanceMode ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}><div><span className="font-semibold text-slate-800">Maintenance mode</span><p className="mt-1 text-sm text-slate-500">Temporarily prevent user-initiated transfers.</p></div><input type="checkbox" checked={form.maintenanceMode} onChange={(event) => update("maintenanceMode", event.target.checked)} className="toggle toggle-warning" /></label></fieldset>{validationError && <p className="mx-5 mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{validationError}</p>}<div className="flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end"><button type="button" disabled={!dirty || saving} onClick={() => { setForm({ ...saved }); setValidationError(""); setError(""); }} className="btn btn-sm border-2 border-slate-300 bg-slate-100 font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"><RotateCcw size={15} /> Discard changes</button><button type="submit" disabled={!dirty || saving} className="btn btn-sm border-0 bg-slate-900 text-white disabled:opacity-50 disabled:cursor-not-allowed">{saving ? <span className="loading loading-spinner loading-xs" /> : <Save size={15} />}{saving ? "Saving…" : "Save settings"}</button></div></form>
  </div>;
}
