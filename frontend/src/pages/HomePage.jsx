import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";
import BottomNav from "../components/BottomNav";
import { Send, Clock, Wallet, Eye, EyeOff, ArrowUp } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [showBalance, setShowBalance] = useState(true);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadTransactions = async () => {
      try {
        const res = await axios.get("http://localhost:5001/api/transactions", {
          withCredentials: true,
        });

        if (!cancelled) {
          setTransactions(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch home transactions", err);
      }
    };

    loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const { trend, favoriteRecipients } = useMemo(() => {
    if (!user || transactions.length === 0) {
      return { trend: null, favoriteRecipients: [] };
    }

    const userAccount = user.accountNumber;
    const outgoing = transactions.filter(
      (tx) => tx.sender?.accountNumber === userAccount,
    );

    const recipientCounts = outgoing.reduce((acc, tx) => {
      const key =
        tx.receiver?._id ||
        tx.receiver?.accountNumber ||
        tx.receiver?.name ||
        "";

      if (!key) return acc;

      const existing = acc[key] || {
        recipient: tx.receiver,
        count: 0,
        total: 0,
      };

      existing.count += 1;
      existing.total += tx.amount;
      acc[key] = existing;
      return acc;
    }, {});

    const favoriteRecipients = Object.values(recipientCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const lastWeekAmount = outgoing
      .filter((tx) => new Date(tx.createdAt) >= oneWeekAgo)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const prevWeekAmount = outgoing
      .filter(
        (tx) =>
          new Date(tx.createdAt) >= twoWeeksAgo &&
          new Date(tx.createdAt) < oneWeekAgo,
      )
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const percentChange = prevWeekAmount
      ? Math.round(((lastWeekAmount - prevWeekAmount) / prevWeekAmount) * 100)
      : lastWeekAmount
        ? 100
        : 0;

    const weeklyBudget = (user.dailyLimit || 20000) * 7;
    const progressValue = Math.min(
      100,
      Math.round((lastWeekAmount / weeklyBudget) * 100),
    );

    const trend = {
      lastWeekAmount,
      prevWeekAmount,
      percentChange,
      direction:
        lastWeekAmount > prevWeekAmount
          ? "up"
          : lastWeekAmount < prevWeekAmount
            ? "down"
            : "flat",
      weeklyBudget,
      progressValue,
    };

    return { trend, favoriteRecipients };
  }, [user, transactions]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col justify-between">
      {/* TOP */}
      <div className="p-4">
        {/* CARD */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl p-5 shadow-lg">
          <p className="text-sm opacity-80">Welcome!</p>

          <h2 className="text-xl font-bold">{user?.fullName || "..."}</h2>

          {/* BALANCE */}
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm opacity-70">Your Balance</p>

              <h1 className="text-3xl font-bold">
                {showBalance
                  ? `฿${user?.balance?.toFixed(2) || "0.00"}`
                  : "••••••"}
              </h1>
            </div>

            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-2 rounded-full hover:bg-white/20 transition"
            >
              {showBalance ? <Eye size={20} /> : <EyeOff size={20} />}
            </button>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* TRANSFER */}
          <button
            onClick={() => navigate("/pin")}
            className="group rounded-3xl bg-slate-950/95 border border-white/10 p-4 shadow-lg text-white transition hover:-translate-y-0.5"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Send size={20} />
            </div>

            <div className="mt-4 text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Transfer
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                Send money
              </p>
            </div>
          </button>

          {/* BALANCE */}
          <button
            onClick={() => navigate("/balance")}
            className="group rounded-3xl bg-slate-950/95 border border-white/10 p-4 shadow-lg text-white transition hover:-translate-y-0.5"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Wallet size={20} />
            </div>

            <div className="mt-4 text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Balance
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                Account details
              </p>
            </div>
          </button>

          {/* HISTORY */}
          <button
            onClick={() => navigate("/history")}
            className="group rounded-3xl bg-slate-950/95 border border-white/10 p-4 shadow-lg text-white transition hover:-translate-y-0.5"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Clock size={20} />
            </div>

            <div className="mt-4 text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                History
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                View activity
              </p>
            </div>
          </button>

          {/* TOPUP */}
          <button
            onClick={() => navigate("/topup")}
            className="group rounded-3xl bg-slate-950/95 border border-white/10 p-4 shadow-lg text-white transition hover:-translate-y-0.5"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <ArrowUp size={20} />
            </div>

            <div className="mt-4 text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Top-up
              </p>

              <p className="mt-2 text-sm font-semibold text-white">Add money</p>
            </div>
          </button>
        </div>

        {/* ANALYTICS */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {/* WEEKLY SPEND */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6 shadow-xl border border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
                  Weekly spend
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  ฿{trend?.lastWeekAmount?.toLocaleString() ?? "0"}
                </p>
              </div>

              <div
                className={`rounded-3xl px-4 py-2 text-sm font-semibold border border-white/10 shadow-sm ${
                  trend?.direction === "up"
                    ? "bg-emerald-100 text-emerald-700"
                    : trend?.direction === "down"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-800"
                }`}
              >
                {trend
                  ? trend.direction === "up"
                    ? `+${trend.percentChange}%`
                    : trend.direction === "down"
                      ? `${trend.percentChange}%`
                      : "Stable"
                  : "No data"}
              </div>
            </div>
          </div>

          {/* FAVORITE RECIPIENTS */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6 shadow-xl border border-white/10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Favorite recipients
                </p>

                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {favoriteRecipients.length > 0
                    ? "Top contacts"
                    : "Start sending"}
                </h3>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {favoriteRecipients.length > 0 ? (
                favoriteRecipients.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between gap-4 rounded-3xl bg-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                        {recipient.name?.[0] || "#"}
                      </div>

                      <div>
                        <p className="font-semibold text-white">
                          {recipient.name}
                        </p>

                        <p className="text-xs text-slate-300">
                          {recipient.accountNumber}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate("/transfer")}
                      className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Send
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-white/5 p-4 text-sm text-slate-300">
                  Send money a few times and your most frequent recipients will
                  show up here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <BottomNav />
    </div>
  );
}
