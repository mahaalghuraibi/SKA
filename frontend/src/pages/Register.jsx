import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SKALogo from "../components/SKALogo.jsx";

const REGISTER_URL = "/api/v1/auth/users";
const BRANCH_OPTIONS = [
  { id: 1, name: "فرع تجريبي" },
  { id: 2, name: "فرع الرياض" },
  { id: 3, name: "فرع جدة" },
];

function normalizeError(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => e.msg || JSON.stringify(e)).join(" — ");
  }
  return "";
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [branchId, setBranchId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const safeEmail = email.trim();
    const safeName = name.trim();
    const emailLocal = safeEmail.includes("@") ? safeEmail.split("@")[0] : safeEmail;
    const fromName = safeName
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, 20);
    const derivedUsername = (emailLocal || fromName || `user_${Date.now()}`).toLowerCase().slice(0, 30);
    const safeUsername = derivedUsername || `user_${Date.now()}`;
    const numericTenant = 1;
    const selectedBranch = BRANCH_OPTIONS.find((b) => b.id === Number(branchId)) || BRANCH_OPTIONS[0];

    if (!safeName) {
      setError("الاسم مطلوب.");
      return;
    }
    if (!safeEmail) {
      setError("البريد الإلكتروني مطلوب.");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }
    if (password !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق.");
      return;
    }
    if (!["staff", "supervisor", "admin"].includes(role)) {
      setError("الدور غير صالح.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        email: safeEmail,
        username: safeUsername,
        password,
        role,
        tenant_id: numericTenant,
        full_name: safeName,
        branch_id: selectedBranch.id,
        branch_name: selectedBranch.name,
      };

      const res = await fetch(REGISTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      console.log("Register response.status:", res.status);
      console.log("Register response.data:", data);
      if (res.status === 201) {
        setSuccess("تم إنشاء الحساب بنجاح");
        setError("");
        setTimeout(() => navigate("/login"), 1500);
        return;
      }

      const backendMessage =
        normalizeError(data?.detail) ||
        (typeof data?.message === "string" ? data.message : "") ||
        "تعذر إنشاء الحساب";
      console.error("Register API error:", {
        status: res.status,
        data,
      });
      setError(backendMessage);
    } catch {
      setError("تعذر الاتصال بالخادم. تأكد أن الـ backend يعمل.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-surface text-slate-100" dir="rtl">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 hero-premium-base" />
        <div className="absolute inset-0 hero-premium-mesh hero-mesh-anim opacity-90" />
        <div className="absolute inset-0 opacity-45 hero-grid-lines" />
        <div className="hero-orb hero-orb-a" />
        <div className="hero-orb hero-orb-b" />
      </div>
      <div className="pointer-events-none absolute inset-0 hero-vignette" />

      <header className="relative z-10 border-b border-white/10 bg-[#0F172A]/78 shadow-[0_8px_24px_-16px_rgba(2,6,23,0.95)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-sky/45 to-transparent" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center">
            <SKALogo />
          </Link>
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <Link
              to="/"
              className="rounded-md px-1.5 py-1 text-sm font-medium text-slate-400 transition hover:text-brand-sky"
            >
              الرئيسية
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/15 bg-[rgba(15,23,42,0.72)] px-3 text-xs font-semibold text-slate-100 backdrop-blur-md transition hover:border-brand-sky/40 hover:bg-[#1a2644] sm:px-4 sm:text-sm"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-3 py-8 sm:px-4 sm:py-12">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-5 shadow-glass-lg backdrop-blur-xl sm:rounded-3xl sm:p-8 lg:p-9">
          <h1 className="text-xl font-bold text-white sm:text-2xl">مرحبًا بك في منصة SKA</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            أنشئ حسابك وابدأ تجربة الرقابة والتوثيق الذكي للمطابخ
          </p>

          {error ? (
            <div
              className="mt-4 rounded-xl border border-accent-red/40 bg-accent-red/10 px-3 py-2.5 text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {success ? (
            <div
              className="mt-4 rounded-xl border border-accent-green/40 bg-accent-green/10 px-3 py-2.5 text-sm text-green-200"
              role="status"
            >
              {success}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-300">
                الاسم الكامل
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="الاسم الكامل"
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
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-left text-sm text-white placeholder:text-slate-600 focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                dir="ltr"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-semibold text-slate-300"
                >
                  كلمة المرور
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  dir="ltr"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1.5 block text-sm font-semibold text-slate-300"
                >
                  تأكيد كلمة المرور
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label htmlFor="role" className="mb-1.5 block text-sm font-semibold text-slate-300">
                الدور
              </label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="staff">موظف</option>
                <option value="supervisor">مشرف</option>
              </select>
            </div>

            <div>
              <label htmlFor="branch_id" className="mb-1.5 block text-sm font-semibold text-slate-300">
                الفرع
              </label>
              <select
                id="branch_id"
                name="branch_id"
                value={branchId}
                onChange={(e) => setBranchId(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                {BRANCH_OPTIONS.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-lg shadow-brand/35 transition hover:bg-blue-600 hover:shadow-glow-sm disabled:opacity-60"
            >
              {loading ? "جاري إنشاء الحساب…" : "إنشاء الحساب"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            لديك حساب بالفعل؟{" "}
            <Link to="/login" className="font-semibold text-brand-sky transition hover:text-sky-300">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
