import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, getMe } = useAuthStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [defaultLimit, setDefaultLimit] = useState(null);

  useEffect(() => {
    getMe();
    const fetchSettings = async () => {
      try {
        const res = await api.get("/settings");
        setDefaultLimit(res.data.maximumTransferAmount);
      } catch {
        setDefaultLimit(null);
      }
    };
    fetchSettings();
  }, []);

  // A custom per-customer limit (set by an admin) overrides the global default.
  const payLimit = user?.customMaximumTransferAmount ?? defaultLimit;

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
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="p-4 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">

        {/* PROFILE */}
        <div
          onClick={() => navigate("/profile")}
          className="bg-base-100 p-4 rounded-xl flex justify-between items-center cursor-pointer"
        >
          <span>Profile</span>
          <ChevronRight size={18} />
        </div>

        {/* DESIGN ONLY */}
        <div className="bg-base-100 p-4 rounded-xl flex justify-between opacity-70">
          <span>Language</span>
          <span>English</span>
        </div>

        <div className="bg-base-100 p-4 rounded-xl flex justify-between opacity-70">
          <span>Pay Limit</span>
          <span>
            {payLimit != null ? `${payLimit.toLocaleString()} THB` : "..."}
          </span>
        </div>

        <div className="bg-base-100 p-4 rounded-xl flex justify-between opacity-70">
          <span>Account Type</span>
          <span>Saving AC</span>
        </div>

        <div className="bg-base-100 p-4 rounded-xl opacity-70">
          Terms and Condition
        </div>

        {/* LOGOUT */}
        <div
          onClick={() => setShowConfirm(true)}
          className="bg-base-100 p-4 rounded-xl text-red-500 cursor-pointer"
        >
          Log Out
        </div>
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

          <div className="bg-base-100 rounded-2xl p-6 w-80 shadow-lg text-center">

            <h2 className="text-lg font-semibold mb-2">
              Log out?
            </h2>

            <p className="text-sm opacity-70 mb-5">
              Are you sure you want to log out?
            </p>

            <div className="flex gap-3">

              {/* CANCEL */}
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-gray-200"
              >
                Cancel
              </button>

              {/* YES LOGOUT */}
              <button
                onClick={() => navigate("/logout")}
                className="flex-1 py-2 rounded-xl bg-indigo-500 text-white"
              >
                Yes
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}