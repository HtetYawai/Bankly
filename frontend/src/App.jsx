import {Routes, Route} from "react-router-dom";
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
import TransactionsPage from "./pages/TransactionsPage";
import SuccessPage from "./pages/SuccessPage";
import CardPage from "./pages/CardPage";
import SettingsPage from "./pages/SettingPage";
import ProfilePage from "./pages/ProfilePage";
import LogoutPage from "./pages/LogoutPage";
import ScanPage from "./pages/ScanPage";
// import { LogOut } from "lucide-react";


export default function App() {
  const getMe = useAuthStore((state) => state.getMe);

  useEffect(() => {
    getMe(); //  VERY IMPORTANT
  }, []);
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
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/cards" element={<CardPage />} />
        <Route path="/balance" element={<BalancePage />} />
        <Route path="/setting" element={<SettingsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/scan" element={<ScanPage />} />
        
        {/* <Route path="/logout" element={<LogoutPage/>} /> */}
      </Routes>
    </div>
  );
}
