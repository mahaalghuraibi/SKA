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
    <article className="rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-4 shadow-glass backdrop-blur-xl transition duration-300 hover:border-white/15 hover:shadow-glass-lg sm:p-6 space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-xl font-bold tracking-tight text-white">
          البحث والتصفية <span className="ms-2 text-[1.1em] opacity-90" aria-hidden>🔎</span>
        </h3>
        <button
          type="button"
          onClick={onResetFilters}
          className="rounded-lg border border-white/15 bg-[#0B1327]/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-brand-sky/40 hover:text-white"
        >
          إعادة الضبط
        </button>
      </header>

      {/* 1. Search input */}
      <div className="relative">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden>🔍</span>
        <input
          type="search"
          value={filterSearch}
          onChange={(e) => {
            setFilterSearch(e.target.value);
            setQuickPreset(null);
          }}
          placeholder="ابحث باسم الطبق…"
          className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 py-3 pe-4 ps-9 text-base text-slate-100 outline-none transition focus:border-brand-sky/60 focus:ring-2 focus:ring-brand-sky/20"
        />
      </div>

      {/* 2. Status filter pills */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500">الحالة</p>
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
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                filterStatus === b.id
                  ? "border-brand-sky/60 bg-brand/30 text-sky-100 ring-1 ring-brand-sky/55"
                  : "border-white/12 bg-[#0B1327]/80 text-slate-300 hover:border-brand-sky/30"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Quick preset pills */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500">فلتر سريع</p>
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
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                (b.id === "all" && !quickPreset && filtersAreDefault) || quickPreset === b.id
                  ? "border-brand-sky/50 bg-brand-sky/15 text-brand-sky"
                  : "border-white/12 bg-[#0B1327]/80 text-slate-300 hover:border-brand-sky/30"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Date range */}
      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { icon: <IconActivity className="h-4 w-4 text-brand-sky" />,    label: "اليوم",       value: dishStats.today,    tone: "text-white" },
          { icon: <IconDish    className="h-4 w-4 text-accent-green" />,  label: "الإجمالي",    value: dishStats.total,    tone: "text-white" },
          { icon: null,                                                     label: "أكثر طبق",    value: dishStats.topDish,  tone: "text-brand-sky text-sm" },
          { icon: <IconBell   className="h-4 w-4 text-accent-amber" />,   label: "مراجعة",      value: dishStats.review,   tone: "text-amber-200" },
          { icon: <IconChart  className="h-4 w-4 text-brand-sky" />,      label: "الكمية",      value: dishStats.totalQty, tone: "text-white" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-[#060d1f]/90 px-3 py-2.5">
            <p className="text-[10px] font-medium text-slate-500">{s.label}</p>
            <p className={`mt-0.5 flex items-center gap-1.5 text-lg font-bold ${s.tone}`}>
              {s.icon}{s.value}
            </p>
          </div>
        ))}
      </div>

      {/* 6. Secondary filters grid */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/8 bg-[#060d1f]/50 p-3 sm:grid-cols-4">
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
    </article>
  );
}
