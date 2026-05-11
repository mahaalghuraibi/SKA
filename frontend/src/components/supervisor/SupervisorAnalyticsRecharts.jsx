import { memo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

const COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#22d3ee"];

/** SECTION D — Comparative KPI bars from live supervisor summary */
function SupervisorAnalyticsRecharts({ loading, supervisorSummary }) {
  if (loading) {
    return (
      <div className="h-56 animate-pulse rounded-2xl border border-white/10 bg-[#060d1f]/40" aria-busy="true" />
    );
  }
  if (!supervisorSummary) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[#060d1f]/30 p-8 text-center text-sm text-slate-500">
        لا توجد بيانات كافية للرسم.
      </div>
    );
  }
  const s = supervisorSummary;
  const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const data = [
    { name: "أطباق", value: n(s.total_dishes) },
    { name: "أسبوع", value: n(s.dishes_week) },
    { name: "مراجعة", value: n(s.pending_reviews) },
    { name: "مخالفات", value: n(s.violations_count) },
    { name: "تنبيهات", value: n(s.alerts_count) },
    { name: "اليوم", value: n(s.dishes_today ?? s.dishes_count) },
  ];

  return (
    <div dir="rtl" className="rounded-2xl border border-white/10 bg-[#060d1f]/45 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">مؤشرات تشغيلية (من الخادم)</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">رسم أعمدة تفاعلي — البيانات فعلية فقط.</p>
      </div>
      <div className="h-[280px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "rgba(56,189,248,0.07)" }}
              contentStyle={{
                backgroundColor: "rgba(15,23,42,0.94)",
                border: "1px solid rgba(148,163,184,0.25)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "#e2e8f0",
              }}
              formatter={(value) => [value, "القيمة"]}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={`k-${i}`} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(SupervisorAnalyticsRecharts);
