import { IconActivity, IconBell, IconChart, IconDish } from "../shared/icons.jsx";
import { DISH_TYPE_FILTER_OPTIONS } from "../../utils/dishRecordsDisplay.js";

function isValidYmdDate(text) {
  const s = String(text || "").trim();
  if (!s) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export default function DishFilters({
  filterSearch,
  setFilterSearch,
  filterStatus,
  setFilterStatus,
  quickPreset,
  setQuickPreset,
  filtersAreDefault,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  filterDateErrors,
  setFilterDateErrors,
  dishStats,
  filterDishType,
  setFilterDishType,
  filterQtyMin,
  setFilterQtyMin,
  filterQtyMax,
  setFilterQtyMax,
  sortKey,
  setSortKey,
  onResetFilters,
}) {
  return (
    <>
      {/* Header */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5"
        data-aos="fade-down"
        data-aos-duration="600"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-sky/80">استعلام</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-white">
            البحث والتصفية <span className="ms-2 text-[1.1em] opacity-90" aria-hidden>🔎</span>
          </h3>
        </div>
        <button
          type="button"
          onClick={onResetFilters}
          className="rounded-xl border border-white/15 bg-[#0B1327]/90 px-4 py-2 text-xs font-semibold text-slate-200 shadow-sm transition hover:border-brand-sky/45 hover:bg-[#111f3a] hover:text-white"
        >
          إعادة الضبط
        </button>
      </header>

      {/* 1. Search input */}
      <div className="relative" data-aos="fade-up" data-aos-delay="40">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden>🔍</span>
        <input
          type="search"
          value={filterSearch}
          onChange={(e) => {
            setFilterSearch(e.target.value);
            setQuickPreset(null);
          }}
          placeholder="ابحث باسم الطبق…"
          className="w-full rounded-xl border border-white/12 bg-[#0B1327]/85 py-3.5 pe-4 ps-10 text-base text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-brand-sky/55 focus:ring-2 focus:ring-brand-sky/18"
        />
      </div>

      {/* 2. Status filter pills */}
      <div className="space-y-2.5" data-aos="fade-up" data-aos-delay="80">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">الحالة</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all",            label: "الكل" },
            { id: "approved",       label: "✅ تم الاعتماد" },
            { id: "pending_review", label: "⚠️ يحتاج مراجعة" },
            { id: "rejected",       label: "❌ مرفوض" },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => { setFilterStatus(b.id); setQuickPreset(null); }}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                filterStatus === b.id
                  ? "border-brand-sky/60 bg-brand/35 text-sky-100 shadow-[0_0_20px_-8px_rgba(56,189,248,0.45)] ring-1 ring-brand-sky/50"
                  : "border-white/12 bg-[#0B1327]/85 text-slate-300 hover:border-brand-sky/35 hover:bg-[#0f1c38]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Quick preset pills */}
      <div className="space-y-2.5" data-aos="fade-up" data-aos-delay="120">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">فلتر سريع</p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "all",     label: "الكل" },
            { id: "today",   label: "اليوم" },
            { id: "week",    label: "هذا الأسبوع" },
            { id: "review",  label: "يحتاج مراجعة" },
            { id: "mostQty", label: "الأكثر كمية" },
          ].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                if (b.id === "all") { onResetFilters(); return; }
                if (b.id === "mostQty") { setQuickPreset("mostQty"); setSortKey("qtyDesc"); return; }
                setQuickPreset(b.id);
              }}
              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                (b.id === "all" && !quickPreset && filtersAreDefault) || quickPreset === b.id
                  ? "border-brand-sky/55 bg-brand-sky/18 text-brand-sky shadow-[0_0_18px_-10px_rgba(56,189,248,0.5)]"
                  : "border-white/12 bg-[#0B1327]/85 text-slate-300 hover:border-brand-sky/35 hover:bg-[#0f1c38]"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Date range */}
      <div className="grid grid-cols-2 gap-4" data-aos="fade-up" data-aos-delay="160">
        <div className="space-y-1">
          <label className="text-xs text-slate-400">من تاريخ</label>
          <input
            type="text"
            dir="ltr"
            inputMode="numeric"
            placeholder="2026-04-01"
            value={filterDateFrom}
            onChange={(e) => {
              const v = e.target.value.trim();
              setFilterDateFrom(v);
              setFilterDateErrors((prev) => ({
                ...prev,
                from: isValidYmdDate(v) ? "" : "صيغة غير صحيحة",
              }));
              setQuickPreset(null);
            }}
            className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
          />
          {filterDateErrors.from ? (
            <p className="text-[11px] text-red-300">{filterDateErrors.from}</p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">إلى تاريخ</label>
          <input
            type="text"
            dir="ltr"
            inputMode="numeric"
            placeholder="2026-04-30"
            value={filterDateTo}
            onChange={(e) => {
              const v = e.target.value.trim();
              setFilterDateTo(v);
              setFilterDateErrors((prev) => ({
                ...prev,
                to: isValidYmdDate(v) ? "" : "صيغة غير صحيحة",
              }));
              setQuickPreset(null);
            }}
            className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
          />
          {filterDateErrors.to ? (
            <p className="text-[11px] text-red-300">{filterDateErrors.to}</p>
          ) : null}
        </div>
      </div>

      {/* 5. Stats strip */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ملخص سريع</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              icon: <IconActivity className="h-5 w-5 text-sky-300" />,
              label: "اليوم",
              value: dishStats.today,
              valueClass: "text-slate-50",
            },
            {
              icon: <IconDish className="h-5 w-5 text-teal-200/90" />,
              label: "الإجمالي",
              value: dishStats.total,
              valueClass: "text-slate-50",
            },
            {
              icon: <IconDish className="h-5 w-5 text-sky-200/80" />,
              label: "أكثر طبق",
              value: dishStats.topDish,
              valueClass: "text-sm font-semibold text-sky-100 sm:text-base",
            },
            {
              icon: <IconBell className="h-5 w-5 text-amber-200/85" />,
              label: "مراجعة",
              value: dishStats.review,
              valueClass: "text-amber-50/95",
            },
            {
              icon: <IconChart className="h-5 w-5 text-slate-200" />,
              label: "الكمية",
              value: dishStats.totalQty,
              valueClass: "text-slate-50",
            },
          ].map((s, i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 rounded-2xl border border-white/12 bg-[linear-gradient(165deg,rgba(15,23,42,0.95)_0%,rgba(11,19,39,0.75)_100%)] px-3 py-3.5 shadow-inner shadow-black/20 transition hover:border-brand-sky/20 sm:px-4 sm:py-4"
              data-aos="fade-up"
              data-aos-delay={String(180 + i * 65)}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-sky/[0.09] ring-1 ring-brand-sky/15">
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.label}</p>
                <p className={`mt-1 break-words text-lg font-bold leading-tight tabular-nums sm:text-xl ${s.valueClass}`}>
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Secondary filters grid */}
      <div
        className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-[#060d1f]/65 p-4 shadow-inner shadow-black/25 sm:grid-cols-4"
        data-aos="fade-up"
        data-aos-delay="120"
      >
        <div className="space-y-1">
          <label className="text-xs text-slate-400">نوع الطبق</label>
          <select
            value={filterDishType}
            onChange={(e) => { setFilterDishType(e.target.value); setQuickPreset(null); }}
            className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
          >
            {DISH_TYPE_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">الكمية (من)</label>
          <input
            type="number"
            min="1"
            value={filterQtyMin}
            onChange={(e) => { setFilterQtyMin(e.target.value); setQuickPreset(null); }}
            className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">الكمية (إلى)</label>
          <input
            type="number"
            min="1"
            value={filterQtyMax}
            onChange={(e) => { setFilterQtyMax(e.target.value); setQuickPreset(null); }}
            className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">ترتيب</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
          >
            <option value="newest">الأحدث أولًا</option>
            <option value="oldest">الأقدم أولًا</option>
            <option value="name">الاسم</option>
            <option value="qtyDesc">الكمية الأعلى</option>
            <option value="qtyAsc">الكمية الأقل</option>
            <option value="confDesc">الثقة الأعلى</option>
            <option value="reviewFirst">يحتاج مراجعة أولًا</option>
          </select>
        </div>
      </div>
    </>
  );
}
