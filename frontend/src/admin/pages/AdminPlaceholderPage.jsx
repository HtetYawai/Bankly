import { Construction } from "lucide-react";

export default function AdminPlaceholderPage({ title, description }) {
  return (
    <section>
      <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Admin portal</p><h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-slate-500">{description}</p></div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><Construction className="mx-auto text-slate-400" size={34} /><h2 className="mt-3 font-semibold text-slate-700">Foundation ready</h2><p className="mt-1 text-sm text-slate-500">Page content will be implemented in the next phase.</p></div>
    </section>
  );
}
