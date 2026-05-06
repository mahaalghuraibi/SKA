import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
  const [username, setUsername] = useState("");
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
    const safeUsername = username.trim().toLowerCase();
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
    if (!safeUsername) {
      setError("اسم المستخدم مطلوب.");
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

      <header className="relative z-10 border-b border-white/10 bg-[#0F172A]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-sky text-sm font-bold text-white shadow-lg shadow-brand/25">
              S
            </span>
            <span className="font-bold text-white">SKA</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <Link
              to="/"
              className="text-sm font-medium text-slate-400 transition hover:text-brand-sky"
            >
              الرئيسية
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
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-5 shadow-glass-lg backdrop-blur-xl sm:rounded-3xl sm:p-8">
          <h1 className="text-xl font-bold text-white sm:text-2xl">إنشاء حساب جديد</h1>
          <p className="mt-1 text-sm text-slate-400">
            أدخل بياناتك لفتح حساب جديد في منصة SKA
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
                الاسم
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
              <label htmlFor="username" className="mb-1.5 block text-sm font-semibold text-slate-300">
                اسم المستخدم
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="maha_user"
                dir="ltr"
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
                <option value="supervisor">سوبر فايزر</option>
                <option value="admin">admin</option>
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
