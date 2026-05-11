import { memo } from "react";
import { PLATFORM_BRAND } from "../../constants/branding.js";

/** Sticky KPI strip directly under the fixed nav (top matches DashboardNav min-h-14 / sm:min-h-16). */
function StickyAnalyticsSummaryBar({
  qualityLabel,
  alertsOpenCount,
  violationsCount,
  systemStatusLabel,
  activeCamerasCount,
  loading,
}) {
  return (
    <div
      dir="rtl"
      className="sticky top-14 z-[55] border-b border-white/10 bg-[#0b1220]/98 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.45)] backdrop-blur-[2px] sm:top-16"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[11px] font-semibold text-slate-400">{PLATFORM_BRAND.nameShortAr}</span>
          <span className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden />
          <span className="truncate text-[10px] text-slate-600 sm:text-[11px]">{PLATFORM_BRAND.taglineAr}</span>
        </div>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:gap-x-6 sm:text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">الجودة</dt>
            <dd className="font-bold tabular-nums text-emerald-300">{loading ? "…" : qualityLabel}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">تنبيهات غير المعالجة</dt>
            <dd className="font-bold tabular-nums text-amber-200">{loading ? "…" : alertsOpenCount}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">مخالفات</dt>
            <dd className="font-bold tabular-nums text-red-300">{loading ? "…" : violationsCount}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-slate-500">كاميرات نشطة</dt>
            <dd className="font-bold tabular-nums text-sky-300">{loading ? "…" : activeCamerasCount}</dd>
          </div>
          <div className="flex items-center gap-1.5 border-r border-white/10 pr-4 sm:pr-6">
            <dt className="text-slate-500">النظام</dt>
            <dd className="font-semibold text-slate-200">{systemStatusLabel}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default memo(StickyAnalyticsSummaryBar);
