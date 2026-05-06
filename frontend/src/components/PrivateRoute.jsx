import { Navigate } from "react-router-dom";
import { ACCESS_TOKEN_KEY } from "../constants.js";

/**
 * Protects a route: unauthenticated users are sent to /login only.
 * Does not affect "/" — the landing page stays public.
 */
export default function PrivateRoute({ children }) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
