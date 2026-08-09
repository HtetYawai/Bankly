import { Home, CreditCard, Bell, Settings, ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/axios";

export default function BottomNav() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  const fetchNotis = async () => {
    try {
      const res = await api.get("/notifications");

      // ONLY COUNT UNREAD
      const unread = res.data.filter(n => !n.isRead).length;
      setCount(unread);

    } catch (err) {
      console.log("Failed to fetch notifications");
    }
  };

  useEffect(() => {
    fetchNotis();

    const interval = setInterval(fetchNotis, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-base-100 border-t pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] flex justify-between items-center">

      <div onClick={() => navigate("/")} className="flex flex-col items-center text-sm text-gray-500 cursor-pointer">
        <Home size={20} />
        Home
      </div>

      <div onClick={()=> navigate("/cards")} className="flex flex-col items-center text-sm text-gray-500">
        <CreditCard size={20} />
        Cards
      </div>

     <div
        onClick={() => navigate("/scan")}
        className="bg-indigo-500 p-4 rounded-full -mt-8 shadow-lg cursor-pointer"
      >
        <ScanLine className="text-white" />
      </div>

      {/* NOTIFICATION */}
      <div
        onClick={() => navigate("/notifications")}
        className="flex flex-col items-center text-sm text-gray-500 cursor-pointer relative"
      >
        <Bell size={20} />
        Noti

        {/* BADGE */}
        {count > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs px-1.5 rounded-full">
            {count}
          </span>
        )}
      </div>

      <div onClick={()=> navigate("/setting")} className="flex flex-col items-center text-sm text-gray-500">
        <Settings size={20} />
        Setting
      </div>
    </div>
  );
}