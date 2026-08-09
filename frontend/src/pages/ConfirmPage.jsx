import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function ConfirmPage() {
  const { refreshUser } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fee, setFee] = useState(0);

  const state = location.state || {};
  const isTopup = state.type === "topup";

  useEffect(() => {
    if (isTopup) return;

    const fetchFee = async () => {
      try {
        const res = await api.get("/settings");
        setFee(res.data.transferFee || 0);
      } catch {
        console.log("Failed to load transfer fee");
      }
    };

    fetchFee();
  }, []);

  const invalid = isTopup
    ? !state.sender || !state.provider || !state.accountRef || !state.amount
    : !state.sender || !state.receiver || !state.amount;

  if (invalid) {
    console.log("STATE DEBUG:", state);
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="text-center">
          <p className="text-red-500 mb-4">
            Invalid or expired transaction data
          </p>
          <button
            onClick={() => navigate(isTopup ? "/topup" : "/transfer")}
            className="btn btn-primary"
          >
            Back to {isTopup ? "Top Up" : "Transfer"}
          </button>
        </div>
      </div>
    );
  }

  const { sender, receiver, amount, provider, accountRef } = state;

  const maskAccount = (acc) => {
    if (!acc) return "-";
    return acc.slice(0, 3) + "-xxxx-xx" + acc.slice(-2);
  };

  const handleConfirm = async () => {
  try {
    setLoading(true);

    if (isTopup) {
      const res = await api.post("/topup", { provider, accountRef, amount });

      await refreshUser();

      navigate("/success", {
        state: {
          type: "topup",
          sender,
          provider,
          accountRef,
          amount,
          transactionId: res.data.transactionId,
        },
      });
      return;
    }

    const res = await api.post("/transfer", {
      receiverAcc: receiver.accountNumber,
      amount,
    });

    // refresh balance instantly
    await refreshUser();

    navigate("/success", {
      state: {
        sender,
        receiver,
        amount,
        transactionId: res.data.transactionId,
      },
    });
  } catch (err) {
    alert(err.response?.data?.message || (isTopup ? "Top-up failed" : "Transfer failed"));
  } finally {
    setLoading(false);
  }
};
  return (
    <div className="min-h-screen bg-base-200">

      {/* GRADIENT HEADER */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-5 rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">
          {isTopup ? "Confirm Top Up" : "Confirm Transfer"}
        </h1>
      </div>

      <div className="p-4 space-y-4">

        {/* AMOUNT CARD (highlight) */}
        <div className="bg-base-100 rounded-2xl shadow-md p-5 text-center">
          <p className="text-sm opacity-60">Amount</p>
          <h1 className="text-3xl font-bold text-indigo-600 mt-1">
            ฿{Number(amount).toLocaleString()}
          </h1>
        </div>

        {/* FROM */}
        <div className="bg-base-100 rounded-2xl shadow-md p-4">
          <p className="text-sm opacity-60 mb-2">From</p>

          <div className="flex justify-between text-sm">
            <span className="opacity-60">Name</span>
            <span>{sender.fullName}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="opacity-60">Account</span>
            <span>{maskAccount(sender.accountNumber)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="opacity-60">Bank</span>
            <span>Bankly</span>
          </div>
        </div>

        {/* TO */}
        <div className="bg-base-100 rounded-2xl shadow-md p-4">
          <p className="text-sm opacity-60 mb-2">To</p>

          {isTopup ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Service</span>
                <span>{provider}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="opacity-60">Number</span>
                <span>{accountRef}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Name</span>
                <span>{receiver.fullName}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="opacity-60">Account</span>
                <span>{maskAccount(receiver.accountNumber)}</span>
              </div>
            </>
          )}
        </div>

        {/* FEE */}
        <div className="bg-base-100 rounded-2xl shadow-md p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="opacity-60">Fee</span>
            <span className={fee > 0 ? "" : "text-green-600"}>
              {fee > 0 ? `฿${fee.toLocaleString()}` : "0.00 THB"}
            </span>
          </div>

          {fee > 0 && (
            <div className="flex justify-between text-sm font-medium pt-2 border-t border-base-200">
              <span className="opacity-60">Total deducted</span>
              <span>฿{(Number(amount) + fee).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* ACTION */}
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="btn w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-none rounded-xl disabled:opacity-50"
        >
          {loading ? "Processing..." : "Confirm"}
        </button>

        <button
          onClick={() => navigate(-1)}
          disabled={loading}
          className="text-center w-full text-sm opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}