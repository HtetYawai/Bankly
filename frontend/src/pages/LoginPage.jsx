import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoggingIn } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const validateForm = () => {
    if (!formData.email.trim())
      return toast.error("Email required");

    if (!formData.password)
      return toast.error("Password required");

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm() !== true) return;

    const res = await login(formData);

    if (res) {
      const userData = res.user || res;

      localStorage.setItem("userId", userData._id);
      localStorage.setItem("user", JSON.stringify(userData));

      toast.success("Welcome back from Bankly 👋 ");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center px-4">

      <div className="w-full max-w-md">

        {/* TOP GRADIENT CARD */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl p-5 shadow-lg mb-[-40px] relative z-10">
          <h1 className="text-xl font-bold">Welcome Back</h1>
          <p className="text-sm opacity-80">Login to continue</p>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="bg-base-100 rounded-2xl p-5 pt-14 shadow-xl space-y-4"
        >
          <input
            type="email"
            placeholder="Email"
            className="input input-bordered w-full"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="input input-bordered w-full"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <button
              type="button"
              className="absolute right-3 top-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          <button
            className="btn w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-none"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Logging in..." : "Login"}
          </button>

          <p className="text-center text-sm">
            Don’t have an account?
            <span
              className="text-indigo-500 ml-1 cursor-pointer"
              onClick={() => navigate("/signup")}
            >
              Register
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}