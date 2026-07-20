import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminErrorState({ title = "Unable to load this page", message, onRetry }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <AlertTriangle className="mx-auto text-rose-500" size={34} />
      <h2 className="mt-3 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
        {message ?? "An unexpected error occurred. Please try again."}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-sm mt-5 border-0 bg-slate-900 text-white hover:bg-slate-700">
          <RefreshCw size={15} /> Retry
        </button>
      )}
    </div>
  );
}
