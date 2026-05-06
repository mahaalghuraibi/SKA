import { Navigate } from "react-router-dom";
import { ACCESS_TOKEN_KEY, USER_ROLE_KEY } from "../constants.js";

export default function AdminRoute({ children }) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const role = localStorage.getItem(USER_ROLE_KEY);

  if (!token) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}
