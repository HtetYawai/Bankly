import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

export default function AdminRoute({ children }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
