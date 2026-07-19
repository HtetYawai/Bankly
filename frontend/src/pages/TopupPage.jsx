import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function TopUpPage() {
  const navigate = useNavigate();

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
          <div
            key={index}
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
          </div>
        ))}

      </div>
    </div>
  );
}