import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function BalancePage() {
  const [transactions, setTransactions] = useState([]);
  const navigate = useNavigate();
  const { user, getMe } = useAuthStore();

  // Load user
  useEffect(() => {
    getMe();
  }, []);

  // Load ALL transactions (important for monthly calc)
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

  // format account
  const formatAccount = (acc) => {
    if (!acc) return "";
    return acc.replace(/(.{4})/g, "$1 ").trim();
  };

  // MONTHLY CALCULATION
  const now = new Date();

  const monthlyTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.createdAt);
    return (
      txDate.getMonth() === now.getMonth() &&
      txDate.getFullYear() === now.getFullYear()
    );
  });

  const incomeMonth = monthlyTransactions
    .filter(
      (tx) => tx.receiver?.accountNumber === user?.accountNumber
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const expenseMonth = monthlyTransactions
    .filter(
      (tx) => tx.sender?.accountNumber === user?.accountNumber
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

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
        <h1 className="text-lg font-semibold">Balance</h1>
      </div>

      <div className="p-5 space-y-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">

        {/* BALANCE CARD */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-3xl shadow-lg text-center relative overflow-hidden">

          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

          <p className="text-sm opacity-80">Available Balance</p>
          <h1 className="text-4xl font-bold mt-2">
            ฿{(user?.balance || 0).toLocaleString()}
          </h1>

          <p className="mt-3 text-sm opacity-80">
            {user?.accountNumber
              ? formatAccount(user.accountNumber)
              : "---- ---- ----"}
          </p>
        </div>

        {/* MONTHLY INCOME / EXPENSE */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-base-100 p-4 rounded-2xl shadow text-center">
            <p className="text-xs opacity-60">This Month Income</p>
            <p className="font-semibold text-green-600">
              +฿{incomeMonth.toLocaleString()}
            </p>
          </div>

          <div className="bg-base-100 p-4 rounded-2xl shadow text-center">
            <p className="text-xs opacity-60">This Month Expense</p>
            <p className="font-semibold text-red-500">
              -฿{expenseMonth.toLocaleString()}
            </p>
          </div>
        </div>

        {/* RECENT TRANSACTIONS */}
        <div>
          <h2 className="text-sm font-semibold opacity-60 mb-3">
            Recent Activity
          </h2>

          <div className="space-y-2">
            {transactions.slice(0, 5).map((tx) => {
              const isReceive =
                tx.receiver?.accountNumber === user?.accountNumber;
              const isTopup = tx.type === "TOPUP";

              return (
                <div
                  key={tx._id}
                  className="bg-base-100 p-4 rounded-2xl shadow flex items-center gap-3"
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

      </div>
    </div>
  );
}