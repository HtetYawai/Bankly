import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import BottomNav from "../components/BottomNav";
import {
  Home,
  CreditCard,
  Bell,
  Settings,
  ScanLine,
  Send,
  Clock,
  Wallet,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();
  const { user, getMe } = useAuthStore();
  const [showBalance, setShowBalance] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    getMe();
  }, []);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await api.get("/transactions");
        setRecentTransactions(res.data.slice(0, 3));
      } catch {
        setRecentTransactions([]);
      }
    };
    fetchRecent();
  }, []);

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-base-200 flex flex-col justify-between">
      
      {/* TOP */}
      <div className="p-4">
        
        {/* CARD */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl p-5 shadow-lg">
          <p className="text-sm opacity-80">Welcome!</p>
          <h2 className="text-xl font-bold">{user?.fullName || "..."}</h2>

          {/* BALANCE WITH TOGGLE */}
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm opacity-70">Your Balance</p>
              <h1 className="text-3xl font-bold">
                {showBalance
                  ? `฿${(user?.balance || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
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

        {/* ACTION BUTTONS */}
        <div className="mt-5 overflow-x-auto">
          <div className="flex gap-3 w-max">

            <button
                onClick={() => navigate("/pin", { state: { redirectTo: "/transfer" } })}
                className="rounded-full px-5 py-2 flex items-center gap-2 bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                >
                <Send size={16} /> Transfer
                </button>

                <button
                onClick={() => navigate("/balance")}
                className="rounded-full px-5 py-2 flex items-center gap-2 bg-purple-100 text-purple-600 hover:bg-purple-200 transition"
                >
                <Wallet size={16} /> Balance
                </button>

                <button
                onClick={() => navigate("/history")}
                className="rounded-full px-5 py-2 flex items-center gap-2 bg-orange-100 text-orange-600 hover:bg-orange-200 transition"
                >
                <Clock size={16} /> History
                </button>

                <button
                onClick={() => navigate("/pin", { state: { redirectTo: "/topup" } })}
                className="rounded-full px-5 py-2 flex items-center gap-2 bg-green-100 text-green-600 hover:bg-green-200 transition"
                >
                <ArrowUp size={16} /> Top-up
                </button>


            </div>
        </div>

        {/* RECENT */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Recent Activity</h3>

          {recentTransactions.length === 0 ? (
            <p className="text-sm opacity-60 py-4">No recent activity yet.</p>
          ) : (
            recentTransactions.map((tx) => {
              const isReceive = tx.receiver?.accountNumber === user?.accountNumber;
              const isTopup = tx.type === "TOPUP";

              return (
                <div
                  key={tx._id}
                  onClick={() => navigate(`/transactions/${tx._id}`)}
                  className="flex items-center justify-between py-3 border-b cursor-pointer active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
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
                    <div>
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
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      isReceive ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {isReceive ? "+" : "-"}฿{tx.amount.toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <BottomNav />
    </div>
  );
}