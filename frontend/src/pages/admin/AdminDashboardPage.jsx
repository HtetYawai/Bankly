import { useEffect, useState } from "react";
import axios from "axios";
import AdminNav from "../../components/AdminNav";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get("http://localhost:5001/api/admin/stats", {
          withCredentials: true,
        });
        setStats(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load admin stats");
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AdminNav />

      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Monitor customers, accounts, and transactions.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        {stats ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm uppercase tracking-wide text-slate-500">
                Total users
              </p>
              <p className="mt-4 text-4xl font-semibold text-slate-900">
                {stats.totalUsers}
              </p>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm uppercase tracking-wide text-slate-500">
                Total transactions
              </p>
              <p className="mt-4 text-4xl font-semibold text-slate-900">
                {stats.totalTransactions}
              </p>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
              <p className="text-sm uppercase tracking-wide text-slate-500">
                Total balance
              </p>
              <p className="mt-4 text-4xl font-semibold text-slate-900">
                ${stats.totalBalance.toFixed(2)}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            Loading statistics...
          </div>
        )}
      </div>
    </div>
  );
}
