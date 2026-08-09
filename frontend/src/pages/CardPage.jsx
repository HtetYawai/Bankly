import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function CardPage() {
  const [transactions, setTransactions] = useState([]);
  const navigate = useNavigate();
  const { user, getMe } = useAuthStore();

  // Fetch user
  useEffect(() => {
    getMe();
  }, []);

  //Fetch transactions with polling
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
    const interval = setInterval(fetchTransactions, 3000);
    return () => clearInterval(interval);
  }, []);

  // format account
  const formatAccount = (acc) => {
    if (!acc) return "";
    return acc.replace(/(.{4})/g, "$1 ").trim();
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
        <h1 className="text-lg font-semibold">My Card</h1>
      </div>

      <div className="p-4 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">

        {/* CARD */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">

          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

          <p className="text-sm opacity-80">Acc Number</p>

          <div className="flex items-center justify-between">
            <p className="text-lg tracking-wider">
              {user?.accountNumber
                ? formatAccount(user.accountNumber)
                : "---- ---- ----"}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-sm opacity-80">Balance</p>
            <h1 className="text-3xl font-bold">
              ฿{(user?.balance || 0).toLocaleString()}
            </h1>
          </div>
        </div>

        {/* GROUPED TRANSACTIONS */}
        {Object.entries(grouped).map(([label, list]) => {
          if (list.length === 0) return null;

          return (
            <div key={label}>
              <h2 className="text-sm font-semibold opacity-60 mb-2">
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
                      className="bg-base-100 p-4 rounded-2xl shadow-md flex items-center gap-3"
                    >
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

                      <div className="flex-1">
                        <p className="text-sm">
                          {isReceive
                            ? "Money received"
                            : isTopup
                            ? "Top-up payment"
                            : "Transfer payment"}
                        </p>
                      </div>

                      <div
                        className={`text-sm font-medium ${
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