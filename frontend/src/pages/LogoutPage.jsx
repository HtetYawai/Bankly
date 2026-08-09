import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

export default function LogoutPage() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  useEffect(() => {
    const doLogout = async () => {
      await logout();
      navigate("/login");
    };

    doLogout();
  }, []);

  return (
    <div className="min-h-screen min-h-dvh flex items-center justify-center bg-base-200">

      <div className="bg-base-100 p-6 rounded-3xl shadow text-center">

        {/*Loading Spinner */}
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>

        <p className="text-sm opacity-70">Logging you out...</p>

      </div>

    </div>
  );
}