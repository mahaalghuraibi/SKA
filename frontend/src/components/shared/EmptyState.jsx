/** Friendly empty state — icon + title + optional hint */
export default function EmptyState({
  icon = "📭",
  title,
  hint,
  className = "",
}) {
  return (
    <div
      dir="rtl"
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/12 bg-gradient-to-b from-[#0b1327]/80 to-[#060d1f]/60 px-6 py-12 text-center ${className}`}
    >
      <span className="text-4xl leading-none" aria-hidden>
        {icon}
      </span>
      <p className="max-w-md text-sm font-semibold leading-relaxed text-slate-200">{title}</p>
      {hint ? <p className="max-w-md text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}
