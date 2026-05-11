import { Navigate } from "react-router-dom";
import { ACCESS_TOKEN_KEY, USER_ROLE_KEY } from "../constants.js";

/** UI-only gate — backend `/users/*` and admin APIs enforce `require_roles("admin")`. */
export default function AdminRoute({ children }) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const role = localStorage.getItem(USER_ROLE_KEY);

  if (!token) return <Navigate to="/login" replace />;
  if (role !== "admin") {
    const dest = role === "supervisor" ? "/analytics" : "/dashboard";
    return <Navigate to={dest} replace />;
  }
  return children;
}
