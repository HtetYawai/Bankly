import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export default function NotificationPage() {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const fetchNotis = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch (err) {
      console.log("Failed to load notifications");
    }
  };

  const markAsRead = async () => {
    try {
      await api.put("/notifications/read", {});
    } catch (err) {
      console.log("Failed to mark as read");
    }
  };

  useEffect(() => {
    fetchNotis();
    markAsRead(); 

    const interval = setInterval(fetchNotis, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen min-h-dvh bg-base-200">

      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 pb-5 pt-[calc(2.75rem+env(safe-area-inset-top))] rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Notifications</h1>
      </div>

      <div className="p-4 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">

        {notifications.length === 0 && (
          <div className="text-center text-sm opacity-60">
            No notifications yet
          </div>
        )}

        {notifications.map((n) => {
          const isReceive =
            n.type === "receive" ||
            n.message?.toLowerCase().includes("received");
          const isTopup = n.message?.toLowerCase().includes("top-up");

          return (
            <div
              key={n._id}
              onClick={() => navigate(`/notifications/${n._id}`)}
              className="bg-base-100 p-4 rounded-2xl shadow-md flex items-center gap-3 cursor-pointer active:scale-[0.99] transition"
            >
              <div
                className={`p-2 rounded-full ${
                  isReceive
                    ? "bg-green-100 text-green-600"
                    : "bg-red-100 text-red-600"
                }`}
              >
                {isReceive ? (
                  <ArrowDownLeft size={18} />
                ) : (
                  <ArrowUpRight size={18} />
                )}
              </div>

              <div className="flex-1">
                <p className="text-xs text-indigo-500 mb-1">
                  {new Date(n.createdAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>

                <p className="text-sm">{n.message}</p>
              </div>

              <div className="text-xs opacity-60">
                {isReceive ? "Receive" : isTopup ? "Top-up" : "Transfer"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}