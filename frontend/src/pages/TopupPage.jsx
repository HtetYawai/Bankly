import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function TopUpPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [selectedService, setSelectedService] = useState(null);
  const [amount, setAmount] = useState(100);
  const [reference, setReference] = useState("");

  const services = [
    {
      name: "TrueMove H",
      type: "Mobile",
      logo: "/assets/Truemove.webp",
    },
    {
      name: "AIS",
      type: "Mobile",
      logo: "/assets/AIS.png",
    },
    {
      name: "DTAC",
      type: "Mobile",
      logo: "/assets/dtac-logo-vector.png",
    },
    {
      name: "LINE Pay",
      type: "E-Wallet",
      logo: "/assets/linepay.png",
    },
    {
      name: "PromptPay",
      type: "Banking",
      logo: "/assets/promptpay.png",
    },
    {
      name: "Rabbit",
      type: "Transit",
      logo: "/assets/rabbit.webp",
    },
    {
      name: "GrabPay",
      type: "E-Wallet",
      logo: "/assets/grabpay.png",
    },
    {
      name: "ShopeePay",
      type: "E-Wallet",
      logo: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Shopee_logo.svg",
    },
    {
      name: "Lazada",
      type: "E-Wallet",
      logo: "/assets/lazada.png",
    },
  ];

  return (
    <div className="min-h-screen bg-base-200">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-5 rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Top Up</h1>
      </div>

      {/* GRID */}
      <div className="p-5 grid grid-cols-3 gap-4">
        {services.map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              setSelectedService(item);
              setAmount(100);
              setReference("");
            }}
            className={`rounded-3xl p-4 flex flex-col items-center justify-center text-center transition shadow ${
              selectedService?.name === item.name
                ? "bg-indigo-500 text-white shadow-indigo-300/30"
                : "bg-base-100 hover:scale-105"
            }`}
          >
            {/* LOGO */}
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center overflow-hidden mb-3">
              <img
                src={item.logo}
                alt={item.name}
                className="w-10 h-10 object-contain"
              />
            </div>

            {/* NAME */}
            <p className="text-sm font-medium">{item.name}</p>

            {/* TYPE */}
            <p className="text-xs opacity-70">{item.type}</p>
          </button>
        ))}
      </div>

      {selectedService && (
        <div className="p-5">
          <div className="rounded-3xl bg-white shadow-lg p-5 border border-slate-200">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {selectedService.type} Top Up
                </p>
                <h2 className="text-2xl font-semibold">
                  {selectedService.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter the destination reference and top-up amount to proceed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Change
              </button>
            </div>

            <div className="grid gap-4">
              <label className="block text-sm text-slate-700">
                <span className="block text-xs uppercase tracking-[0.3em] text-slate-400">
                  {selectedService.type === "Mobile"
                    ? "Phone number"
                    : selectedService.type === "Banking"
                      ? "Bank account"
                      : selectedService.type === "Transit"
                        ? "Transit card ID"
                        : "Wallet reference"}
                </span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={
                    selectedService.type === "Mobile"
                      ? "081-234-5678"
                      : selectedService.type === "Banking"
                        ? "123-456-7890"
                        : selectedService.type === "Transit"
                          ? "0000 1111 2222"
                          : "user@example.com"
                  }
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                />
              </label>

              <label className="block text-sm text-slate-700">
                <span className="block text-xs uppercase tracking-[0.3em] text-slate-400">
                  Amount
                </span>
                <input
                  type="number"
                  min="10"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  if (!reference.trim() || amount <= 0) return;

                  const transactionId = `TP${Date.now().toString().slice(-8)}`;
                  navigate("/success", {
                    state: {
                      sender: user,
                      receiver: {
                        fullName: selectedService.name,
                        accountNumber: reference,
                      },
                      amount,
                      transactionId,
                    },
                  });
                }}
                className="mt-2 w-full rounded-3xl bg-indigo-600 px-4 py-3 text-white font-semibold shadow hover:bg-indigo-700 transition"
              >
                Continue to Pay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
