import { Navigate } from "react-router-dom";
import { ACCESS_TOKEN_KEY, USER_ROLE_KEY } from "../constants.js";

/**
 * Blocks staff from supervisor-only routes (e.g. monitoring). Supervisors and admins pass through.
 */
export default function SupervisorOrAdminRoute({ children }) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  const role = localStorage.getItem(USER_ROLE_KEY);
  if (role === "staff") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
