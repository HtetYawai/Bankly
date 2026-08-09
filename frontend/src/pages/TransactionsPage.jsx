import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { useNavigate } from "react-router-dom";

export default function TransactionsPage() {
  // console.log(" TransactionsPage loaded");
  const [transactions, setTransactions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
  const fetchTransactions = async () => {
    try {
      console.log(" Calling /api/transactions...");

      const res = await api.get("/transactions")

      console.log(" RESPONSE:", res.data);

      setTransactions(res.data); 

    } catch (err) {
      console.log("ERROR STATUS:", err.response?.status);
      console.log("ERROR DATA:", err.response?.data);
    }
  };

  fetchTransactions();
}, []);

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">Transaction History</h1>

      {transactions.map((tx) => (
        <div
          key={tx._id}
          onClick={() => navigate(`/transactions/${tx._id}`)}
          className="bg-base-100 p-3 rounded-xl mb-2 shadow cursor-pointer active:scale-[0.99] transition"
        >
          <p className="font-medium">
            {tx.sender?.fullName ?? "Unknown"} → {tx.receiver?.fullName ?? (tx.type === "TOPUP" ? tx.note || "Top-up" : "Unknown")}
          </p>
          <p className="text-sm opacity-60">฿{tx.amount}</p>
          <p className="text-xs opacity-50">{tx.transactionId}</p>
        </div>
      ))}
    </div>
  );
}