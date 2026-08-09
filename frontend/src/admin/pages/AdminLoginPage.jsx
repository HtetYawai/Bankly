import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/useAdminAuth";
import AdminLoading from "../components/AdminLoading";

export default function AdminLoginPage() {
  const { isAuthenticated, isLoading, authError, sessionExpired, login, clearAuthError } = useAdminAuth();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => () => clearAuthError(), [clearAuthError]);
  if (isLoading) return <AdminLoading label="Checking admin session…" />;
  if (isAuthenticated) return <Navigate to="/admin/dashboard" replace />;

  const validate = () => {
    const errors = {};
    const email = credentials.email.trim();
    if (!email) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Enter a valid email address.";
    if (!credentials.password) errors.password = "Password is required.";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    const result = await login({ email: credentials.email.trim(), password: credentials.password });
    setSubmitting(false);
    if (result.ok) {
      const from = location.state?.from;
      navigate(from ? `${from.pathname}${from.search ?? ""}${from.hash ?? ""}` : "/admin/dashboard", { replace: true });
    }
  };

  const authenticationMessage = authError === "Invalid credentials."
    ? "Unable to sign in. The credentials are invalid or the administrator account is temporarily locked."
    : authError;

  return (
    <div className="relative min-h-screen min-h-dvh overflow-hidden bg-slate-950 px-4 py-10 text-slate-100 flex items-center justify-center">
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950 shadow-lg" aria-hidden="true"><WalletCards size={31} /></div>
          <p className="mt-4 text-sm font-semibold tracking-wide text-cyan-300">BANKLY WALLET</p>
          <h1 className="mt-1 text-3xl font-bold">Admin Portal</h1>
          <p className="mt-2 text-sm text-slate-400">Secure operations workspace</p>
        </div>
        <form onSubmit={submit} noValidate aria-busy={submitting} className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur sm:p-8">
          {(sessionExpired || authenticationMessage) && (
            <div id="admin-auth-error" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100" role="alert">
              {sessionExpired ? "Your admin session expired. Please sign in again." : authenticationMessage}
            </div>
          )}

          <div className="form-control">
            <label htmlFor="admin-email" className="mb-2 text-sm font-medium text-slate-300">Email address</label>
            <input id="admin-email" type="email" autoFocus autoComplete="username" inputMode="email" value={credentials.email} onChange={(event) => { setCredentials({ ...credentials, email: event.target.value }); setValidationErrors((errors) => ({ ...errors, email: "" })); }} aria-invalid={Boolean(validationErrors.email)} aria-describedby={validationErrors.email ? "admin-email-error" : undefined} className={`input input-bordered w-full bg-slate-950 text-white focus:border-cyan-400 ${validationErrors.email ? "border-rose-400" : "border-slate-700"}`} placeholder="admin@example.com" />
            {validationErrors.email && <p id="admin-email-error" className="mt-1.5 text-sm text-rose-300" role="alert">{validationErrors.email}</p>}
          </div>

          <div className="form-control mt-4">
            <label htmlFor="admin-password" className="mb-2 text-sm font-medium text-slate-300">Password</label>
            <div className="relative">
              <input id="admin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={credentials.password} onChange={(event) => { setCredentials({ ...credentials, password: event.target.value }); setValidationErrors((errors) => ({ ...errors, password: "" })); }} aria-invalid={Boolean(validationErrors.password)} aria-describedby={validationErrors.password ? "admin-password-error" : undefined} className={`input input-bordered w-full bg-slate-950 pr-12 text-white focus:border-cyan-400 ${validationErrors.password ? "border-rose-400" : "border-slate-700"}`} placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 rounded text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </div>
            {validationErrors.password && <p id="admin-password-error" className="mt-1.5 text-sm text-rose-300" role="alert">{validationErrors.password}</p>}
          </div>

          <button type="submit" disabled={submitting} className="btn mt-6 w-full border-0 bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? <span className="loading loading-spinner loading-sm" aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <div className="mt-6 border-t border-slate-800 pt-5 text-center">
            <div className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><ShieldCheck size={15} aria-hidden="true" /> Security notice</div>
            <p className="text-sm leading-6 text-slate-400">Admin access is restricted. Only the authorized system administrator may sign in.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
