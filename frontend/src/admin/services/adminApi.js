import axios from "axios";

export const ADMIN_UNAUTHORIZED_EVENT = "bankly:admin-unauthorized";

export const adminApi = axios.create({
  baseURL: "/api/admin",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAdminAuthRedirect) {
      window.dispatchEvent(new CustomEvent(ADMIN_UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

export const adminAuthApi = {
  login(credentials) {
    return adminApi.post("/auth/login", credentials, { skipAdminAuthRedirect: true });
  },
  getMe(options = {}) {
    return adminApi.get("/auth/me", options);
  },
  logout() {
    return adminApi.post("/auth/logout");
  },
  changePassword(passwords) {
    return adminApi.post("/auth/change-password", passwords);
  },
};

export const adminUsersApi = {
  list(params, options = {}) {
    return adminApi.get("/users", { ...options, params });
  },
  getById(userId, options = {}) {
    return adminApi.get(`/users/${userId}`, options);
  },
  freeze(userId, reason) {
    return adminApi.patch(`/users/${userId}/freeze`, { reason });
  },
  unfreeze(userId, reason) {
    return adminApi.patch(`/users/${userId}/unfreeze`, { reason });
  },
  revokeSessions(userId) {
    return adminApi.post(`/users/${userId}/revoke-sessions`);
  },
};

export const adminWalletsApi = {
  list(params, options = {}) {
    return adminApi.get("/wallets", { ...options, params });
  },
  getById(walletId, options = {}) {
    return adminApi.get(`/wallets/${walletId}`, options);
  },
  adjust(walletId, adjustment, idempotencyKey) {
    return adminApi.post(`/wallets/${walletId}/adjustments`, adjustment, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
  },
};

export const adminTransactionsApi = {
  list(params, options = {}) {
    return adminApi.get("/transactions", { ...options, params });
  },
  getById(transactionId, options = {}) {
    return adminApi.get(`/transactions/${transactionId}`, options);
  },
};

export const adminReportsApi = {
  transactions(params, options = {}) { return adminApi.get("/reports/transactions", { ...options, params }); },
  users(params, options = {}) { return adminApi.get("/reports/users", { ...options, params }); },
  frozenAccounts(params, options = {}) { return adminApi.get("/reports/frozen-accounts", { ...options, params }); },
  walletBalances(options = {}) { return adminApi.get("/reports/wallet-balances", options); },
};

export const adminAuditLogsApi = {
  list(params, options = {}) { return adminApi.get("/audit-logs", { ...options, params }); },
};

export const adminSettingsApi = {
  get(options = {}) { return adminApi.get("/settings", options); },
  update(settings) { return adminApi.patch("/settings", settings); },
};

export function getAdminApiError(error, fallback = "Something went wrong.") {
  return error.response?.data?.message ?? fallback;
}
