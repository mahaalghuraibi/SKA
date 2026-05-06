import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";

import PrivateRoute from "./components/PrivateRoute.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import SupervisorOrAdminRoute from "./components/SupervisorOrAdminRoute.jsx";
import LandingPage from "./pages/Landing.jsx";
import LoginPage from "./pages/Login.jsx";
import RegisterPage from "./pages/Register.jsx";
import AdminRequestPage from "./pages/AdminRequest.jsx";
import AdminUsersPage from "./pages/AdminUsers.jsx";
import AdminRequestsPage from "./pages/AdminRequests.jsx";
import Dashboard from "./pages/Dashboard.jsx";

/**
 * Route order: specific paths first, "/" home last, catch-all last.
 * "/" is always the public landing page — never redirect it to /login.
 */
const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/admin-request", element: <AdminRequestPage /> },
  {
    path: "/dashboard",
    element: (
      <PrivateRoute>
        <Dashboard />
      </PrivateRoute>
    ),
  },
  {
    path: "/supervisor",
    element: (
      <PrivateRoute>
        <Dashboard />
      </PrivateRoute>
    ),
  },
  {
    path: "/monitoring",
    element: (
      <SupervisorOrAdminRoute>
        <Dashboard />
      </SupervisorOrAdminRoute>
    ),
  },
  {
    path: "/admin/users",
    element: (
      <AdminRoute>
        <AdminUsersPage />
      </AdminRoute>
    ),
  },
  {
    path: "/admin/requests",
    element: (
      <AdminRoute>
        <AdminRequestsPage />
      </AdminRoute>
    ),
  },
  { path: "/", element: <LandingPage /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
