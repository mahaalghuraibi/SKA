import { PLATFORM_BRAND } from "../../constants/branding.js";

/** SECTION A — Hero header for supervisor/admin dashboard */
export default function SupervisorExecutiveHero({
  branchLabel,
  liveMonitoringLabel,
  qualityPercentLabel,
}) {
  return (
    <section
      dir="rtl"
      className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#060d1f] via-[#0a1428] to-[#030712] p-5 shadow-[0_20px_60px_-28px_rgba(56,189,248,0.35)] sm:p-7"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(56,189,248,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-400/90">
            {PLATFORM_BRAND.nameShortAr}
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-[2rem]">
            {PLATFORM_BRAND.nameAr}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{PLATFORM_BRAND.taglineAr}</p>
        </div>
        <dl className="grid shrink-0 gap-3 sm:grid-cols-3 lg:max-w-xl lg:gap-4">
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-sm">
            <dt className="text-[11px] text-slate-500">الفرع / النطاق</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-slate-100">{branchLabel}</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-sm">
            <dt className="text-[11px] text-slate-500">المراقبة المباشرة</dt>
            <dd className="mt-1 text-sm font-semibold text-emerald-200/95">{liveMonitoringLabel}</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-sm">
            <dt className="text-[11px] text-slate-500">مؤشر الجودة</dt>
            <dd className="mt-1 text-sm font-semibold text-sky-100">{qualityPercentLabel}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
