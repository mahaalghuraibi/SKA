import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN_KEY, CURRENT_USER_ME_URLS, USER_INFO_KEY, USER_ROLE_KEY } from "../constants.js";
import { safeJsonParse } from "../utils/safeJson.js";

export function useDashboardAuth({ setToast }) {
  const navigate = useNavigate();
  const [role, setRole] = useState(localStorage.getItem(USER_ROLE_KEY) || "");

  const getAccessToken = useCallback(() => localStorage.getItem(ACCESS_TOKEN_KEY), []);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    navigate("/login", { replace: true });
  }, [navigate]);

  const handleProtectedAuthFailure = useCallback(
    (status, detail) => {
      if (status === 401) {
        setToast({ type: "error", text: "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى" });
        logout();
        return true;
      }
      if (status === 403) {
        setToast({ type: "error", text: "ليس لديك صلاحية للوصول لهذه الصفحة" });
        return true;
      }
      if (typeof detail === "string" && detail.includes("لم يتم تحديد الفرع")) {
        setToast({ type: "error", text: "لم يتم تحديد الفرع لهذا الحساب" });
        return true;
      }
      return false;
    },
    [logout, setToast]
  );

  useEffect(() => {
    const localRole = localStorage.getItem(USER_ROLE_KEY);
    if (localRole) {
      setRole(localRole);
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    (async () => {
      for (const url of CURRENT_USER_ME_URLS) {
        try {
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const body = safeJsonParse(await r.text(), {});
          if (r.ok && body?.role) {
            localStorage.setItem(USER_ROLE_KEY, body.role);
            setRole(body.role);
            return;
          }
        } catch {
          /* try next */
        }
      }
    })();
  }, [getAccessToken]);

  return {
    role,
    setRole,
    getAccessToken,
    logout,
    handleProtectedAuthFailure,
  };
}
