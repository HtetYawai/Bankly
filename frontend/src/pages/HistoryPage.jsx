import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function HistoryPage() {
  const [transactions, setTransactions] = useState([]);
  const navigate = useNavigate();
  const { user, getMe } = useAuthStore();

  // Load user
  useEffect(() => {
    getMe();
  }, []);

  // Load ALL transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await api.get("/transactions");
        setTransactions(res.data);
      } catch {
        console.log("Failed to load transactions");
      }
    };

    fetchTransactions();
  }, []);

  // Format time
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // GROUP BY DATE
  const groupTransactions = () => {
    const groups = {
      Today: [],
      Yesterday: [],
      Older: [],
    };

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    transactions.forEach((tx) => {
      const txDate = new Date(tx.createdAt);

      if (txDate.toDateString() === today.toDateString()) {
        groups.Today.push(tx);
      } else if (txDate.toDateString() === yesterday.toDateString()) {
        groups.Yesterday.push(tx);
      } else {
        groups.Older.push(tx);
      }
    });

    return groups;
  };

  const grouped = groupTransactions();

  return (
    <div className="min-h-screen min-h-dvh bg-base-200">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 pb-5 pt-[calc(2.75rem+env(safe-area-inset-top))] rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Transaction History</h1>
      </div>

      <div className="p-4 space-y-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">

        {/* TRANSACTIONS */}
        {Object.entries(grouped).map(([label, list]) => {
          if (list.length === 0) return null;

          return (
            <div key={label}>
              <h2 className="text-sm font-semibold opacity-60 mb-3">
                {label}
              </h2>

              <div className="space-y-2">
                {list.map((tx) => {
                  const isReceive =
                    tx.receiver?.accountNumber === user?.accountNumber;
                  const isTopup = tx.type === "TOPUP";

                  return (
                    <div
                      key={tx._id}
                      onClick={() => navigate(`/transactions/${tx._id}`)}
                      className="bg-base-100 p-4 rounded-2xl shadow flex items-center gap-3 cursor-pointer active:scale-[0.99] transition"
                    >
                      {/* ICON */}
                      <div
                        className={`p-2 rounded-full ${
                          isReceive
                            ? "bg-green-100 text-green-600"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {isReceive ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </div>

                      {/* INFO */}
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {isReceive
                            ? "Money received"
                            : isTopup
                            ? "Top-up payment"
                            : "Transfer payment"}
                        </p>
                        <p className="text-xs opacity-60">
                          {formatTime(tx.createdAt)}
                        </p>
                      </div>

                      {/* AMOUNT */}
                      <div
                        className={`text-sm font-semibold ${
                          isReceive
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {isReceive ? "+" : "-"}฿
                        {tx.amount.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}