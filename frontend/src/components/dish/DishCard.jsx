import { memo } from "react";
import FoodImageThumb from "../shared/FoodImageThumb.jsx";
import { staffStatusTone, dishRecordThumbSrc } from "../../utils/dishHelpers.js";
import { formatConfidencePercentDisplay } from "../../utils/confidence.js";

function IconPencil({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M4 13.5V20h5.5L19.5 10 15 5.5 4 16.5v-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M10 11v6M14 11v6M6 7l1 14h10l1-14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DishCard({ record, highlighted, onEdit, onDelete, aosListIndex }) {
  const reviewBorder = record.needsReviewBadge
    ? "border-amber-400/35 ring-1 ring-amber-400/20"
    : "";
  const trustBorder =
    record.trustworthyBadge && !record.needsReviewBadge
      ? "border-teal-500/30 ring-1 ring-teal-500/10"
      : "border-white/10";
  const hl = highlighted
    ? "shadow-[0_0_28px_-6px_rgba(56,189,248,0.45)] ring-1 ring-brand-sky/35"
    : "";
  const confLabel =
    record.confidenceRatio != null && Number.isFinite(record.confidenceRatio)
      ? formatConfidencePercentDisplay(record.confidenceRatio)
      : null;

  const aosDelay = aosListIndex != null ? String(Math.min(aosListIndex * 55, 440)) : undefined;

  return (
    <li
      id={`dish-row-${record.rawId}`}
      className={`group rounded-2xl border bg-[#060d1f]/90 p-4 shadow-md backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/18 hover:shadow-lg hover:shadow-black/30 sm:p-5 lg:p-6 ${reviewBorder || trustBorder} ${hl}`}
      {...(aosListIndex != null
        ? { "data-aos": "fade-up", "data-aos-delay": aosDelay }
        : {})}
    >
      <div className="flex gap-4 sm:gap-5">
        <FoodImageThumb
          src={dishRecordThumbSrc(record)}
          alt={record.label}
          sizeClass="h-[5.5rem] w-[5.5rem] shrink-0 rounded-xl sm:h-28 sm:w-28"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="break-words text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
                {record.label}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{record.dateLine}</span>
                <span className="text-slate-600" aria-hidden>
                  ·
                </span>
                <span>{record.timeLine}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {record.needsReviewBadge ? (
                <span className="rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-100">
                  مراجعة
                </span>
              ) : null}
              {record.reviewStatus === "rejected" ? (
                <span className="rounded-full border border-rose-400/40 bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-100">
                  مرفوض
                </span>
              ) : null}
              {record.trustworthyBadge ? (
                <span className="rounded-full border border-teal-400/35 bg-teal-500/15 px-2.5 py-1 text-xs font-semibold text-teal-100">
                  معتمد
                </span>
              ) : null}
              {record.reviewStatus !== "approved" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="تعديل"
                    onClick={() => onEdit(record)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#0B1327]/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/45 hover:bg-brand/10 hover:text-white"
                  >
                    <IconPencil className="h-3.5 w-3.5 opacity-80" />
                    تعديل
                  </button>
                  <button
                    type="button"
                    title="حذف"
                    onClick={() => onDelete(record)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-100 transition hover:border-rose-400/50 hover:bg-rose-500/15"
                  >
                    <IconTrash className="h-3.5 w-3.5 opacity-80" />
                    حذف
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-white/8 pt-3 text-xs sm:text-[13px]">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-slate-400">
              <span>
                الكمية{" "}
                <span className="font-semibold tabular-nums text-slate-200">{record.quantity}</span>
              </span>
              {record.sourceEntity ? (
                <span>
                  المصدر{" "}
                  <span className="font-medium text-slate-300">{record.sourceEntity}</span>
                </span>
              ) : null}
              <span className={`font-semibold ${staffStatusTone(record.statusText)}`}>
                {record.statusText}
              </span>
              {confLabel && confLabel !== "—" ? (
                <span>
                  الثقة{" "}
                  <span
                    className={`font-semibold tabular-nums ${
                      !record.needsReviewBadge &&
                      record.confidenceRatio != null &&
                      record.confidenceRatio >= 0.75
                        ? "text-teal-200/90"
                        : "text-sky-200/95"
                    }`}
                  >
                    {confLabel}
                  </span>
                </span>
              ) : null}
            </div>
            {record.reviewStatus === "rejected" && record.rejectedReason ? (
              <p className="text-sm text-rose-200/90">
                سبب الرفض:{" "}
                <span className="font-semibold text-rose-100">{record.rejectedReason}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export default memo(DishCard);
