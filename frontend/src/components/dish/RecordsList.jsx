import { IconDish } from "../shared/icons.jsx";
import DishCard from "./DishCard.jsx";

export default function RecordsList({
  staffRecords,
  displayedRecords,
  staffRecordsLoading,
  staffRecordsLastUpdated,
  highlightRawId,
  onEdit,
  onDelete,
}) {
  return (
    <>
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <h3 className="text-xl font-bold tracking-tight text-white sm:text-[1.35rem]">
          سجل الأطباق <span className="ms-2 text-[1.05em] opacity-90" aria-hidden>📋</span>
        </h3>
        <div className="text-sm text-slate-400">
          <p>
            عرض <span className="font-semibold text-slate-200">{displayedRecords.length}</span> من{" "}
            <span className="font-semibold text-slate-200">{staffRecords.length}</span> سجلًا
          </p>
          {staffRecordsLastUpdated ? (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">آخر تحديث: {staffRecordsLastUpdated}</p>
          ) : null}
        </div>
      </div>

      {staffRecordsLoading ? (
        <ul className="space-y-5 sm:space-y-6">
          {[1, 2, 3].map((k) => (
            <li key={k} className="animate-pulse rounded-2xl border border-white/10 bg-[#060d1f]/90 p-5">
              <div className="mb-3 h-5 w-48 rounded bg-white/10" />
              <div className="mb-2 h-4 w-64 rounded bg-white/10" />
              <div className="h-4 w-36 rounded bg-white/10" />
            </li>
          ))}
        </ul>
      ) : staffRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#060d1f]/80 px-6 py-16 text-center sm:py-20">
          <IconDish className="mx-auto mb-4 h-12 w-12 text-slate-600" />
          <p className="text-base font-medium text-slate-300">لا توجد أطباق مسجلة بعد</p>
          <p className="mt-2 text-sm text-slate-500">سجّل أول طبق من النموذج أعلاه لتظهر هنا.</p>
        </div>
      ) : displayedRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-500/25 bg-[#060d1f]/80 px-6 py-14 text-center text-slate-300 sm:py-16">
          لا توجد نتائج مطابقة للفلاتر
        </div>
      ) : (
        <ul className="space-y-5 sm:space-y-6">
          {displayedRecords.map((record) => (
            <DishCard
              key={record.id}
              record={record}
              highlighted={highlightRawId === record.rawId}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </>
  );
}
