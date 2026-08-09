export default function AdminLoading({ label = "Loading admin portal…" }) {
  return (
    <div className="min-h-screen min-h-dvh bg-slate-950 text-slate-200 flex items-center justify-center">
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <span className="loading loading-spinner loading-md text-cyan-400" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
