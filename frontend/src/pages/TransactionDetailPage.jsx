import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function TransactionDetailPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user, getMe } = useAuthStore();
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMe();
  }, []);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const res = await api.get(`/transactions/${transactionId}`);
        setTransaction(res.data);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load transaction"
        );
      }
    };

    fetchTransaction();
  }, [transactionId]);

  const isReceive = transaction && transaction.receiver?._id === user?._id;
  const isTopup = transaction?.type === "TOPUP";

  const formatDateTime = (date) =>
    new Date(date).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="min-h-screen bg-base-200">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-5 rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Transaction Details</h1>
      </div>

      <div className="p-4">
        {error && (
          <div className="text-center text-sm opacity-60 mt-10">{error}</div>
        )}

        {!error && !transaction && (
          <div className="text-center text-sm opacity-60 mt-10">
            Loading...
          </div>
        )}

        {transaction && (
          <div className="bg-base-100 rounded-2xl shadow-md p-6 space-y-6">
            <div className="flex flex-col items-center text-center gap-2">
              <div
                className={`p-3 rounded-full ${
                  isReceive
                    ? "bg-green-100 text-green-600"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {isReceive ? (
                  <ArrowDownLeft size={24} />
                ) : (
                  <ArrowUpRight size={24} />
                )}
              </div>
              <p
                className={`text-2xl font-bold ${
                  isReceive ? "text-green-600" : "text-red-500"
                }`}
              >
                {isReceive ? "+" : "-"}฿{transaction.amount?.toLocaleString()}
              </p>
              <p className="text-sm opacity-60">
                {isReceive
                  ? "Money received"
                  : isTopup
                  ? "Top-up payment"
                  : "Money sent"}
              </p>
            </div>

            <div className="flex items-center justify-center gap-1 text-sm text-green-600">
              <CheckCircle2 size={16} />
              <span>{transaction.status}</span>
            </div>

            <div className="divide-y divide-base-200 text-sm">
              <div className="flex justify-between py-3">
                <span className="opacity-60">Transaction ID</span>
                <span className="font-medium">
                  {transaction.transactionId}
                </span>
              </div>

              <div className="flex justify-between py-3">
                <span className="opacity-60">Date & Time</span>
                <span className="font-medium">
                  {formatDateTime(transaction.createdAt)}
                </span>
              </div>

              <div className="flex justify-between py-3">
                <span className="opacity-60">From</span>
                <span className="font-medium text-right">
                  {transaction.sender?.fullName || "Unknown"}
                  <br />
                  <span className="text-xs opacity-60">
                    {transaction.sender?.accountNumber}
                  </span>
                </span>
              </div>

              <div className="flex justify-between py-3">
                <span className="opacity-60">To</span>
                <span className="font-medium text-right">
                  {isTopup
                    ? transaction.note || "Top-up"
                    : transaction.receiver?.fullName || "Unknown"}
                  <br />
                  <span className="text-xs opacity-60">
                    {isTopup
                      ? transaction.reference
                      : transaction.receiver?.accountNumber}
                  </span>
                </span>
              </div>

              {transaction.fee > 0 && (
                <div className="flex justify-between py-3">
                  <span className="opacity-60">Fee</span>
                  <span className="font-medium">
                    ฿{transaction.fee.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
