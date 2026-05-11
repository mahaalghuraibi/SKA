import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SKALogo from "../components/SKALogo.jsx";
import { PUBLIC_PAGE_TITLES } from "../constants/branding.js";

const ADMIN_REQUEST_URL = "/api/v1/admin-requests";

export default function AdminRequestPage() {
  useEffect(() => {
    document.title = PUBLIC_PAGE_TITLES.adminRequest;
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch(ADMIN_REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: organization.trim(),
          phone: phone.trim(),
          reason: reason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.detail === "string" ? data.detail : "تعذر إرسال الطلب.");
        return;
      }
      setSuccess("تم إرسال طلب الحساب الإداري بنجاح، سيتم مراجعته من الإدارة.");
      setName("");
      setEmail("");
      setOrganization("");
      setPhone("");
      setReason("");
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-surface text-slate-100" dir="rtl">
      <div className="pointer-events-none absolute inset-0 overflow-hidden admin-page-static-bg" aria-hidden />
      <div className="pointer-events-none absolute inset-0 hero-vignette" />

      <header className="relative z-10 border-b border-white/10 bg-[#0F172A]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#0F172A]/78">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
          <Link to="/" className="flex items-center">
            <SKALogo compact />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <Link
              to="/signup"
              className="text-sm font-medium text-slate-400 transition hover:text-brand-sky"
            >
              إنشاء حساب
            </Link>
            <Link
              to="/login"
              className="text-sm font-medium text-slate-400 transition hover:text-brand-sky"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-3 py-8 sm:px-4 sm:py-12">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-5 shadow-glass-lg backdrop-blur-xl sm:rounded-3xl sm:p-8">
          <h1 className="text-xl font-bold text-white sm:text-2xl">طلب حساب إداري</h1>
          <p className="mt-1 text-sm text-slate-400">
            هذا النموذج مخصص لإرسال طلب صلاحيات Admin وسيتم مراجعته من الإدارة.
          </p>

          {success ? (
            <div
              className="mt-4 rounded-xl border border-accent-green/40 bg-accent-green/10 px-3 py-2.5 text-sm text-green-200"
              role="status"
            >
              {success}
            </div>
          ) : null}
          {error ? (
            <div
              className="mt-4 rounded-xl border border-accent-red/40 bg-accent-red/10 px-3 py-2.5 text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-300">
                  الاسم
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-300">
                  البريد الإلكتروني
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-left text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="organization"
                  className="mb-1.5 block text-sm font-semibold text-slate-300"
                >
                  اسم الشركة / الجهة
                </label>
                <input
                  id="organization"
                  name="organization"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-slate-300">
                  رقم التواصل
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reason" className="mb-1.5 block text-sm font-semibold text-slate-300">
                سبب طلب صلاحية Admin
              </label>
              <textarea
                id="reason"
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-lg shadow-brand/35 transition hover:bg-blue-600 hover:shadow-glow-sm"
            >
              {loading ? "جاري الإرسال..." : "إرسال الطلب"}
            </button>
          </form>
          <p className="mt-3 text-center text-xs text-slate-500">
            <Link to="/" className="transition hover:text-brand-sky">
              العودة للرئيسية
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
