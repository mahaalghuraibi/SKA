import Spinner from "../shared/Spinner.jsx";
import { formatConfidencePercentDisplay } from "../../utils/confidence.js";

const UNKNOWN_DISH_TEXT = "طبق غير محدد";

export default function DetectResultCard({
  detectResult,
  manualDish,
  setManualDish,
  selectedAlternative,
  setSelectedAlternative,
  quantity,
  setQuantity,
  sourceEntity,
  setSourceEntity,
  saveLoading,
  detecting,
  selectedImage,
  onSave,
  onReanalyze,
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-[#060d1f]/90 p-5 sm:p-6">
      {/* Warning banner */}
      {(detectResult.needsReviewLowConf ||
        detectResult.proteinConflict ||
        (detectResult.topConfRatio != null && detectResult.topConfRatio < 0.75)) ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3">
          <span className="shrink-0 text-xl leading-none" aria-hidden>⚠️</span>
          <p className="text-sm font-semibold text-amber-100">
            {detectResult.proteinConflict
              ? "تعارض في التصنيف — يرجى الاختيار يدويًا"
              : "يرجى مراجعة اسم الطبق قبل الحفظ"}
          </p>
        </div>
      ) : null}

      {/* Dish name + confidence + status */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">الطبق المُكتشف</p>
          <p className="mt-1 break-words text-3xl font-bold text-white sm:text-4xl">
            {(manualDish.trim() || detectResult.detected || UNKNOWN_DISH_TEXT).trim()}
          </p>
          {manualDish.trim() && detectResult.detected && manualDish.trim() !== detectResult.detected.trim() ? (
            <p className="mt-1 text-xs text-slate-500">
              تقدير الذكاء الاصطناعي:{" "}
              <span className="font-medium text-slate-400">{detectResult.detected}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {!detectResult.needsReviewLowConf &&
          !detectResult.proteinConflict &&
          detectResult.topConfRatio != null &&
          detectResult.topConfRatio >= 0.75 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />موثوق
            </span>
          ) : detectResult.topConfRatio != null &&
            Number.isFinite(detectResult.topConfRatio) &&
            detectResult.topConfRatio > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200">
              <span className="h-2 w-2 rounded-full bg-amber-400" />يحتاج مراجعة
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/40 bg-slate-500/10 px-3 py-1.5 text-xs font-bold text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-500" />غير مؤكد
            </span>
          )}
          {detectResult.topConfRatio != null && Number.isFinite(detectResult.topConfRatio) ? (
            <div className="text-end">
              <p className="text-2xl font-bold tabular-nums text-brand-sky">
                {formatConfidencePercentDisplay(detectResult.topConfRatio)}
              </p>
              <p className="text-[10px] text-slate-600">نسبة الثقة</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Suggestion chips */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          اقتراحات بديلة — اضغط للاختيار
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(detectResult.suggestions?.length
            ? detectResult.suggestions
            : (detectResult.alternatives || []).map((name) => ({ name, confidence: null, reason: "" }))
          )
            .slice(0, 3)
            .map((s, idx) => {
              const chipName = typeof s === "string" ? s : s.name;
              const rawConf = typeof s === "object" && s != null ? s.confidence : undefined;
              const pctLabel = formatConfidencePercentDisplay(rawConf);
              const tip = typeof s === "object" && s?.reason ? s.reason : "";
              const selected = manualDish === chipName || selectedAlternative === chipName;
              return (
                <button
                  key={`${chipName}-${idx}`}
                  type="button"
                  title={tip || undefined}
                  onClick={() => {
                    setSelectedAlternative(chipName);
                    setManualDish(chipName);
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3.5 text-center transition ${
                    selected
                      ? "border-brand-sky/60 bg-gradient-to-b from-brand-sky/20 to-brand/10 text-white shadow-[0_0_20px_-6px_rgba(56,189,248,0.5)] ring-1 ring-brand-sky/40"
                      : "border-white/10 bg-[#0B1327]/90 text-slate-200 hover:border-brand-sky/35 hover:bg-[#0d1a38]"
                  }`}
                >
                  <span className="text-sm font-bold leading-tight">{chipName}</span>
                  <span className="text-base font-bold tabular-nums text-brand-sky">{pctLabel}</span>
                  {rawConf != null && Number.isFinite(rawConf) && rawConf < 0.75 ? (
                    <span className="text-[9px] font-semibold text-amber-300">مراجعة</span>
                  ) : null}
                </button>
              );
            })}
        </div>
      </div>

      {/* Manual edit */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-400">تعديل اسم الطبق يدويًا</label>
        <input
          type="text"
          value={manualDish}
          onChange={(e) => setManualDish(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (saveLoading || detecting || !selectedImage) return;
            e.preventDefault();
            onSave();
          }}
          placeholder={
            detectResult?.proteinConflict
              ? "اختر من الاقتراحات أو اكتب الاسم"
              : "أو اكتب اسم الطبق يدويًا"
          }
          className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-sky/60 focus:ring-2 focus:ring-brand-sky/20"
        />
      </div>

      {/* Qty + Source */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400">الكمية</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-sky/60 focus:ring-2 focus:ring-brand-sky/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400">المصدر</label>
          <input
            type="text"
            value={sourceEntity}
            onChange={(e) => setSourceEntity(e.target.value)}
            placeholder="بوفيه A"
            className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-sky/60 focus:ring-2 focus:ring-brand-sky/20"
          />
        </div>
      </div>

      {/* Save */}
      <button
        type="button"
        disabled={saveLoading || detecting || !selectedImage}
        onClick={onSave}
        className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-sky py-4 text-base font-bold text-white shadow-lg shadow-brand/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saveLoading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Spinner className="h-5 w-5 border-2 border-white/30 border-t-white" />
            جاري الحفظ…
          </span>
        ) : (
          "✅ حفظ الطبق"
        )}
      </button>
      <div className="text-center">
        <button
          type="button"
          onClick={onReanalyze}
          disabled={saveLoading}
          className="text-xs text-slate-600 transition hover:text-brand-sky disabled:opacity-50"
        >
          إعادة تحليل الصورة
        </button>
      </div>
    </div>
  );
}
