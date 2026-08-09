import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen min-h-dvh bg-base-200">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 pb-5 pt-[calc(2.75rem+env(safe-area-inset-top))] rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Profile</h1>
      </div>

      <div className="p-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">

        {/* PROFILE CARD */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-400 text-white rounded-3xl p-6 shadow-lg text-center relative overflow-hidden">

          {/* glow */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

          {/* avatar */}
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold mb-3">
            {user?.fullName?.charAt(0) || "U"}
          </div>

          <h2 className="text-lg font-semibold">
            {user?.fullName || "User"}
          </h2>

          <p className="text-sm opacity-80">
            {user?.email || "No email"}
          </p>
        </div>

        {/* INFO CARD */}
        <div className="mt-5 bg-base-100 rounded-3xl shadow divide-y">

          <div className="p-4">
            <p className="text-xs opacity-60">Username</p>
            <p className="text-sm font-medium mt-1">
              {user?.fullName || "N/A"}
            </p>
          </div>

          <div className="p-4">
            <p className="text-xs opacity-60">Email</p>
            <p className="text-sm font-medium mt-1">
              {user?.email || "N/A"}
            </p>
          </div>

          <div className="p-4">
            <p className="text-xs opacity-60">Phone Number</p>
            <p className="text-sm font-medium mt-1">
              {user?.phone || "N/A"}
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}