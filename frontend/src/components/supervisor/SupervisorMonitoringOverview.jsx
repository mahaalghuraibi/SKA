/** SECTION C — Monitoring snapshot + branch highlights */
export default function SupervisorMonitoringOverview({
  cctvSummary,
  highlights,
  liveLine,
  healthLine,
}) {
  return (
    <section dir="rtl" className="mb-8 space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#070f24]/85 p-5">
        <h3 className="text-base font-bold text-white">نظرة عامة على المراقبة</h3>
        <p className="mt-1 text-xs text-slate-500">حالة الكاميرات، الخطورة، وآخر النشاطات.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <p className="text-[11px] text-slate-500">كاميرات نشطة (بث)</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-200">{cctvSummary.activeStreams}</p>
            <p className="mt-1 text-[10px] text-slate-600">{liveLine}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <p className="text-[11px] text-slate-500">مناطق خطورة مرتفعة اليوم</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-amber-100">{cctvSummary.worstZoneLabel}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <p className="text-[11px] text-slate-500">تنبيهات اليوم</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-amber-200">{cctvSummary.violationsToday}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <p className="text-[11px] text-slate-500">صحة النظام</p>
            <p className="mt-1 text-sm font-medium text-slate-200">{healthLine}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {highlights.map((card) => (
          <article
            key={card.key}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(145deg,#071224,#0b1731)] p-4 shadow-[0_10px_28px_-18px_rgba(37,99,235,0.55)] transition hover:border-white/20"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_62%)]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">{card.title}</p>
                <p className="mt-1 text-base font-semibold text-white">{card.value}</p>
              </div>
              <card.icon className="h-7 w-7 shrink-0 text-sky-300/90 opacity-90 transition group-hover:scale-105" />
            </div>
            <p className="relative mt-3 text-[11px] text-slate-500">{card.subtitle}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
