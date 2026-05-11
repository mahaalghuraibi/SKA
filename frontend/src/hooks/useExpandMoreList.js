import { useEffect, useState } from "react";

/** Slice long lists/tables: show first N rows until toggled (no wrapper DOM). */
export function useExpandMoreList(itemCount, initialVisible = 3) {
  const [expanded, setExpanded] = useState(false);
  const n = Math.max(0, Number(itemCount) || 0);
  const hasMore = n > initialVisible;
  const limit = expanded ? n : Math.min(initialVisible, n);
  const toggle = () => setExpanded((e) => !e);
  useEffect(() => {
    setExpanded(false);
  }, [n]);
  return { expanded, hasMore, limit, toggle };
}
