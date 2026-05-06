import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ACCESS_TOKEN_KEY } from "../constants.js";

const ADMIN_REQUESTS_URL = "/api/v1/admin-requests";

function statusLabelAr(status) {
  if (status === "pending") return "قيد المراجعة";
  if (status === "approved") return "مقبول";
  if (status === "rejected") return "مرفوض";
  return status || "—";
}

export default function AdminRequestsPage() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY) || "";
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  async function loadRequests(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const res = await fetch(ADMIN_REQUESTS_URL, { headers: authHeaders });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        if (res.status === 401) {
          setError("401: يرجى تسجيل الدخول.");
        } else if (res.status === 403) {
          setError("403: هذه الصفحة متاحة للأدمن فقط.");
        } else {
          setError("تعذر تحميل طلبات الحساب الإداري.");
        }
        setRequests([]);
        return;
      }
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      setError("تعذر الاتصال بالخادم.");
      setRequests([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateStatus(requestId, status) {
    const action = status === "approved" ? "approve" : "reject";
    setError("");
    setToast(null);
    setActionLoading({ id: requestId, action });
    try {
      const res = await fetch(`${ADMIN_REQUESTS_URL}/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "تعذر تحديث حالة الطلب.");
        return;
      }
      if (status === "approved") {
        setToast({ variant: "success", text: "تم قبول الطلب" });
      } else {
        setToast({ variant: "error", text: "تم رفض الطلب" });
      }
      await loadRequests({ silent: true });
    } catch {
      setError("تعذر الاتصال بالخادم.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-surface text-slate-100" dir="rtl">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 hero-premium-base" />
        <div className="absolute inset-0 hero-premium-mesh hero-mesh-anim opacity-90" />
        <div className="absolute inset-0 opacity-45 hero-grid-lines" />
      </div>
      <div className="pointer-events-none absolute inset-0 hero-vignette" />

      <header className="relative z-10 border-b border-white/10 bg-[#0F172A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-sky text-sm font-bold text-white shadow-lg shadow-brand/25">
              S
            </span>
            <span className="font-bold text-white">SKA</span>
          </Link>
          <Link to="/dashboard" className="text-sm font-medium text-slate-400 transition hover:text-brand-sky">
            العودة للوحة التحكم
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-4 shadow-glass-lg backdrop-blur-xl sm:rounded-3xl sm:p-6">
          <h1 className="text-xl font-bold text-white sm:text-2xl">طلبات الحساب الإداري</h1>
          <p className="mt-1 text-sm text-slate-400">مراجعة طلبات الترقية إلى Admin</p>

          {error ? (
            <div className="mt-4 rounded-xl border border-accent-red/40 bg-accent-red/10 px-3 py-2.5 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-6 overflow-x-auto">
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 px-3 py-6 text-center text-sm text-slate-400">
                جاري تحميل الطلبات...
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 px-3 py-6 text-center text-sm text-slate-400">
                لا توجد طلبات حتى الآن.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="px-3 py-2 text-start">الاسم</th>
                    <th className="px-3 py-2 text-start">البريد الإلكتروني</th>
                    <th className="px-3 py-2 text-start">الجهة</th>
                    <th className="px-3 py-2 text-start">التواصل</th>
                    <th className="px-3 py-2 text-start">السبب</th>
                    <th className="px-3 py-2 text-start">الحالة</th>
                    <th className="px-3 py-2 text-start">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => {
                    const rowBusy = actionLoading?.id === req.id;
                    const isPending = req.status === "pending";
                    const buttonsDisabled = loading || rowBusy || !isPending;
                    return (
                    <tr key={req.id} className="border-b border-white/5 text-slate-200">
                      <td className="px-3 py-2.5">{req.name}</td>
                      <td className="px-3 py-2.5">{req.email}</td>
                      <td className="px-3 py-2.5">{req.company}</td>
                      <td className="px-3 py-2.5">{req.phone}</td>
                      <td className="px-3 py-2.5">{req.reason}</td>
                      <td className="px-3 py-2.5">{statusLabelAr(req.status)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => updateStatus(req.id, "approved")}
                            disabled={buttonsDisabled}
                            className="rounded-lg border border-accent-green/40 bg-accent-green/10 px-2.5 py-1 text-xs text-green-200 transition hover:bg-accent-green/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {rowBusy && actionLoading?.action === "approve"
                              ? "جاري القبول..."
                              : "قبول"}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(req.id, "rejected")}
                            disabled={buttonsDisabled}
                            className="rounded-lg border border-accent-red/40 bg-accent-red/10 px-2.5 py-1 text-xs text-red-200 transition hover:bg-accent-red/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {rowBusy && actionLoading?.action === "reject"
                              ? "جاري الرفض..."
                              : "رفض"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-2">
          <div
            role="alert"
            className={`pointer-events-auto w-full max-w-md rounded-xl border px-3 py-3 text-center text-sm shadow-lg backdrop-blur-md ${
              toast.variant === "success"
                ? "border-accent-green/50 bg-[rgba(15,23,42,0.92)] text-green-200"
                : "border-accent-red/50 bg-[rgba(15,23,42,0.92)] text-red-200"
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}
