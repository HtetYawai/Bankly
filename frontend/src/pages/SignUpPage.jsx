import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signup, isSigningUp } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);

  const initialState = {
    fullName: "",
    email: "",
    password: "",
    phone: "",
  };

  const [formData, setFormData] = useState(initialState);

  const validateForm = () => {
    if (!formData.fullName.trim())
      return toast.error("Full name required");

    if (!formData.email.trim())
      return toast.error("Email required");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(formData.email))
      return toast.error("Enter a valid email");

    if (!/^\d{10}$/.test(formData.phone))
      return toast.error("Phone must be 10 digits");

    if (formData.password.length < 6)
      return toast.error("Password must be at least 6 characters");

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm() !== true) return;

    const res = await signup(formData);

    if (res) {
      toast.success("Signup successful!");
      setFormData(initialState);
      setShowPassword(false);
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-base-200 flex items-center justify-center px-4">

      <div className="w-full max-w-md">

        {/* SMALL TOP GRADIENT CARD */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl p-5 shadow-lg mb-[-40px] relative z-10">
          <h1 className="text-xl font-bold">Register Account</h1>
          <p className="text-sm opacity-80">Join your digital bank, Bankly!</p>
        </div>

        {/* FORM CARD */}
        <form
          onSubmit={handleSubmit}
          className="bg-base-100 rounded-2xl p-5 pt-14 shadow-xl space-y-4"
        >
          <input
            type="text"
            placeholder="Full Name"
            className="input input-bordered w-full"
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
          />

          <input
            type="email"
            placeholder="Email"
            className="input input-bordered w-full"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          <input
            type="tel"
            placeholder="Phone No."
            maxLength={10}
            className="input input-bordered w-full"
            value={formData.phone}
            onChange={(e) =>
              setFormData({
                ...formData,
                phone: e.target.value.replace(/\D/g, ""),
              })
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
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            className="btn w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-none"
            disabled={isSigningUp}
          >
            {isSigningUp ? "Signing..." : "Sign Up"}
          </button>

          <p className="text-center text-sm">
            Already have an account?
            <span
              className="text-indigo-500 ml-1 cursor-pointer"
              onClick={() => navigate("/login")}
            >
              Login
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}