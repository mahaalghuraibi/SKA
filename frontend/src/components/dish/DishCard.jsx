import FoodImageThumb from "../shared/FoodImageThumb.jsx";
import { staffStatusTone, dishRecordThumbSrc } from "../../utils/dishHelpers.js";
import { formatConfidencePercentDisplay } from "../../utils/confidence.js";

export default function DishCard({ record, highlighted, onEdit, onDelete }) {
  const reviewBorder = record.needsReviewBadge
    ? "border-orange-400/50 ring-1 ring-orange-400/15"
    : "";
  const trustBorder =
    record.trustworthyBadge && !record.needsReviewBadge
      ? "border-emerald-500/35 ring-1 ring-emerald-500/10"
      : "border-white/10";
  const hl = highlighted
    ? "shadow-[0_0_28px_-6px_rgba(56,189,248,0.45)] ring-1 ring-brand-sky/35"
    : "";
  const confLabel =
    record.confidenceRatio != null && Number.isFinite(record.confidenceRatio)
      ? formatConfidencePercentDisplay(record.confidenceRatio)
      : null;

  return (
    <li
      id={`dish-row-${record.rawId}`}
      className={`group rounded-2xl border bg-[#060d1f]/90 p-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 sm:p-5 ${reviewBorder || trustBorder} ${hl}`}
    >
      <div className="flex gap-3 sm:gap-4">
        <FoodImageThumb
          src={dishRecordThumbSrc(record)}
          alt={record.label}
          sizeClass="h-20 w-20 shrink-0 rounded-xl sm:h-24 sm:w-24"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="break-words text-lg font-bold text-brand-sky sm:text-xl">
              {record.label}
            </p>
            <div className="flex items-center gap-1.5">
              {record.needsReviewBadge ? (
                <span className="rounded-full border border-orange-400/50 bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-100">
                  مراجعة
                </span>
              ) : null}
              {record.reviewStatus === "rejected" ? (
                <span className="rounded-full border border-red-400/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-100">
                  مرفوض
                </span>
              ) : null}
              {record.trustworthyBadge ? (
                <span className="rounded-full border border-accent-green/45 bg-accent-green/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                  معتمد
                </span>
              ) : null}
              {record.reviewStatus !== "approved" ? (
                <>
                  <button
                    type="button"
                    title="تعديل"
                    onClick={() => onEdit(record)}
                    className="rounded-lg border border-white/15 bg-[#0B1327]/80 px-2 py-1 text-xs text-slate-200 transition hover:border-brand-sky/40 hover:text-white"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    title="حذف"
                    onClick={() => onDelete(record)}
                    className="rounded-lg border border-accent-red/35 bg-accent-red/10 px-2 py-1 text-xs text-red-200 transition hover:bg-accent-red/20"
                  >
                    🗑️
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500" dir="rtl">
            📅 {record.dateLine} &nbsp;⏰ {record.timeLine}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>
              كمية: <span className="font-semibold text-slate-200">{record.quantity}</span>
            </span>
            {record.sourceEntity ? (
              <span>
                مصدر: <span className="text-slate-200">{record.sourceEntity}</span>
              </span>
            ) : null}
            <span className={`font-semibold ${staffStatusTone(record.statusText)}`}>
              {record.statusText}
            </span>
            {confLabel && confLabel !== "—" ? (
              <span>
                ثقة:{" "}
                <span
                  className={`font-semibold ${
                    !record.needsReviewBadge &&
                    record.confidenceRatio != null &&
                    record.confidenceRatio >= 0.75
                      ? "text-emerald-300"
                      : "text-brand-sky"
                  }`}
                >
                  {confLabel}
                </span>
              </span>
            ) : null}
            {record.reviewStatus === "rejected" && record.rejectedReason ? (
              <span className="text-red-300">
                سبب الرفض: <span className="font-semibold">{record.rejectedReason}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
