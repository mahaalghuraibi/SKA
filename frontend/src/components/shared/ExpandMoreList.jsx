import { Children, useMemo, useState } from "react";

/**
 * Shows first `initialVisible` children; toggle expands/collapses the rest.
 * Reusable for alerts, employees, cameras, dish reviews, table rows (as fragments).
 */
export default function ExpandMoreList({
  children,
  initialVisible = 3,
  className = "",
  listClassName = "",
  buttonClassName = "",
}) {
  const items = useMemo(() => Children.toArray(children).filter(Boolean), [children]);
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > initialVisible;
  const visible = expanded ? items : items.slice(0, initialVisible);

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className={listClassName}>{visible}</div>
      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className={
              buttonClassName ||
              "rounded-xl border border-white/12 bg-[#0B1327]/85 px-5 py-2.5 text-xs font-semibold text-slate-200 shadow-sm transition hover:border-brand-sky/35 hover:bg-[#0f1a35] hover:text-white"
            }
          >
            {expanded ? "عرض أقل ↑" : "عرض المزيد ↓"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
