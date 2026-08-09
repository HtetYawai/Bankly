import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_UNAUTHORIZED_EVENT, adminAuthApi, getAdminApiError } from "../services/adminApi";
import { AdminAuthContext } from "./AdminAuthContext";

export default function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminAuthApi.getMe({ skipAdminAuthRedirect: true });
      setAdmin(response.data);
      setAuthError("");
      setSessionExpired(false);
    } catch (error) {
      setAdmin(null);
      if (error.response?.status !== 401) {
        setAuthError(getAdminApiError(error, "Unable to verify the admin session."));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(checkSession, 0);
    return () => window.clearTimeout(timer);
  }, [checkSession]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAdmin((currentAdmin) => {
        if (currentAdmin) setSessionExpired(true);
        return null;
      });
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError("");
    try {
      const response = await adminAuthApi.login(credentials);
      setAdmin(response.data);
      setSessionExpired(false);
      return { ok: true };
    } catch (error) {
      const message = getAdminApiError(error, "Admin login failed.");
      setAuthError(message);
      return { ok: false, message };
    }
  }, []);

  const clearSession = useCallback(() => {
    setAdmin(null);
    setSessionExpired(false);
    setAuthError("");
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminAuthApi.logout();
    } catch {
      // Local state must still be cleared if the cookie is already invalid.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const clearAuthError = useCallback(() => setAuthError(""), []);

  const value = useMemo(() => ({
    admin,
    isAuthenticated: Boolean(admin),
    isLoading,
    authError,
    sessionExpired,
    login,
    logout,
    clearSession,
    checkSession,
    clearAuthError,
  }), [admin, isLoading, authError, sessionExpired, login, logout, clearSession, checkSession, clearAuthError]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
