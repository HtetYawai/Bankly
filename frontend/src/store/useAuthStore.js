import { create } from "zustand";
import { api } from "../lib/axios";
import toast from "react-hot-toast";

export const useAuthStore = create((set) => ({
  user: null,
  isSigningUp: false,

  signup: async (data) => {
    try {
      set({ isSigningUp: true });

      const res = await api.post("/auth/signup", data);

      set({ isSigningUp: false });
      return res.data;
    } catch (err) {
      set({ isSigningUp: false });
      toast.error(err.response?.data?.message || "Signup failed");
      return false;
    }
  },

  // LOGIN FUNCTION
  login: async (data) => {
  try {
    set({ isLoggingIn: true });

    const res = await api.post("/auth/login", data);

    // STORE USER HERE
    set({ user: res.data.user });

    set({ isLoggingIn: false });
    return res.data;
  } catch (err) {
    set({ isLoggingIn: false });
    toast.error(err.response?.data?.message || "Login failed");
    return false;
  }
},

// LOG OUT
logout: async () => {
  try {
    await api.post("/auth/logout");

    set({ user: null });
  } catch (err) {
    console.log(err);
  }
},


  getMe: async () => {
    try {
      const res = await api.get("/auth/me");

      set({ user: res.data });
    } catch {
      set({ user: null });
    }
  },

  refreshUser: async () => {
  try {
    const res = await api.get("/auth/me");
    set({ user: res.data });
  } catch {}
}

}));
