import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../auth/useAdminAuth";
import AdminLoading from "./AdminLoading";

export default function ProtectedAdminRoute() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) return <AdminLoading />;
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
