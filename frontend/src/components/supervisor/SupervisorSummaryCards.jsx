import { IconActivity, IconBell, IconChart, IconDish } from "../shared/icons.jsx";

/** SECTION B — Summary KPI row */
export default function SupervisorSummaryCards({
  cameraCount,
  activeAlertsCount,
  totalViolations,
  qualityPercent,
  loading,
}) {
  const cards = [
    {
      key: "cam",
      label: "عدد الكاميرات",
      sub: "مسجّلة في النظام",
      value: loading ? "…" : String(cameraCount ?? "—"),
      icon: IconActivity,
      glow: "shadow-[0_0_28px_-12px_rgba(56,189,248,0.45)]",
      accent: "border-sky-500/25 text-sky-100",
    },
    {
      key: "alerts",
      label: "التنبيهات النشطة",
      sub: "تنبيهات مراقبة حالية",
      value: loading ? "…" : String(activeAlertsCount ?? "—"),
      icon: IconBell,
      glow: "shadow-[0_0_28px_-12px_rgba(251,191,36,0.4)]",
      accent: "border-amber-500/25 text-amber-100",
    },
    {
      key: "viol",
      label: "إجمالي المخالفات",
      sub: "من ملخص الخادم",
      value: loading ? "…" : String(totalViolations ?? "—"),
      icon: IconChart,
      glow: "shadow-[0_0_28px_-12px_rgba(248,113,113,0.38)]",
      accent: "border-rose-500/25 text-rose-100",
    },
    {
      key: "qual",
      label: "مؤشر الجودة",
      sub: "نسبة مئوية تقديرية",
      value:
        loading ? "…" : qualityPercent == null ? "—" : `${Math.round(Number(qualityPercent))}%`,
      icon: IconDish,
      glow: "shadow-[0_0_28px_-12px_rgba(52,211,153,0.38)]",
      accent: "border-emerald-500/25 text-emerald-100",
    },
  ];

  return (
    <section dir="rtl" className="mb-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <article
            key={c.key}
            className={`group relative overflow-hidden rounded-2xl border bg-[#070f24]/90 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/20 ${c.accent} ${c.glow}`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(56,189,248,0.06),transparent_45%)] opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{c.label}</p>
                <p className="mt-1 text-[11px] text-slate-500">{c.sub}</p>
              </div>
              <c.icon className="h-9 w-9 shrink-0 text-slate-400 transition group-hover:text-sky-300/90" />
            </div>
            <p className="relative mt-5 text-3xl font-bold tabular-nums tracking-tight text-white">{c.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
