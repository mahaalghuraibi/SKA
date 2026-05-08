import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ACCESS_TOKEN_KEY, CURRENT_USER_ME_URLS, USER_INFO_KEY, USER_ROLE_KEY } from "../constants.js";
import SKALogo from "../components/SKALogo.jsx";

const LOGIN_URL = "/api/v1/auth/login";

function formatApiError(detail) {
  void detail;
  return "البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = new URLSearchParams();
      body.set("username", username.trim());
      body.set("password", password);

      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(formatApiError(data.detail));
        return;
      }

      if (data.access_token) {
        localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
        let meData = {};
        let meOk = false;
        for (const url of CURRENT_USER_ME_URLS) {
          const meRes = await fetch(url, {
            headers: {
              Authorization: `Bearer ${data.access_token}`,
            },
          });
          meData = await meRes.json().catch(() => ({}));
          if (meRes.ok && meData.role) {
            meOk = true;
            break;
          }
        }
        if (!meOk || !meData.role) {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(USER_ROLE_KEY);
          setError(formatApiError(null));
          return;
        }
        console.log("[ska] login currentUser", {
          email: meData.email,
          username: meData.username ?? null,
          full_name: meData.full_name ?? null,
          role: meData.role,
        });
        const role = String(meData.role || "");
        localStorage.setItem(USER_ROLE_KEY, role);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify({
          id: meData.id ?? null,
          role,
          branch_id: meData.branch_id ?? null,
          branch_name: meData.branch_name ?? null,
          email: meData.email ?? null,
          username: meData.username ?? null,
        }));
        if (role === "admin" || role === "supervisor") {
          navigate("/supervisor#analytics", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else {
        setError(formatApiError(null));
      }
    } catch {
      setError(formatApiError(null));
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
              to="/register"
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/15 bg-[rgba(15,23,42,0.72)] px-3 text-xs font-semibold text-slate-100 backdrop-blur-md transition hover:border-brand-sky/40 hover:bg-[#1a2644] sm:px-4 sm:text-sm"
            >
              إنشاء حساب
            </Link>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-3 py-8 sm:px-4 sm:py-12">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-5 shadow-glass-lg backdrop-blur-xl sm:rounded-3xl sm:p-8 lg:p-9">
          <h1 className="text-xl font-bold text-white sm:text-2xl">مرحبًا بعودتك</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
            سجّل دخولك للمتابعة إلى منصة SKA
          </p>

          {error ? (
            <div
              className="mt-4 rounded-xl border border-accent-red/40 bg-accent-red/10 px-3 py-2.5 text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-semibold text-slate-300"
              >
                البريد الإلكتروني
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="أدخل بريدك الإلكتروني"
                className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-left text-sm text-white placeholder:text-slate-600 focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                dir="ltr"
              />
            </div>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-2.5 text-sm text-white focus:border-brand-sky/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-lg shadow-brand/35 transition hover:bg-blue-600 hover:shadow-glow-sm disabled:opacity-60"
            >
              {loading ? "جاري الدخول…" : "دخول"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            ليس لديك حساب؟{" "}
            <Link
              to="/register"
              className="font-semibold text-brand-sky transition hover:text-sky-300"
            >
              إنشاء حساب جديد
            </Link>
          </p>
          <p className="mt-2 text-center text-xs text-slate-500">
            <Link to="/" className="transition hover:text-brand-sky">
              العودة للرئيسية
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
