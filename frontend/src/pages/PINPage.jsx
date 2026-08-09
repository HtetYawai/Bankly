import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PINPage() {
  const [pin, setPin] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.redirectTo || "/transfer";

  const handleNumberClick = (num) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  //AUTO CHECK PIN
  useEffect(() => {
    if (pin.length !== 6) return;

    if (pin === "111222") {
      setTimeout(() => {
        navigate(redirectTo);
      }, 200);
    } else {
      alert("Incorrect PIN");
      setPin("");
    }
  }, [pin, navigate, redirectTo]);

  return (
    <div className="min-h-screen min-h-dvh bg-base-200 flex flex-col items-center justify-center px-4">

      <div className="w-full max-w-sm">

        {/* GRADIENT TOP CARD */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl p-5 shadow-lg mb-[-40px] relative z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/")}
              className="p-1 rounded-full bg-white/20"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="font-semibold">Security Check</h2>
          </div>
          <p className="text-sm opacity-80 mt-1">Enter your PIN</p>
        </div>

        {/* MAIN CARD */}
        <div className="bg-base-100 rounded-2xl pt-14 pb-6 px-5 shadow-xl flex flex-col items-center">

          <h2 className="mt-4 text-lg font-semibold">Enter PIN</h2>
          <p className="text-sm text-gray-500">
            6-digit secure code
          </p>

          {/* PIN DOTS */}
          <div className="flex gap-3 mt-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition ${
                  i < pin.length ? "bg-indigo-500 scale-110" : "bg-gray-300"
                }`}
              />
            ))}
          </div>

          {/* KEYPAD */}
          <div className="grid grid-cols-3 gap-5 mt-8">
            {[1,2,3,4,5,6,7,8,9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                className="w-16 h-16 rounded-full bg-base-200 shadow hover:bg-base-300 active:scale-95 transition text-lg font-semibold flex items-center justify-center"
              >
                {num}
              </button>
            ))}

            <div></div>

            <button
              onClick={() => handleNumberClick("0")}
              className="w-16 h-16 rounded-full bg-base-200 shadow hover:bg-base-300 active:scale-95 transition text-lg font-semibold flex items-center justify-center"
            >
              0
            </button>

            <button
              onClick={handleDelete}
              className="w-16 h-16 rounded-full bg-base-200 shadow hover:bg-base-300 active:scale-95 transition text-lg flex items-center justify-center"
            >
              ⌫
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}