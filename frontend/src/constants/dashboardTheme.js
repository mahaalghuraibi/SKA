/**
 * SaaS-style section surfaces — dark theme with soft glow per domain.
 * RTL-safe; use as wrapper className on `<section>`.
 */
export const SECTION_THEME = {
  /** Quality & positive KPIs — teal / emerald */
  quality:
    "rounded-2xl border border-emerald-500/20 bg-[rgba(6,20,25,0.72)] p-4 shadow-[0_8px_28px_-12px_rgba(52,211,153,0.2)] backdrop-blur-sm transition duration-300 hover:border-emerald-400/30 sm:p-6",
  /** Alerts — amber */
  alerts:
    "rounded-2xl border border-amber-500/20 bg-[rgba(25,18,8,0.62)] p-4 shadow-[0_8px_28px_-12px_rgba(251,191,36,0.18)] backdrop-blur-sm transition duration-300 hover:border-amber-400/35 sm:p-6",
  /** Violations / risk — red */
  violations:
    "rounded-2xl border border-red-500/18 bg-[rgba(28,10,12,0.62)] p-4 shadow-[0_8px_28px_-12px_rgba(248,113,113,0.15)] backdrop-blur-sm transition duration-300 hover:border-red-400/28 sm:p-6",
  /** Cameras & streaming — sky / blue */
  cameras:
    "rounded-2xl border border-sky-500/22 bg-[rgba(8,18,32,0.72)] p-4 shadow-[0_8px_28px_-12px_rgba(56,189,248,0.18)] backdrop-blur-sm transition duration-300 hover:border-sky-400/35 sm:p-6",
  /** Reports & analytics — violet */
  reports:
    "rounded-2xl border border-violet-500/20 bg-[rgba(18,12,28,0.65)] p-4 shadow-[0_8px_28px_-12px_rgba(167,139,250,0.15)] backdrop-blur-sm transition duration-300 hover:border-violet-400/30 sm:p-6",
  /** Neutral secondary panels */
  neutral:
    "rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.78)] p-4 shadow-glass backdrop-blur-sm transition duration-300 hover:border-white/15 sm:p-6",
};

/** Inner card — unified radius / padding */
export const dashboardCardInner =
  "rounded-xl border border-white/[0.08] bg-[#060d1f]/72 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition hover:border-white/12";
