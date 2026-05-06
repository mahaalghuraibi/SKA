import { parseDishRecordedAt, RIYADH_TIMEZONE } from "./datetime.js";

/** Calendar date YYYY-MM-DD in Riyadh for a stored instant */
export function riyadhDateKey(value) {
  const d = value instanceof Date ? value : parseDishRecordedAt(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RIYADH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function riyadhDateKeyToday() {
  return riyadhDateKey(new Date());
}

export function riyadhDateKeyDaysAgo(days) {
  const t = Date.now() - days * 86400000;
  return riyadhDateKey(new Date(t));
}

export const DISH_TYPE_FILTER_OPTIONS = [
  { value: "", label: "كل الأنواع" },
  { value: "سمك", label: "سمك" },
  { value: "دجاج", label: "دجاج" },
  { value: "لحم", label: "لحم" },
  { value: "كباب", label: "كباب" },
  { value: "مكرونة", label: "مكرونة" },
  { value: "سلطة", label: "سلطة" },
  { value: "كبسة دجاج", label: "كبسة دجاج" },
  { value: "كبسة لحم", label: "كبسة لحم" },
  { value: "مندي", label: "مندي" },
  { value: "برياني", label: "برياني" },
  { value: "شوربة", label: "شوربة" },
  { value: "رز", label: "رز" },
  { value: "خبز", label: "خبز" },
  { value: "طبق غير محدد", label: "طبق غير محدد" },
];

/**
 * @param {Array<Record<string, unknown>>} records
 */
export function computeDishStats(records) {
  const todayKey = riyadhDateKeyToday();
  let today = 0;
  let totalQty = 0;
  let review = 0;
  const counts = {};
  for (const r of records) {
    if (riyadhDateKey(r.recordedAt) === todayKey) today += 1;
    totalQty += Number(r.quantity) || 0;
    if (r.needsReviewBadge) review += 1;
    const k = String(r.label || "").trim();
    if (k) counts[k] = (counts[k] || 0) + 1;
  }
  let topDish = "—";
  let topN = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > topN) {
      topN = v;
      topDish = k;
    }
  }
  return {
    today,
    total: records.length,
    topDish,
    review,
    totalQty,
  };
}

/**
 * Client-side filter + sort for staff dish records.
 * @param {Array<Record<string, unknown>>} records
 * @param {{
 *   search: string,
 *   dishType: string,
 *   dateFrom: string,
 *   dateTo: string,
 *   qtyMin: string,
 *   qtyMax: string,
 *   status: 'all'|'trusted'|'review'|'approved'|'pending_review'|'rejected',
 *   quick: 'all'|'today'|'week'|'review'|'mostQty'|null,
 *   sort: string,
 * }} f
 */
export function filterAndSortDishRecords(records, f) {
  let rows = records.map((r) => ({ ...r }));

  let dateFrom = f.dateFrom || "";
  let dateTo = f.dateTo || "";
  let status = f.status || "all";
  let sort = f.sort || "newest";

  if (f.quick === "today") {
    const t = riyadhDateKeyToday();
    dateFrom = t;
    dateTo = t;
  } else if (f.quick === "week") {
    dateFrom = riyadhDateKeyDaysAgo(6);
    dateTo = riyadhDateKeyToday();
  } else if (f.quick === "review") {
    status = "review";
  } else if (f.quick === "mostQty") {
    // Caller sets sort (e.g. qtyDesc) when applying this preset so the UI stays in sync.
    sort = f.sort || "qtyDesc";
  }

  const q = (f.search || "").trim().toLowerCase();
  if (q) {
    rows = rows.filter((r) => String(r.label || "").toLowerCase().includes(q));
  }

  if (f.dishType) {
    rows = rows.filter((r) => String(r.label || "").trim() === f.dishType);
  }

  if (dateFrom) {
    rows = rows.filter((r) => {
      const k = riyadhDateKey(r.recordedAt);
      return k && k >= dateFrom;
    });
  }
  if (dateTo) {
    rows = rows.filter((r) => {
      const k = riyadhDateKey(r.recordedAt);
      return k && k <= dateTo;
    });
  }

  const minQ = f.qtyMin !== "" && f.qtyMin != null ? Number(f.qtyMin) : NaN;
  const maxQ = f.qtyMax !== "" && f.qtyMax != null ? Number(f.qtyMax) : NaN;
  if (Number.isFinite(minQ)) {
    rows = rows.filter((r) => (Number(r.quantity) || 0) >= minQ);
  }
  if (Number.isFinite(maxQ)) {
    rows = rows.filter((r) => (Number(r.quantity) || 0) <= maxQ);
  }

  if (status === "trusted" || status === "approved") {
    rows = rows.filter((r) => r.trustworthyBadge && !r.needsReviewBadge);
  } else if (status === "review" || status === "pending_review") {
    rows = rows.filter((r) => r.needsReviewBadge);
  } else if (status === "rejected") {
    rows = rows.filter((r) => String(r.reviewStatus || "") === "rejected");
  }

  const ts = (r) => parseDishRecordedAt(r.recordedAt).getTime() || 0;
  const conf = (r) => (typeof r.confidenceRatio === "number" && Number.isFinite(r.confidenceRatio) ? r.confidenceRatio : -1);

  rows.sort((a, b) => {
    if (sort === "reviewFirst") {
      const ra = a.needsReviewBadge ? 1 : 0;
      const rb = b.needsReviewBadge ? 1 : 0;
      if (ra !== rb) return rb - ra;
      return ts(b) - ts(a);
    }
    if (sort === "oldest") return ts(a) - ts(b);
    if (sort === "newest") return ts(b) - ts(a);
    if (sort === "name") return String(a.label || "").localeCompare(String(b.label || ""), "ar");
    if (sort === "qtyDesc") return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
    if (sort === "qtyAsc") return (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
    if (sort === "confDesc") return conf(b) - conf(a);
    return ts(b) - ts(a);
  });

  return rows;
}
