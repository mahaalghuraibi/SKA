/**
 * Single CCTV-style zone panel — presentation only (no AI logic).
 */
export default function ZoneCameraPanel({
  zone,
  matchedCamera,
  openViolationCount,
  lastUpdatedIso,
  riskTier,
  liveConnected,
}) {
  const tier = riskTier || "green";
  const borderGlow =
    tier === "red"
      ? "border-red-500/40 shadow-[0_0_24px_-8px_rgba(239,68,68,0.55)]"
      : tier === "yellow"
        ? "border-amber-500/35 shadow-[0_0_20px_-10px_rgba(245,158,11,0.45)]"
        : "border-emerald-500/25 shadow-[0_0_18px_-12px_rgba(16,185,129,0.35)]";

  const statusDot =
    tier === "red" ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" : tier === "yellow"
      ? "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.85)]"
      : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]";

  const riskLabel =
    tier === "red" ? "مرتفع" : tier === "yellow" ? "متوسط / منخفض" : "سليم";

  const riskChip =
    tier === "red"
      ? "border-red-500/40 bg-red-500/15 text-red-100"
      : tier === "yellow"
        ? "border-amber-500/40 bg-amber-500/15 text-amber-100"
        : "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";

  const camLabel = matchedCamera?.name?.trim() || zone.displayNameAr;
  const updated = lastUpdatedIso ? String(lastUpdatedIso) : "—";

  return (
    <article
      dir="rtl"
      className={`relative overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-[#050814] via-[#0a1024] to-[#050814] ${borderGlow}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(56,189,248,0.06)_0%,transparent_42%,rgba(0,0,0,0.55)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      {/* Fake CCTV bezel */}
      <div className="relative border-b border-white/10 px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`} title={liveConnected ? "بث مسجل" : "في انتظار البث"} />
            <span className="truncate text-[11px] font-mono text-sky-200/90" dir="ltr">
              {zone.camCode}
            </span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              LIVE
            </span>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskChip}`}>{riskLabel}</span>
        </div>
      </div>

      {/* Video placeholder */}
      <div className="relative mx-2 mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/80 sm:mx-3">
        <div className="aspect-video w-full bg-[radial-gradient(ellipse_at_center,rgba(30,58,138,0.35)_0%,#020617_75%)]">
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-4 text-center">
            <p className="text-[11px] font-semibold text-slate-500">لوحة مراقبة — جاهزة لربط RTSP/IP</p>
            <p className="text-[10px] text-slate-600">{zone.zoneEn}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
      </div>

      <div className="relative space-y-2 px-3 py-3 sm:px-4 sm:py-4">
        <div>
          <p className="truncate text-sm font-bold text-white">{camLabel}</p>
          <p className="mt-0.5 text-xs font-medium text-sky-200/90">{zone.zoneAr}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <dt className="text-slate-500">حالة التشغيل</dt>
            <dd className="font-semibold text-slate-100">{liveConnected ? "نشط" : "بدون بث مباشر"}</dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <dt className="text-slate-500">عدد المخالفات المفتوحة</dt>
            <dd className="font-mono font-semibold tabular-nums text-slate-100">{openViolationCount}</dd>
          </div>
          <div className="col-span-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <dt className="text-slate-500">آخر تحديث</dt>
            <dd className="truncate font-mono text-[10px] text-slate-300 dir-ltr text-end">{updated}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
