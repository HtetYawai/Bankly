import { useEffect, useState } from "react";
import axios from "axios";
import AdminNav from "../../components/AdminNav";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [limitInput, setLimitInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get("http://localhost:5001/api/admin/users", {
          withCredentials: true,
        });
        setUsers(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load users");
      }
    };

    fetchUsers();
  }, []);

  const handleEdit = (user) => {
    setEditingUserId(user._id);
    setLimitInput(user.dailyLimit ?? 20000);
    setStatusMessage("");
  };

  const handleSaveLimit = async (userId) => {
    try {
      const res = await axios.patch(
        `http://localhost:5001/api/admin/users/${userId}/limit`,
        { dailyLimit: Number(limitInput) },
        { withCredentials: true },
      );

      setUsers((prev) =>
        prev.map((user) =>
          user._id === userId
            ? { ...user, dailyLimit: res.data.dailyLimit }
            : user,
        ),
      );
      setEditingUserId(null);
      setStatusMessage("Daily limit updated successfully.");
    } catch (err) {
      setStatusMessage(err.response?.data?.message || "Update failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <AdminNav />

      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Customer Accounts</h1>
          <p className="text-gray-600 mt-2">
            View all registered customers and their account details.
          </p>
        </div>

        {statusMessage && (
          <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-4 text-green-700">
            {statusMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Daily limit
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.map((user) => (
                <tr key={user._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {user.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {user.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {user.accountNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                    ${user.balance?.toFixed(2) ?? "0.00"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {editingUserId === user._id ? (
                      <input
                        type="number"
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        className="input input-sm input-bordered w-full"
                      />
                    ) : (
                      `฿${(user.dailyLimit ?? 20000).toLocaleString()}`
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {user.role || "customer"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {editingUserId === user._id ? (
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleSaveLimit(user._id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => setEditingUserId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleEdit(user)}
                      >
                        Adjust limit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
