import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/axios";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

// Logos are a frontend-only concern; provider names/types come from the
// backend so the two never drift out of sync (see topupProviders.js).
const LOGOS = {
  "TrueMove H": "/assets/Truemove.webp",
  AIS: "/assets/AIS.png",
  DTAC: "/assets/dtac-logo-vector.png",
  "LINE Pay": "/assets/linepay.png",
  PromptPay: "/assets/promptpay.png",
  Rabbit: "/assets/rabbit.webp",
  GrabPay: "/assets/grabpay.png",
  ShopeePay: "/assets/shopeepay.svg",
  Lazada: "/assets/lazada.png",
};

// PromptPay isn't a provider top-up: it credits a real Bankly account via QR,
// so it's added client-side and routed straight into the scan/transfer flow.
const PROMPTPAY = { name: "PromptPay", type: "Banking", logo: LOGOS.PromptPay };

export default function TopUpPage() {
  const navigate = useNavigate();
  const { user, getMe } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [service, setService] = useState(null);
  const [accountRef, setAccountRef] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      await getMe();

      try {
        const res = await api.get("/topup/providers");
        const providers = res.data.map((p) => ({ ...p, logo: LOGOS[p.name] }));
        setServices([...providers, PROMPTPAY]);
      } catch {
        setServices([PROMPTPAY]);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading]);

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value < 0) return;
    setAmount(value);
  };

  const handleContinue = () => {
    const ref = accountRef.trim();
    const amt = Number(amount);

    if (ref.length < 4) {
      return alert("Enter a valid phone or account number");
    }
    if (!amt || amt <= 0) {
      return alert("Enter valid amount");
    }
    if (amt > user.balance) {
      return alert("Insufficient balance");
    }

    navigate("/confirm", {
      state: {
        type: "topup",
        sender: user,
        provider: service.name,
        providerType: service.type,
        accountRef: ref,
        amount: amt,
      },
    });
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!user) return <div className="p-4 text-center">User not found</div>;

  return (
    <div className="min-h-screen min-h-dvh bg-base-200">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 pb-5 pt-[calc(2.75rem+env(safe-area-inset-top))] rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => (service ? setService(null) : navigate("/"))}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Top Up</h1>
      </div>

      {!service && (
        <div className="p-5 grid grid-cols-3 gap-4">
          {services.map((item) => (
            <button
              key={item.name}
              onClick={() =>
                item.name === "PromptPay"
                  ? navigate("/scan")
                  : setService(item)
              }
              className="bg-base-100 rounded-3xl shadow p-4 flex flex-col items-center justify-center text-center hover:scale-105 transition"
            >
              {/* LOGO */}
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-3">
                <img
                  src={item.logo}
                  alt={item.name}
                  className="w-10 h-10 object-contain"
                />
              </div>

              {/* NAME */}
              <p className="text-sm font-medium">{item.name}</p>

              {/* TYPE */}
              <p className="text-xs opacity-60">{item.type}</p>
            </button>
          ))}
        </div>
      )}

      {service && (
        <div className="p-4 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">

          {/* SELECTED SERVICE */}
          <div className="bg-base-100 p-4 rounded-2xl shadow-md flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={service.logo}
                alt={service.name}
                className="w-8 h-8 object-contain"
              />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{service.name}</h2>
              <p className="text-xs opacity-60">{service.type}</p>
            </div>
            <button
              onClick={() => setService(null)}
              className="text-sm text-indigo-500"
            >
              Change
            </button>
          </div>

          {/* FROM */}
          <div className="bg-base-100 p-4 rounded-2xl shadow-md">
            <p className="text-sm opacity-60">From</p>
            <h2 className="font-semibold">{user.fullName}</h2>
            <p className="text-indigo-500 font-medium mt-1">
              ฿{(user.balance || 0).toLocaleString()}
            </p>
          </div>

          {/* REFERENCE NUMBER */}
          <div className="bg-base-100 p-4 rounded-2xl shadow-md">
            <p className="text-sm opacity-60 mb-1">Phone / Account Number</p>
            <input
              type="text"
              placeholder="Enter number"
              value={accountRef}
              onChange={(e) => setAccountRef(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          {/* AMOUNT */}
          <div className="bg-base-100 p-4 rounded-2xl shadow-md">
            <p className="text-sm opacity-60 mb-1">Amount</p>

            <input
              type="number"
              placeholder="0.00 THB"
              className="input input-bordered w-full text-xl"
              value={amount}
              onChange={handleAmountChange}
            />

            {amount > user.balance && (
              <p className="text-red-500 text-sm mt-1">
                Exceeds balance
              </p>
            )}
          </div>

          {/* BUTTON */}
          <button
            onClick={handleContinue}
            className="btn w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-none rounded-xl disabled:opacity-80"
          >
            Continue
          </button>

          <button
            onClick={() => setService(null)}
            className="text-center w-full text-sm opacity-60"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
