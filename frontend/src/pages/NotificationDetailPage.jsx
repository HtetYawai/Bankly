import { useEffect, useState } from "react";
import { api } from "../lib/axios";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bell, ChevronRight } from "lucide-react";

export default function NotificationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchNotification = async () => {
      try {
        const res = await api.get(`/notifications/${id}`);
        setNotification(res.data);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load notification"
        );
      }
    };

    fetchNotification();
  }, [id]);

  const formatDateTime = (date) =>
    new Date(date).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="min-h-screen min-h-dvh bg-base-200">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-5 pb-5 pt-[calc(2.75rem+env(safe-area-inset-top))] rounded-b-3xl shadow-lg flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full bg-white/20"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold">Notification Details</h1>
      </div>

      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {error && (
          <div className="text-center text-sm opacity-60 mt-10">{error}</div>
        )}

        {!error && !notification && (
          <div className="text-center text-sm opacity-60 mt-10">
            Loading...
          </div>
        )}

        {notification && (
          <div className="bg-base-100 rounded-2xl shadow-md p-6 space-y-6">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="p-3 rounded-full bg-indigo-100 text-indigo-600">
                <Bell size={24} />
              </div>
              <p className="text-xs opacity-60">
                {formatDateTime(notification.createdAt)}
              </p>
            </div>

            <p className="text-sm text-center leading-relaxed">
              {notification.message}
            </p>

            {notification.transaction?._id && (
              <button
                onClick={() =>
                  navigate(`/transactions/${notification.transaction._id}`)
                }
                className="w-full flex items-center justify-between bg-base-200 rounded-xl px-4 py-3 text-sm font-medium hover:bg-base-300 transition"
              >
                <span>View transaction details</span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
