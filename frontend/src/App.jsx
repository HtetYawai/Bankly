import { Navigate, Routes, Route, useLocation } from "react-router-dom";
import SignUpPage from "./pages/SignUpPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import HistoryPage from "./pages/HistoryPage";
import TopupPage from "./pages/TopupPage";
import BalancePage from "./pages/BalancePage";
import PINPage from "./pages/PINPage";
import TransferPage from "./pages/TransferPage";
import { useAuthStore } from "./store/useAuthStore";
import { useEffect } from "react";
import ConfirmPage from "./pages/ConfirmPage";
import NotificationPage from "./pages/NotificationPage";
import NotificationDetailPage from "./pages/NotificationDetailPage";
import TransactionsPage from "./pages/TransactionsPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import SuccessPage from "./pages/SuccessPage";
import CardPage from "./pages/CardPage";
import SettingsPage from "./pages/SettingPage";
import ProfilePage from "./pages/ProfilePage";
import LogoutPage from "./pages/LogoutPage";
import ScanPage from "./pages/ScanPage";
import AdminAuthProvider from "./admin/auth/AdminAuthProvider";
import AdminErrorBoundary from "./admin/components/AdminErrorBoundary";
import ProtectedAdminRoute from "./admin/components/ProtectedAdminRoute";
import AdminLayout from "./admin/layouts/AdminLayout";
import AdminLoginPage from "./admin/pages/AdminLoginPage";
import AdminPlaceholderPage from "./admin/pages/AdminPlaceholderPage";
import AdminDashboardPage from "./admin/pages/AdminDashboardPage";
import AdminUsersPage from "./admin/pages/AdminUsersPage";
import AdminUserDetailsPage from "./admin/pages/AdminUserDetailsPage";
import AdminWalletsPage from "./admin/pages/AdminWalletsPage";
import AdminWalletDetailsPage from "./admin/pages/AdminWalletDetailsPage";
import AdminTransactionsPage from "./admin/pages/AdminTransactionsPage";
import AdminTransactionDetailsPage from "./admin/pages/AdminTransactionDetailsPage";
import AdminReportsPage from "./admin/pages/AdminReportsPage";
import AdminAuditLogsPage from "./admin/pages/AdminAuditLogsPage";
import AdminSettingsPage from "./admin/pages/AdminSettingsPage";
import AdminProfilePage from "./admin/pages/AdminProfilePage";
// import { LogOut } from "lucide-react";


export default function App() {
  const getMe = useAuthStore((state) => state.getMe);
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (!isAdminPath) getMe();
  }, [getMe, isAdminPath]);
  return (
    
    <div>
      {/* <Navbar/> */}
      <Routes>
        <Route path="/" element={<HomePage/>} />
        <Route path="/signup" element={<SignUpPage/>} />
        <Route path="/login" element={<LoginPage/>} />
        <Route path="/logout" element={<LogoutPage/>} />
        <Route path="/pin" element={<PINPage />} />
        <Route path="/transfer" element={<TransferPage/>} />
        <Route path="/confirm" element={<ConfirmPage/>} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/topup" element={<TopupPage />} />
        <Route path="/balance" element={<BalancePage />} />
        <Route path="/notifications" element={<NotificationPage />} />
        <Route path="/notifications/:id" element={<NotificationDetailPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/:transactionId" element={<TransactionDetailPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cards" element={<CardPage />} />
        <Route path="/balance" element={<BalancePage />} />
        <Route path="/setting" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/scan" element={<ScanPage />} />

        <Route path="/admin/*" element={
          <AdminErrorBoundary>
            <AdminAuthProvider>
              <Routes>
                <Route path="login" element={<AdminLoginPage />} />
                <Route element={<ProtectedAdminRoute />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="users/frozen" element={<AdminUsersPage forcedStatus="FROZEN" />} />
                    <Route path="users/:userId" element={<AdminUserDetailsPage />} />
                    <Route path="wallets" element={<AdminWalletsPage />} />
                    <Route path="wallets/:walletId" element={<AdminWalletDetailsPage />} />
                    <Route path="transactions" element={<AdminTransactionsPage />} />
                    <Route path="transactions/:transactionId" element={<AdminTransactionDetailsPage />} />
                    <Route path="balance-adjustments" element={<Navigate to="/admin/wallets" replace />} />
                    <Route path="reports" element={<AdminReportsPage />} />
                    <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                    <Route path="settings" element={<AdminSettingsPage />} />
                    <Route path="profile" element={<AdminProfilePage />} />
                    <Route path="*" element={<AdminPlaceholderPage title="Page not found" description="This admin destination does not exist." />} />
                  </Route>
                </Route>
              </Routes>
            </AdminAuthProvider>
          </AdminErrorBoundary>
        } />
        
        {/* <Route path="/logout" element={<LogoutPage/>} /> */}
      </Routes>
    </div>
  );
}
