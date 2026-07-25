import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/useAdminAuth";
import AdminStatusBadge from "../components/AdminStatusBadge";
import { adminAuthApi, getAdminApiError } from "../services/adminApi";
import { safeDate } from "../utils/formatters";

function PasswordField({ id, label, value, onChange, visible, onToggle, autoComplete, error }) {
  return <label htmlFor={id} className="block"><span className="text-sm font-medium text-slate-700">{label}</span><div className="relative mt-2"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`input input-bordered w-full bg-white pr-11 ${error ? "border-rose-400" : ""}`} /><button type="button" onClick={onToggle} className="absolute right-3 top-3 rounded text-slate-400 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{error && <p id={`${id}-error`} className="mt-1 text-sm text-rose-600" role="alert">{error}</p>}</label>;
}

export default function AdminProfilePage() {
  const { admin, logout, clearSession } = useAdminAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [visible, setVisible] = useState({ currentPassword: false, newPassword: false, confirmPassword: false });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const strength = useMemo(() => ({
    length: form.newPassword.length >= 8,
    mixedCase: /[a-z]/.test(form.newPassword) && /[A-Z]/.test(form.newPassword),
    number: /\d/.test(form.newPassword),
    symbol: /[^A-Za-z\d]/.test(form.newPassword),
  }), [form.newPassword]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setServerError("");
  };

  const validate = () => {
    const next = {};
    if (!form.currentPassword) next.currentPassword = "Current password is required.";
    if (!form.newPassword) next.newPassword = "New password is required.";
    else if (form.newPassword.length < 8) next.newPassword = "New password must be at least 8 characters.";
    else if (form.newPassword === form.currentPassword) next.newPassword = "New password must differ from the current password.";
    if (!form.confirmPassword) next.confirmPassword = "Confirm your new password.";
    else if (form.confirmPassword !== form.newPassword) next.confirmPassword = "New passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    setServerError("");
    try {
      const response = await adminAuthApi.changePassword(form);
      toast.success(response.data.message ?? "Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      clearSession();
      navigate("/admin/login", { replace: true });
    } catch (requestError) {
      setServerError(getAdminApiError(requestError, "Unable to change password."));
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return <div className="space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">System</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Admin Profile</h1><p className="mt-2 text-sm text-slate-500">Review the administrator identity and secure the account.</p></div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="bg-slate-950 p-6 text-white"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><UserRound size={27} /></div><div className="min-w-0 flex-1"><h2 className="truncate text-xl font-bold">{admin.name}</h2><p className="truncate text-sm text-slate-400">{admin.email}</p></div><AdminStatusBadge status={admin.status} /></div></div><dl className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs uppercase tracking-wide text-slate-500">Admin name</dt><dd className="mt-1 font-medium">{admin.name}</dd></div><div><dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt><dd className="mt-1 break-all font-medium">{admin.email}</dd></div><div><dt className="text-xs uppercase tracking-wide text-slate-500">Last login</dt><dd className="mt-1 text-sm font-medium">{safeDate(admin.lastLoginAt)}</dd></div><div><dt className="text-xs uppercase tracking-wide text-slate-500">Account created</dt><dd className="mt-1 text-sm font-medium">{safeDate(admin.createdAt)}</dd></div></dl><div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">Display-name updates are not supported by the current admin API. Identity fields are read-only.</div></section>

    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-2 border-b border-slate-100 px-6 py-4"><KeyRound size={18} /><div><h2 className="font-semibold">Change password</h2><p className="text-xs text-slate-500">Changing the password signs out every admin session, including this one.</p></div></header><form onSubmit={changePassword} className="space-y-5 p-6" noValidate aria-busy={submitting}><PasswordField id="current-admin-password" label="Current password" value={form.currentPassword} onChange={(value) => update("currentPassword", value)} visible={visible.currentPassword} onToggle={() => setVisible({ ...visible, currentPassword: !visible.currentPassword })} autoComplete="current-password" error={errors.currentPassword} /><div className="grid gap-5 md:grid-cols-2"><PasswordField id="new-admin-password" label="New password" value={form.newPassword} onChange={(value) => update("newPassword", value)} visible={visible.newPassword} onToggle={() => setVisible({ ...visible, newPassword: !visible.newPassword })} autoComplete="new-password" error={errors.newPassword} /><PasswordField id="confirm-admin-password" label="Confirm new password" value={form.confirmPassword} onChange={(value) => update("confirmPassword", value)} visible={visible.confirmPassword} onToggle={() => setVisible({ ...visible, confirmPassword: !visible.confirmPassword })} autoComplete="new-password" error={errors.confirmPassword} /></div>
      <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-medium text-slate-700">Password-strength guidance</p><ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><li className={strength.length ? "text-emerald-700" : "text-slate-500"}><Check size={15} className="mr-2 inline" />At least 8 characters (required)</li><li className={strength.mixedCase ? "text-emerald-700" : "text-slate-500"}><Check size={15} className="mr-2 inline" />Upper and lowercase letters</li><li className={strength.number ? "text-emerald-700" : "text-slate-500"}><Check size={15} className="mr-2 inline" />At least one number</li><li className={strength.symbol ? "text-emerald-700" : "text-slate-500"}><Check size={15} className="mr-2 inline" />At least one symbol</li></ul></div>
      {serverError && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{serverError}</div>}<div className="flex justify-end"><button type="submit" disabled={submitting} className="btn btn-sm border-0 bg-slate-900 text-white disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? <span className="loading loading-spinner loading-xs" /> : <ShieldCheck size={16} />}{submitting ? "Changing password…" : "Change password"}</button></div></form></section>
    <section className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-rose-900">End admin session</h2><p className="mt-1 text-sm text-rose-700">Sign out securely from this browser.</p></div><button type="button" onClick={handleLogout} disabled={loggingOut} className="btn btn-sm border-rose-200 bg-white text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed">{loggingOut ? <span className="loading loading-spinner loading-xs" /> : <LogOut size={16} />}{loggingOut ? "Logging out…" : "Logout"}</button></section>
  </div>;
}
