import { NavLink } from "react-router-dom";

export default function AdminNav() {
  return (
    <div className="bg-white shadow rounded-xl p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg ${
              isActive
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`
          }
        >
          Dashboard
        </NavLink>
        <NavLink
          to="/admin/users"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg ${
              isActive
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`
          }
        >
          Users
        </NavLink>
        <NavLink
          to="/admin/transactions"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg ${
              isActive
                ? "bg-indigo-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`
          }
        >
          Transactions
        </NavLink>
      </div>
    </div>
  );
}
