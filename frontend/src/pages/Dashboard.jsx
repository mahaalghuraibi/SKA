import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ACCESS_TOKEN_KEY, CURRENT_USER_ME_URLS } from "../constants.js";
import { dishSaveErrorMessage } from "../utils/apiError.js";
import { formatConfidencePercentDisplay } from "../utils/confidence.js";
import { useDetectDish } from "../hooks/useDetectDish.js";
import { useDishRecords } from "../hooks/useDishRecords.js";
import { useDashboardAuth } from "../hooks/useDashboardAuth.js";
import { useToastStore } from "../stores/useToastStore.js";
import {
  formatSaudiDateLine,
  formatSaudiDateTime,
  formatSaudiTimeLine,
} from "../utils/datetime.js";
import { computeDishStats, filterAndSortDishRecords } from "../utils/dishRecordsDisplay.js";
import DashboardNav from "../components/navigation/DashboardNav.jsx";
import Toast from "../components/shared/Toast.jsx";
import DeleteConfirmModal from "../components/shared/DeleteConfirmModal.jsx";
import DishDocSection from "../components/dish/DishDocSection.jsx";
import DishFilters from "../components/dish/DishFilters.jsx";
import RecordsList from "../components/dish/RecordsList.jsx";
import EditRecordModal from "../components/dish/EditRecordModal.jsx";
import StaffProfileCard from "../components/staff/StaffProfileCard.jsx";
import CameraCaptureSection from "../components/camera/CameraCaptureSection.jsx";

/** Merge API `avatar_url` / `avatar_data_url` for UI + `<img src>`. */
function normalizeStaffMeUser(body) {
  if (!body || typeof body !== "object") return body;
  const avatar = body.avatar_url ?? body.avatar_data_url ?? null;
  const email = String(body.email || "").trim().toLowerCase();
  const local = email.includes("@") ? email.split("@")[0].trim() : "";
  const username = String(body.username || "").trim().toLowerCase() || local;
  const branch_id = Number(body.branch_id);
  const branch_name = String(body.branch_name || "").trim() || "فرع تجريبي";
  const supervisor_name = String(body.supervisor_name || "").trim() || "supervisor";
  return {
    ...body,
    username,
    branch_id: Number.isFinite(branch_id) ? branch_id : 1,
    branch_name,
    supervisor_name,
    avatar_url: avatar,
    avatar_data_url: avatar,
  };
}

function IconBell({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22a2.5 2.5 0 002.45-2H9.55A2.5 2.5 0 0012 22z"
        fill="currentColor"
      />
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDish({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="14" rx="8" ry="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 14c0-4 3.5-8 8-8s8 4 8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChart({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16M8 17V11M12 17V8M16 17v-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconActivity({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner({ className = "h-5 w-5 border-2 border-white/25 border-t-white" }) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full ${className}`}
      aria-hidden
    />
  );
}

function SkeletonPulse({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-l from-white/[0.04] to-white/[0.09] ${className}`}
      aria-hidden
    />
  );
}

function downloadUtf8Csv(filename, headerRow, rows) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headerRow.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** CSS-only relative bars from API numbers (no chart library). */
function SupervisorAnalyticsBars({ loading, supervisorSummary }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#060d1f]/45 p-4 sm:p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">توزيع المؤشرات</p>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonPulse key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (!supervisorSummary) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[#060d1f]/30 p-6 text-center text-sm text-slate-500">
        لا توجد بيانات كافية لعرض الرسم.
      </div>
    );
  }
  const s = supervisorSummary;
  const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const rows = [
    { label: "إجمالي الأطباق", value: n(s.total_dishes), barClass: "from-sky-500/90 to-sky-400/70" },
    { label: "هذا الأسبوع", value: n(s.dishes_week), barClass: "from-emerald-500/85 to-emerald-400/65" },
    { label: "معلّق للمراجعة", value: n(s.pending_reviews), barClass: "from-amber-500/85 to-amber-400/60" },
    { label: "مخالفات المراقبة", value: n(s.violations_count), barClass: "from-rose-500/85 to-rose-400/60" },
    { label: "التنبيهات", value: n(s.alerts_count), barClass: "from-violet-500/80 to-violet-400/55" },
    {
      label: "أطباق اليوم",
      value: n(s.dishes_today ?? s.dishes_count),
      barClass: "from-cyan-500/80 to-cyan-400/55",
    },
  ];
  const maxVal = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-2xl border border-white/10 bg-[#060d1f]/45 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-sky/90">مخطط نسبي</p>
          <p className="mt-0.5 text-sm text-slate-400">مقارنة أحجام المؤشرات وفق البيانات الحالية من الخادم.</p>
        </div>
      </div>
      <ul className="space-y-3.5" aria-label="مؤشرات أداء نسبية">
        {rows.map((r) => {
          const pct = Math.round((r.value / maxVal) * 100);
          return (
            <li key={r.label}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className="font-medium text-slate-300">{r.label}</span>
                <span className="tabular-nums text-slate-500">{r.value}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#020617]/80 ring-1 ring-white/5">
                <div
                  className={`h-full rounded-full bg-gradient-to-l ${r.barClass} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Same-origin API paths (Vite proxy /api) + remote URLs + blob + data URLs. */
function isRenderableImageSrc(src) {
  if (typeof src !== "string") return false;
  const s = src.trim();
  if (!s) return false;
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("blob:") ||
    s.startsWith("data:") ||
    s.startsWith("/api/")
  );
}

/** Square food thumbnail: real image or placeholder. */
function FoodImageThumb({ src, alt = "", sizeClass = "h-24 w-24" }) {
  const [failed, setFailed] = useState(false);
  const show = isRenderableImageSrc(src) && !failed;
  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden rounded-xl bg-[#0B1327] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.55)] ring-1 ring-white/10 transition hover:ring-brand-sky/25`}
    >
      {show ? (
        <img
          alt={alt}
          src={src}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-500">
          <IconDish className="h-9 w-9 opacity-45" />
          <span className="px-1 text-center text-[10px] leading-tight text-slate-600">بدون صورة</span>
        </div>
      )}
    </div>
  );
}

const glassCard =
  "rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] p-4 shadow-glass backdrop-blur-xl transition duration-300 hover:border-white/15 hover:shadow-glass-lg sm:p-6";

/** Staff dashboard: in-page sections for anchor nav + scroll spy */
const STAFF_SECTION_IDS = {
  doc: "section-dish-doc",
  search: "section-search-filter",
  records: "section-dish-records",
};

const STAFF_HASH_TO_SECTION = {
  [`#${STAFF_SECTION_IDS.doc}`]: STAFF_SECTION_IDS.doc,
  [`#${STAFF_SECTION_IDS.search}`]: STAFF_SECTION_IDS.search,
  "#section-dish-search": STAFF_SECTION_IDS.search,
  [`#${STAFF_SECTION_IDS.records}`]: STAFF_SECTION_IDS.records,
};

const SUPERVISOR_SECTION_IDS = {
  analytics: "analytics",
  cameras: "cameras",
  alerts: "alerts",
  reviews: "dish-reviews",
  reports: "reports",
  employees: "employees",
  settings: "settings",
};

const SUPERVISOR_HASH_TO_SECTION = {
  "#analytics": SUPERVISOR_SECTION_IDS.analytics,
  "#cameras": SUPERVISOR_SECTION_IDS.cameras,
  "#alerts": SUPERVISOR_SECTION_IDS.alerts,
  "#dish-reviews": SUPERVISOR_SECTION_IDS.reviews,
  "#reports": SUPERVISOR_SECTION_IDS.reports,
  "#employees": SUPERVISOR_SECTION_IDS.employees,
  "#settings": SUPERVISOR_SECTION_IDS.settings,
};

const ADMIN_SETTINGS_STORAGE_KEY = "ska_admin_settings";
const REVIEW_PAGE_SIZE = 8;
const EMPLOYEE_PAGE_SIZE = 6;
const ALERTS_PAGE_STEP = 8;
const ADMIN_SETTINGS_DEFAULTS = {
  ai: {
    minConfidence: 70,
    violations: {
      mask: true,
      gloves: true,
      headCover: true,
      wetFloor: true,
      containers: true,
    },
  },
  alerts: {
    enabled: true,
    defaultSeverity: "medium",
  },
  reports: {
    pdfEnabled: false,
    excelEnabled: false,
  },
  system: {
    platformName: "SKA Smart Kitchen Analytics",
    defaultLanguage: "العربية",
    timezone: "Asia/Riyadh",
  },
};

function normalizeAdminSettingsShape(input) {
  const obj = input && typeof input === "object" ? input : {};
  const aiObj = obj.ai && typeof obj.ai === "object" ? obj.ai : {};
  const violationsObj = aiObj.violations && typeof aiObj.violations === "object" ? aiObj.violations : {};
  const alertsObj = obj.alerts && typeof obj.alerts === "object" ? obj.alerts : {};
  const reportsObj = obj.reports && typeof obj.reports === "object" ? obj.reports : {};
  const systemObj = obj.system && typeof obj.system === "object" ? obj.system : {};
  const minConfidenceNum = Number(aiObj.minConfidence);
  const severity = String(alertsObj.defaultSeverity || "").trim().toLowerCase();
  const validSeverity = severity === "low" || severity === "medium" || severity === "high";
  return {
    ai: {
      minConfidence: Number.isFinite(minConfidenceNum)
        ? Math.max(0, Math.min(100, Math.round(minConfidenceNum)))
        : ADMIN_SETTINGS_DEFAULTS.ai.minConfidence,
      violations: {
        mask: Boolean(violationsObj.mask),
        gloves: Boolean(violationsObj.gloves),
        headCover: Boolean(violationsObj.headCover),
        wetFloor: Boolean(violationsObj.wetFloor),
        containers: Boolean(violationsObj.containers),
      },
    },
    alerts: {
      enabled: Boolean(alertsObj.enabled),
      defaultSeverity: validSeverity ? severity : ADMIN_SETTINGS_DEFAULTS.alerts.defaultSeverity,
    },
    reports: {
      pdfEnabled: Boolean(reportsObj.pdfEnabled),
      excelEnabled: Boolean(reportsObj.excelEnabled),
    },
    system: {
      platformName: String(systemObj.platformName || "").trim() || ADMIN_SETTINGS_DEFAULTS.system.platformName,
      defaultLanguage: ADMIN_SETTINGS_DEFAULTS.system.defaultLanguage,
      timezone: ADMIN_SETTINGS_DEFAULTS.system.timezone,
    },
  };
}

function staffSectionFromHash(hashValue) {
  const h = String(hashValue || "").trim();
  if (!h) return null;
  const normalized = h.endsWith("/") ? h.slice(0, -1) : h;
  return STAFF_HASH_TO_SECTION[normalized] || null;
}

function supervisorSectionFromHash(hashValue) {
  const h = String(hashValue || "").trim();
  if (!h) return null;
  const normalized = h.endsWith("/") ? h.slice(0, -1) : h;
  return SUPERVISOR_HASH_TO_SECTION[normalized] || null;
}

function isValidYmdDate(text) {
  const s = String(text || "").trim();
  if (!s) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Dish photos stored as data URLs in DB; under backend `_MAX_DISH_IMAGE_URL_LEN` */
const DISH_IMAGE_DATA_URL_MAX_CHARS = 5_800_000;

const SUPERVISOR_REVIEWS_URL = "/api/v1/supervisor/reviews";
const SUPERVISOR_CAMERAS_URL = "/api/v1/supervisor/cameras";

function protectedApiErrorText(status, detail) {
  if (status === 401) return "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى";
  if (status === 403) return "ليس لديك صلاحية للوصول لهذه الصفحة";
  if (typeof detail === "string" && detail.trim()) return detail;
  return "تعذر تحميل البيانات.";
}

const SUPERVISOR_ALERTS_URL = "/api/v1/supervisor/alerts";
const MONITORING_ANALYZE_URL = "/api/v1/monitoring/analyze-frame";
const DISH_REVIEW_UPDATED_EVENT = "ska:dish-review-updated";
const SUPERVISOR_SUMMARY_URL = "/api/v1/supervisor/summary";
const SUPERVISOR_EMPLOYEES_URL = "/api/v1/supervisor/employees";
function positiveIntQuantity(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function readImageFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result;
      if (typeof s !== "string") reject(new Error("invalid_result"));
      else resolve(s);
    };
    reader.onerror = () => reject(reader.error || new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

function supervisorStatusText(status) {
  if (status === "approved") return "تم الاعتماد";
  if (status === "rejected") return "مرفوض";
  return "يحتاج مراجعة";
}

function roleAr(role) {
  if (role === "staff") return "موظف";
  if (role === "supervisor") return "سوبر فايزر";
  if (role === "admin") return "أدمن";
  return role || "—";
}

function staffStatusText(status, needsReview) {
  if (status === "approved") return "تم الاعتماد";
  if (status === "rejected") return "مرفوض";
  if (status === "pending_review" || status === "needs_review" || needsReview) return "يحتاج مراجعة";
  return needsReview ? "يحتاج مراجعة" : "موثوق";
}

function displayAiConfidence(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return "غير متوفر";
  const pct = n <= 1 ? n * 100 : n;
  if (pct <= 0) return "غير متوفر";
  return `${Math.round(pct * 10) / 10}%`;
}

function monitoringCheckCardClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "safe") return "border-emerald-500/40 bg-emerald-500/10";
  if (s === "violation") return "border-red-500/45 bg-red-500/10";
  if (s === "needs_review") return "border-amber-500/45 bg-amber-500/10";
  return "border-white/15 bg-[#0B1327]/70";
}

function monitoringStatusLabelAr(status) {
  const s = String(status || "").toLowerCase();
  if (s === "safe") return "سليم";
  if (s === "violation") return "مخالفة";
  if (s === "needs_review") return "يحتاج مراجعة";
  return "غير مؤكد";
}

function monitoringAlertStatusAr(status) {
  const s = String(status || "").toLowerCase();
  if (s === "open") return "مفتوح";
  if (s === "new") return "جديد";
  if (s === "resolved") return "تمت المعالجة";
  return status || "—";
}

/** Stored `violation_type` from monitoring_alerts → category for admin reports */
const VIOLATION_REPORT_CATEGORY_ORDER = [
  { key: "no_mask", label: "الكمامة" },
  { key: "no_gloves", label: "القفازات" },
  { key: "no_headcover", label: "غطاء الرأس" },
  { key: "trash_location", label: "الحاويات" },
  { key: "wet_floor", label: "الأرضيات المبللة" },
];

function violationReportTypeLabel(violationType) {
  const t = String(violationType || "").trim().toLowerCase();
  const row = VIOLATION_REPORT_CATEGORY_ORDER.find((c) => c.key === t);
  if (row) return row.label;
  if (t === "no_uniform") return "الزي الموحّد";
  return null;
}

function computeViolationsReportStats(alerts) {
  const list = Array.isArray(alerts) ? alerts : [];
  const typeCounts = Object.fromEntries(VIOLATION_REPORT_CATEGORY_ORDER.map((c) => [c.key, 0]));
  typeCounts._other = 0;
  const byRawType = new Map();
  let openCount = 0;
  let resolvedCount = 0;
  for (const a of list) {
    const raw = String(a.type || "").trim().toLowerCase();
    if (raw) {
      byRawType.set(raw, (byRawType.get(raw) || 0) + 1);
    }
    const known = VIOLATION_REPORT_CATEGORY_ORDER.some((c) => c.key === raw);
    if (known) {
      typeCounts[raw] += 1;
    } else if (raw) {
      typeCounts._other += 1;
    }
    const st = String(a.status || "").toLowerCase();
    if (st === "resolved") resolvedCount += 1;
    else openCount += 1;
  }
  let topRaw = "";
  let topN = 0;
  for (const [k, n] of byRawType.entries()) {
    if (n > topN) {
      topN = n;
      topRaw = k;
    }
  }
  let topLabel = "—";
  if (topN > 0 && topRaw) {
    topLabel =
      violationReportTypeLabel(topRaw) ||
      list.find((x) => String(x.type || "").trim().toLowerCase() === topRaw)?.label_ar ||
      topRaw;
  }
  const sortedLatest = [...list].sort(
    (x, y) => new Date(y.created_at || 0).getTime() - new Date(x.created_at || 0).getTime(),
  );
  return {
    total: list.length,
    typeCounts,
    openCount,
    resolvedCount,
    topRepeated: { type: topRaw, count: topN, label: topLabel },
    latest: sortedLatest.slice(0, 15),
  };
}

function formatFileBytes(sizeBytes) {
  const n = Number(sizeBytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatVideoDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return "غير متاح";
  const s = Math.floor(total % 60);
  const m = Math.floor((total / 60) % 60);
  const h = Math.floor(total / 3600);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function makeVideoFrameTimes(durationSec, sampleCount = 12) {
  const d = Number(durationSec);
  if (!Number.isFinite(d) || d <= 0) return [];
  const minSamples = d < 20 ? 10 : 8;
  const targetCount = Math.max(minSamples, Math.min(22, Math.floor(sampleCount)));
  const epsilon = Math.max(0.06, Math.min(0.35, d / 12));
  const start = Math.max(0, epsilon);
  const end = Math.max(start, d - epsilon);
  const anchors = [start, d * 0.25, d * 0.5, d * 0.75, end];
  const times = [];
  for (const t of anchors) {
    if (Number.isFinite(t)) times.push(Math.max(0, Math.min(d, t)));
  }
  if (targetCount <= 1 || end <= start) {
    const center = Math.max(0, Math.min(d, d / 2));
    times.push(center);
  } else {
    for (let i = 0; i < targetCount; i += 1) {
      const ratio = i / (targetCount - 1);
      const t = start + (end - start) * ratio;
      times.push(Math.max(0, Math.min(d, t)));
    }
  }
  const uniqueSorted = Array.from(new Set(times.map((t) => Number(t.toFixed(2))))).sort((a, b) => a - b);
  return uniqueSorted;
}

function inferBadgesFromApi(item) {
  const status = String(item.status || "").trim().toLowerCase();
  const needsReview = Boolean(item.needs_review) || status === "pending_review" || status === "needs_review";
  return {
    needsReviewBadge: needsReview,
    trustworthyBadge: status === "approved" && !needsReview,
  };
}

function toStaffRecord(item, meta = {}) {
  const inferred = inferBadgesFromApi(item);
  const effectiveLabel = item.confirmed_label || item.predicted_label || "طبق غير معروف";
  const rawId = item.id;
  return {
    id: `D-${rawId}`,
    rawId,
    label: effectiveLabel,
    predictedLabel: String(item.predicted_label || ""),
    imageUrl: String(item.image_url || item.image_data_url || ""),
    quantity: typeof item.quantity === "number" ? item.quantity : Number(item.quantity) || 1,
    sourceEntity: String(item.source_entity || ""),
    recordedAt: item.recorded_at,
    dateLine: formatSaudiDateLine(item.recorded_at),
    timeLine: formatSaudiTimeLine(item.recorded_at),
    timeCompact: formatSaudiDateTime(item.recorded_at),
    localPreviewUrl: meta.localPreviewUrl || null,
    needsReviewBadge: meta.needsReviewBadge ?? inferred.needsReviewBadge,
    trustworthyBadge: meta.trustworthyBadge ?? inferred.trustworthyBadge,
    confidenceRatio: meta.confidenceRatio != null ? Number(meta.confidenceRatio) : null,
    reviewStatus: String(item.status || "pending_review"),
    needsReview: Boolean(item.needs_review),
    reviewedByName: String(item.reviewed_by_name || ""),
    reviewedAt: item.reviewed_at || null,
    rejectedReason: String(item.rejected_reason || ""),
    statusText: staffStatusText(String(item.status || ""), Boolean(item.needs_review)),
  };
}

export default function Dashboard() {
  const location = useLocation();
  const committedBlobUrlsRef = useRef(new Set());
  const dishFileInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const staffDocSectionRef = useRef(null);
  const staffSearchSectionRef = useRef(null);
  const staffRecordsSectionRef = useRef(null);
  const supervisorAnalyticsRef = useRef(null);
  const supervisorCamerasRef = useRef(null);
  const supervisorAlertsRef = useRef(null);
  const supervisorReviewsRef = useRef(null);
  const supervisorReportsRef = useRef(null);
  const supervisorEmployeesRef = useRef(null);
  const supervisorSettingsRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState("");
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const [, setCaptureMode] = useState("choice");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState(null);
  const [selectedAlternative, setSelectedAlternative] = useState("");
  const [manualDish, setManualDish] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sourceEntity, setSourceEntity] = useState("");
  const [dishNotice, setDishNotice] = useState(null);
  const toast = useToastStore((s) => s.toast);
  const setToast = useToastStore((s) => s.setToast);
  const clearToast = useToastStore((s) => s.clearToast);
  const [highlightRawId, setHighlightRawId] = useState(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDishType, setFilterDishType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterDateErrors, setFilterDateErrors] = useState({ from: "", to: "" });
  const [filterQtyMin, setFilterQtyMin] = useState("");
  const [filterQtyMax, setFilterQtyMax] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [quickPreset, setQuickPreset] = useState(null);
  const [sortKey, setSortKey] = useState("newest");
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", quantity: 1, source: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [supervisorSummary, setSupervisorSummary] = useState(null);
  const [supervisorSummaryLoading, setSupervisorSummaryLoading] = useState(false);
  const [supervisorEmployees, setSupervisorEmployees] = useState([]);
  const [supervisorEmployeesLoading, setSupervisorEmployeesLoading] = useState(false);
  const [employeeFilters, setEmployeeFilters] = useState({
    search: "",
    role: "",
    activeToday: false,
    hasPendingReviews: false,
  });
  const [reviewRecords, setReviewRecords] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewActionLoadingId, setReviewActionLoadingId] = useState(null);
  const [reviewFilters, setReviewFilters] = useState({
    employee: "",
    dishType: "",
    dateFrom: "",
    dateTo: "",
    confidenceMin: "",
    confidenceMax: "",
    status: "needs_review",
  });
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [editApproveTarget, setEditApproveTarget] = useState(null);
  const [editApproveForm, setEditApproveForm] = useState({ dishName: "", quantity: 1, source: "", notes: "" });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeStaffSection, setActiveStaffSection] = useState(STAFF_SECTION_IDS.doc);
  const [activeSection, setActiveSection] = useState(SUPERVISOR_SECTION_IDS.analytics);
  const [staffMe, setStaffMe] = useState(null);
  const [staffProfileLoading, setStaffProfileLoading] = useState(false);
  const [cameraCards, setCameraCards] = useState([]);
  const [cameraCardsLoading, setCameraCardsLoading] = useState(false);
  const [cameraCardsError, setCameraCardsError] = useState("");
  const [alertsList, setAlertsList] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState("");
  const [cameraTestFile, setCameraTestFile] = useState(null);
  const [cameraTestPreviewUrl, setCameraTestPreviewUrl] = useState("");
  const [cameraAnalyzeMode, setCameraAnalyzeMode] = useState("image");
  const [cameraVideoFile, setCameraVideoFile] = useState(null);
  const [cameraVideoPreviewUrl, setCameraVideoPreviewUrl] = useState("");
  const [cameraVideoDurationSec, setCameraVideoDurationSec] = useState(null);
  const [cameraVideoError, setCameraVideoError] = useState("");
  const [monitoringVideoAnalyzeLoading, setMonitoringVideoAnalyzeLoading] = useState(false);
  const [monitoringVideoProgressText, setMonitoringVideoProgressText] = useState("");
  const [monitoringVideoResults, setMonitoringVideoResults] = useState([]);
  const [monitoringVideoFrameResults, setMonitoringVideoFrameResults] = useState([]);
  const [monitoringVideoAnalyzedTimes, setMonitoringVideoAnalyzedTimes] = useState([]);
  const [monitoringVideoRawViolationCount, setMonitoringVideoRawViolationCount] = useState(0);
  const [monitoringVideoAlertsCreated, setMonitoringVideoAlertsCreated] = useState(0);
  const [newCameraForm, setNewCameraForm] = useState({ name: "", location: "", stream_url: "" });
  const [monitoringAnalysisResult, setMonitoringAnalysisResult] = useState(null);
  const [monitoringAnalyzeLoading, setMonitoringAnalyzeLoading] = useState(false);
  const [monitoringLastAnalyzedAt, setMonitoringLastAnalyzedAt] = useState(null);
  const [monitoringCameraSelectId, setMonitoringCameraSelectId] = useState("");
  const [monitoringResolveLoadingId, setMonitoringResolveLoadingId] = useState(null);
  const [adminSettings, setAdminSettings] = useState(ADMIN_SETTINGS_DEFAULTS);
  const [adminSettingsSaving, setAdminSettingsSaving] = useState(false);
  const [alertsVisibleCount, setAlertsVisibleCount] = useState(ALERTS_PAGE_STEP);
  const [reviewPage, setReviewPage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const [violationsReportFrom, setViolationsReportFrom] = useState("");
  const [violationsReportTo, setViolationsReportTo] = useState("");
  const [violationsReportRows, setViolationsReportRows] = useState([]);
  const [violationsReportLoading, setViolationsReportLoading] = useState(false);
  const [violationsReportError, setViolationsReportError] = useState("");
  const hasPdfExport = false;
  const hasExcelExport = false;
  const { role, getAccessToken, logout, handleProtectedAuthFailure } = useDashboardAuth({ setToast });

  const { handleDetectDish } = useDetectDish({
    accessTokenKey: ACCESS_TOKEN_KEY,
    setDetecting,
    setDishNotice,
    setDetectResult,
    setSelectedAlternative,
    setManualDish,
  });
  const {
    staffRecords,
    staffRecordsLoading,
    staffRecordsLastUpdated,
    staffCount,
    saveLoading,
    editSaving,
    deleteLoading,
    reloadStaffDishes,
    saveDishEntry,
    saveEditedDishRecord,
    confirmDeleteDishRecord,
  } = useDishRecords({
    accessTokenKey: ACCESS_TOKEN_KEY,
    committedBlobUrlsRef,
    toStaffRecord,
    formatSaudiTimeLine,
    dishSaveErrorMessage,
    setToast,
    setDishNotice,
    setHighlightRawId,
    setEditingRecord,
    setDeleteTarget,
  });

  useEffect(() => {
    if (!selectedImage) {
      setSelectedPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(selectedImage);
    setSelectedPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedImage]);

  useEffect(() => {
    if (!cameraTestFile) {
      setCameraTestPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(cameraTestFile);
    setCameraTestPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cameraTestFile]);

  useEffect(() => {
    if (!cameraVideoFile) {
      setCameraVideoPreviewUrl("");
      setCameraVideoDurationSec(null);
      return undefined;
    }
    const url = URL.createObjectURL(cameraVideoFile);
    setCameraVideoPreviewUrl(url);
    setCameraVideoDurationSec(null);
    return () => URL.revokeObjectURL(url);
  }, [cameraVideoFile]);

  useEffect(() => {
    return () => {
      monitoringVideoFrameResults.forEach((item) => {
        if (item?.frameUrl) URL.revokeObjectURL(item.frameUrl);
      });
    };
  }, [monitoringVideoFrameResults]);

  useEffect(() => {
    if (!selectedImage && dishFileInputRef.current) {
      dishFileInputRef.current.value = "";
    }
  }, [selectedImage]);

  useEffect(() => {
    const blobUrlSet = committedBlobUrlsRef.current;
    return () => {
      blobUrlSet.forEach((u) => URL.revokeObjectURL(u));
      blobUrlSet.clear();
    };
  }, [getAccessToken]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => clearToast(), 4200);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setAdminSettings(normalizeAdminSettingsShape(parsed));
    } catch (e) {
      console.warn("[ska] failed to read admin settings from localStorage", e);
    }
  }, []);

  useEffect(() => {
    if (highlightRawId == null) return undefined;
    const t = setTimeout(() => setHighlightRawId(null), 6000);
    return () => clearTimeout(t);
  }, [highlightRawId]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    function closeNav() {
      setMobileNavOpen(false);
    }
    mq.addEventListener("change", closeNav);
    return () => mq.removeEventListener("change", closeNav);
  }, [getAccessToken]);

  useEffect(() => {
    if (role !== "staff") return undefined;
    const fromHash = staffSectionFromHash(window.location.hash);
    if (fromHash) setActiveStaffSection(fromHash);
    const nodes = [
      document.getElementById(STAFF_SECTION_IDS.doc),
      document.getElementById(STAFF_SECTION_IDS.search),
      document.getElementById(STAFF_SECTION_IDS.records),
    ].filter(Boolean);
    if (nodes.length === 0) return undefined;

    const observer = new IntersectionObserver(
      () => {
        let bestId = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const el of nodes) {
          const top = el.getBoundingClientRect().top;
          const dist = Math.abs(top - 120);
          if (dist < bestDist) {
            bestDist = dist;
            bestId = el.id;
          }
        }
        if (bestId) {
          setActiveStaffSection(bestId);
          const wantedHash = `#${bestId}`;
          if (window.location.hash !== wantedHash) {
            window.history.replaceState(null, "", wantedHash);
          }
        }
      },
      { root: null, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );
    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [getAccessToken, handleProtectedAuthFailure, role]);

  useEffect(() => {
    if (!(role === "supervisor" || role === "admin")) return undefined;
    const fromHash = supervisorSectionFromHash(window.location.hash);
    if (fromHash) {
      setActiveSection(fromHash);
    } else {
      setActiveSection(SUPERVISOR_SECTION_IDS.analytics);
      if (!window.location.hash) {
        window.history.replaceState(null, "", "#analytics");
      }
    }
    const nodes = [
      supervisorAnalyticsRef.current,
      supervisorCamerasRef.current,
      supervisorAlertsRef.current,
      supervisorReviewsRef.current,
      supervisorReportsRef.current,
      supervisorEmployeesRef.current,
      supervisorSettingsRef.current,
    ].filter(Boolean);
    if (nodes.length === 0) return undefined;
    const observer = new IntersectionObserver(
      () => {
        let bestId = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const el of nodes) {
          const top = el.getBoundingClientRect().top;
          const dist = Math.abs(top - 120);
          if (dist < bestDist) {
            bestDist = dist;
            bestId = el.id;
          }
        }
        if (bestId) {
          setActiveSection(bestId);
          const wantedHash = `#${bestId}`;
          if (window.location.hash !== wantedHash) window.history.replaceState(null, "", wantedHash);
        }
      },
      { root: null, rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );
    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [getAccessToken, handleProtectedAuthFailure, role]);

  useEffect(() => {
    if (!(role === "supervisor" || role === "admin")) return undefined;
    const syncFromHash = () => {
      const fromHash = supervisorSectionFromHash(window.location.hash);
      if (fromHash) setActiveSection(fromHash);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [role]);

  useEffect(() => {
    if (role !== "staff") return undefined;
    const syncFromHash = () => {
      const fromHash = staffSectionFromHash(window.location.hash);
      if (fromHash) setActiveStaffSection(fromHash);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [role]);

  const loadCurrentStaffUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setStaffMe(null);
      return null;
    }
    setStaffProfileLoading(true);
    try {
      for (const url of CURRENT_USER_ME_URLS) {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        const email = body?.email != null ? String(body.email).trim() : "";
        if (res.ok && email) {
          const normalized = normalizeStaffMeUser(body);
          console.log("[ska] currentUser loaded", {
            url,
            email: normalized.email,
            full_name: normalized.full_name ?? null,
            id: normalized.id,
          });
          setStaffMe(normalized);
          return normalized;
        }
        console.warn("[ska] currentUser fetch not ok", { url, status: res.status, detail: body?.detail });
      }
      setStaffMe(null);
      console.warn("[ska] currentUser: all profile endpoints failed", { tried: CURRENT_USER_ME_URLS });
      return null;
    } catch (e) {
      console.warn("[ska] currentUser fetch error", e);
      setStaffMe(null);
      return null;
    } finally {
      setStaffProfileLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (role !== "staff") {
      return undefined;
    }
    void loadCurrentStaffUser();
    return undefined;
  }, [role, loadCurrentStaffUser]);

  const dishStats = useMemo(() => computeDishStats(staffRecords), [staffRecords]);

  const filtersAreDefault = useMemo(
    () =>
      !filterSearch &&
      !filterDishType &&
      !filterDateFrom &&
      !filterDateTo &&
      !filterQtyMin &&
      !filterQtyMax &&
      filterStatus === "all" &&
      sortKey === "newest",
    [
      filterSearch,
      filterDishType,
      filterDateFrom,
      filterDateTo,
      filterQtyMin,
      filterQtyMax,
      filterStatus,
      sortKey,
    ],
  );

  const displayedRecords = useMemo(
    () =>
      filterAndSortDishRecords(staffRecords, {
        search: filterSearch,
        dishType: filterDishType,
        dateFrom: isValidYmdDate(filterDateFrom) ? filterDateFrom : "",
        dateTo: isValidYmdDate(filterDateTo) ? filterDateTo : "",
        qtyMin: filterQtyMin,
        qtyMax: filterQtyMax,
        status: filterStatus,
        quick: quickPreset,
        sort: sortKey,
      }),
    [
      staffRecords,
      filterSearch,
      filterDishType,
      filterDateFrom,
      filterDateTo,
      filterQtyMin,
      filterQtyMax,
      filterStatus,
      quickPreset,
      sortKey,
    ],
  );

  function resetAllFilters() {
    setFilterSearch("");
    setFilterDishType("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterQtyMin("");
    setFilterQtyMax("");
    setFilterStatus("all");
    setQuickPreset(null);
    setSortKey("newest");
  }

  const dashboardTitle = useMemo(() => {
    if (role === "staff") return "لوحة توثيق الأطباق";
    if (role === "supervisor") return "لوحة مراقبة الجودة والتنبيهات";
    return "لوحة إدارة النظام";
  }, [role]);

  const navLinks = useMemo(() => {
    if (role === "staff") {
      return [
        { href: `#${STAFF_SECTION_IDS.doc}`, label: "توثيق الأطباق", emoji: "📸", sectionId: STAFF_SECTION_IDS.doc },
        { href: `#${STAFF_SECTION_IDS.search}`, label: "البحث والتصفية", emoji: "🔎", sectionId: STAFF_SECTION_IDS.search },
        { href: `#${STAFF_SECTION_IDS.records}`, label: "سجل الأطباق", emoji: "📋", sectionId: STAFF_SECTION_IDS.records },
      ];
    }
    if (role === "supervisor") {
      return [
        { href: "#analytics", label: "التحليلات", sectionId: SUPERVISOR_SECTION_IDS.analytics },
        { href: "#alerts", label: "التنبيهات", sectionId: SUPERVISOR_SECTION_IDS.alerts },
        { href: "#cameras", label: "الكاميرات", sectionId: SUPERVISOR_SECTION_IDS.cameras },
        { href: "#reports", label: "التقارير", sectionId: SUPERVISOR_SECTION_IDS.reports },
        { href: "#dish-reviews", label: "مراجعة الأطباق", sectionId: SUPERVISOR_SECTION_IDS.reviews },
        { href: "#employees", label: "الموظفين", sectionId: SUPERVISOR_SECTION_IDS.employees },
        { href: "#settings", label: "الإعدادات", sectionId: SUPERVISOR_SECTION_IDS.settings },
      ];
    }
    return [
      { href: "#analytics", label: "التحليلات", sectionId: SUPERVISOR_SECTION_IDS.analytics },
      { href: "#alerts", label: "التنبيهات", sectionId: SUPERVISOR_SECTION_IDS.alerts },
      { href: "#cameras", label: "الكاميرات", sectionId: SUPERVISOR_SECTION_IDS.cameras },
      { href: "#reports", label: "التقارير", sectionId: SUPERVISOR_SECTION_IDS.reports },
      { href: "#dish-reviews", label: "مراجعة الأطباق", sectionId: SUPERVISOR_SECTION_IDS.reviews },
      { href: "#employees", label: "الموظفين", sectionId: SUPERVISOR_SECTION_IDS.employees },
      { href: "#settings", label: "الإعدادات", sectionId: SUPERVISOR_SECTION_IDS.settings },
    ];
  }, [role]);

  const saveAdminSettings = useCallback(() => {
    const normalized = normalizeAdminSettingsShape(adminSettings);
    setAdminSettingsSaving(true);
    try {
      localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
      setAdminSettings(normalized);
      setToast({ type: "success", text: "تم حفظ إعدادات النظام محلياً." });
    } catch {
      setToast({ type: "error", text: "تعذر حفظ الإعدادات محلياً." });
    } finally {
      setAdminSettingsSaving(false);
    }
  }, [adminSettings, setToast]);

  const resetAdminSettings = useCallback(() => {
    setAdminSettings(ADMIN_SETTINGS_DEFAULTS);
    try {
      localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(ADMIN_SETTINGS_DEFAULTS));
      setToast({ type: "success", text: "تمت إعادة الإعدادات للوضع الافتراضي." });
    } catch {
      setToast({ type: "error", text: "تعذر إعادة ضبط الإعدادات محلياً." });
    }
  }, [setToast]);

  const reviewFiltersAreActive = useMemo(
    () =>
      reviewFilters.employee.trim() !== "" ||
      reviewFilters.dishType.trim() !== "" ||
      reviewFilters.dateFrom !== "" ||
      reviewFilters.dateTo !== "" ||
      reviewFilters.confidenceMin !== "" ||
      reviewFilters.confidenceMax !== "" ||
      reviewFilters.status !== "needs_review",
    [reviewFilters],
  );

  const employeeFiltersAreActive = useMemo(
    () =>
      employeeFilters.search.trim() !== "" ||
      Boolean(employeeFilters.role) ||
      employeeFilters.activeToday ||
      employeeFilters.hasPendingReviews,
    [employeeFilters],
  );

  const reviewTotalPages = useMemo(
    () => Math.max(1, Math.ceil(reviewRecords.length / REVIEW_PAGE_SIZE)),
    [reviewRecords.length],
  );

  const pagedReviewRecords = useMemo(() => {
    const start = (reviewPage - 1) * REVIEW_PAGE_SIZE;
    return reviewRecords.slice(start, start + REVIEW_PAGE_SIZE);
  }, [reviewRecords, reviewPage]);

  const employeeTotalPages = useMemo(
    () => Math.max(1, Math.ceil(supervisorEmployees.length / EMPLOYEE_PAGE_SIZE)),
    [supervisorEmployees.length],
  );

  const pagedSupervisorEmployees = useMemo(() => {
    const start = (employeePage - 1) * EMPLOYEE_PAGE_SIZE;
    return supervisorEmployees.slice(start, start + EMPLOYEE_PAGE_SIZE);
  }, [supervisorEmployees, employeePage]);

  useEffect(() => {
    const maxP = Math.max(1, Math.ceil(reviewRecords.length / REVIEW_PAGE_SIZE));
    setReviewPage((p) => Math.min(Math.max(1, p), maxP));
  }, [reviewRecords.length]);

  useEffect(() => {
    const maxP = Math.max(1, Math.ceil(supervisorEmployees.length / EMPLOYEE_PAGE_SIZE));
    setEmployeePage((p) => Math.min(Math.max(1, p), maxP));
  }, [supervisorEmployees.length]);

  const exportSupervisorReportCsv = useCallback(() => {
    if (!supervisorSummary) {
      setToast({ type: "error", text: "لا توجد بيانات ملخص للتصدير." });
      return;
    }
    const s = supervisorSummary;
    const val = (v) => (v === undefined || v === null ? "" : v);
    const filename = `ska-supervisor-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadUtf8Csv(
      filename,
      ["المؤشر", "القيمة"],
      [
        ["إجمالي الأطباق", val(s.total_dishes)],
        ["الأطباق هذا الأسبوع", val(s.dishes_week)],
        ["إجمالي الكمية", val(s.total_quantity)],
        ["معلّق للمراجعة", val(s.pending_reviews)],
        ["المعتمد اليوم", val(s.approved_today)],
        ["المرفوض اليوم", val(s.rejected_today)],
        ["إجمالي الموظفين", val(s.total_employees)],
        ["نشط اليوم", val(s.active_employees_today)],
        ["أكثر موظف مراجعات (الاسم)", val(s.top_employee_review_name)],
        ["عدد مراجعاته", val(s.top_employee_review_count)],
        ["أكثر طبق مسجّل", val(s.most_common_dish)],
        ["أكثر طبق يحتاج مراجعة", val(s.most_reviewed_dish)],
        ["متوسط الثقة", val(s.average_confidence)],
        ["مؤشر الجودة", val(s.quality_score ?? s.compliance_rate)],
        ["التنبيهات", val(s.alerts_count)],
        ["المخالفات", val(s.violations_count)],
        ["الأطباق اليوم", val(s.dishes_today ?? s.dishes_count)],
        ["اسم الفرع", val(s.branch_name)],
      ],
    );
    setToast({ type: "success", text: "تم تنزيل تقرير CSV للملخص." });
  }, [supervisorSummary, setToast]);

  const exportReviewRecordsCsv = useCallback(() => {
    if (!reviewRecords.length) {
      setToast({ type: "error", text: "لا توجد سجلات مراجعة للتصدير." });
      return;
    }
    const filename = `ska-dish-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadUtf8Csv(
      filename,
      [
        "id",
        "status",
        "predicted_label",
        "confirmed_label",
        "quantity",
        "employee_name",
        "employee_email",
        "recorded_at",
        "reviewed_at",
        "ai_confidence",
      ],
      reviewRecords.map((r) => [
        r.id,
        r.status,
        r.predicted_label,
        r.confirmed_label,
        r.quantity,
        r.employee_name,
        r.employee_email,
        r.recorded_at,
        r.reviewed_at,
        r.ai_confidence,
      ]),
    );
    setToast({ type: "success", text: "تم تنزيل سجلات المراجعة." });
  }, [reviewRecords, setToast]);

  const violationsReportStats = useMemo(
    () => computeViolationsReportStats(violationsReportRows),
    [violationsReportRows],
  );

  const exportViolationsReportLatestCsv = useCallback(() => {
    const latest = violationsReportStats.latest;
    if (!latest.length) {
      setToast({ type: "error", text: "لا توجد صفوف في جدول أحدث المخالفات للتصدير." });
      return;
    }
    downloadUtf8Csv(
      `ska-violations-latest-${new Date().toISOString().slice(0, 10)}.csv`,
      ["النوع", "التفاصيل", "الحالة", "الفرع", "الكاميرا", "الوقت"],
      latest.map((row) => [
        violationReportTypeLabel(row.type) || row.label_ar || row.type || "—",
        String(row.details || "—")
          .replace(/\s+/g, " ")
          .trim(),
        monitoringAlertStatusAr(row.status),
        row.branch || "—",
        row.camera_name || "—",
        formatSaudiDateTime(row.created_at),
      ]),
    );
    setToast({ type: "success", text: "تم تنزيل CSV لأحدث المخالفات." });
  }, [violationsReportStats.latest, setToast]);

  const printViolationsReportPdf = useCallback(() => {
    if (!violationsReportStats.total) {
      setToast({ type: "error", text: "لا يوجد تقرير للطباعة أو التصدير." });
      return;
    }
    const el = document.getElementById("ska-violations-report-print");
    if (!el || !el.querySelector("tbody tr")) {
      setToast({ type: "error", text: "تعذر تجهيز صفحة التقرير." });
      return;
    }
    setTimeout(() => window.print(), 100);
  }, [violationsReportStats.total, setToast]);

  const supervisorCards = useMemo(
    () => {
      const loading = supervisorSummaryLoading;
      const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      const qualityScore = numOrNull(supervisorSummary?.quality_score ?? supervisorSummary?.compliance_rate);
      const alertsCount = numOrNull(supervisorSummary?.alerts_count);
      const violationsCount = numOrNull(supervisorSummary?.violations_count);
      const dishesCount = numOrNull(supervisorSummary?.dishes_count ?? supervisorSummary?.dishes_today);
      const valueText = (n) => (loading ? "..." : n == null ? "غير متوفر" : String(n));
      const valueClass = (n, isAlert = false) => {
        if (loading) return "text-white";
        if (n == null) return "text-slate-500";
        if (isAlert && n >= 10) return "text-red-300";
        if (n === 0) return "text-slate-400";
        return "text-white";
      };
      return [
      {
        label: "مؤشر الجودة",
        value: valueText(qualityScore),
        valueClass: valueClass(qualityScore),
        icon: IconChart,
        glow: "from-brand-sky/10",
      },
      {
        label: "عدد التنبيهات",
        value: valueText(alertsCount),
        valueClass: valueClass(alertsCount, true),
        icon: IconActivity,
        glow: "from-accent-amber/10",
      },
      {
        label: "عدد المخالفات",
        value: valueText(violationsCount),
        valueClass: valueClass(violationsCount),
        icon: IconBell,
        glow: "from-accent-red/10",
      },
      {
        label: "عدد الأطباق",
        value: valueText(dishesCount),
        valueClass: valueClass(dishesCount),
        icon: IconDish,
        glow: "from-accent-green/10",
      },
      ];
    },
    [supervisorSummary, supervisorSummaryLoading],
  );

  const hasMonitoringData =
    Number(supervisorSummary?.dishes_today || 0) > 0 || Number(supervisorSummary?.violations_count || 0) > 0;
  const supervisorHeaderStats = useMemo(
    () => [
      { label: "الدور", value: role === "admin" ? "مدير النظام" : role === "supervisor" ? "مشرف" : "—" },
      { label: "القسم الحالي", value: navLinks.find((n) => n.sectionId === activeSection)?.label || "التحليلات" },
      { label: "التنبيهات", value: alertsLoading ? "..." : String(alertsList.length) },
      { label: "الكاميرات", value: cameraCardsLoading ? "..." : String(cameraCards.length) },
      { label: "طلبات المراجعة", value: reviewLoading ? "..." : String(reviewRecords.length) },
      {
        label: "آخر تحليل",
        value: monitoringLastAnalyzedAt ? formatSaudiDateTime(monitoringLastAnalyzedAt) : "غير متوفر",
      },
    ],
    [activeSection, alertsList.length, alertsLoading, cameraCards.length, cameraCardsLoading, monitoringLastAnalyzedAt, navLinks, reviewLoading, reviewRecords.length, role]
  );

  const loadSupervisorSummary = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = getAccessToken();
    if (!token) return;
    setSupervisorSummaryLoading(true);
    try {
      const res = await fetch(SUPERVISOR_SUMMARY_URL, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (handleProtectedAuthFailure(res.status, body?.detail)) {
        setSupervisorSummary(null);
        return;
      }
      if (!res.ok || !body || typeof body !== "object") {
        setSupervisorSummary(null);
        return;
      }
      setSupervisorSummary(body);
    } finally {
      setSupervisorSummaryLoading(false);
    }
  }, [getAccessToken, handleProtectedAuthFailure, role]);

  const loadSupervisorEmployees = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = getAccessToken();
    if (!token) return;
    setSupervisorEmployeesLoading(true);
    try {
      const qp = new URLSearchParams();
      if (employeeFilters.search.trim()) qp.set("search", employeeFilters.search.trim());
      if (employeeFilters.role) qp.set("role", employeeFilters.role);
      if (employeeFilters.activeToday) qp.set("active_today", "true");
      if (employeeFilters.hasPendingReviews) qp.set("has_pending_reviews", "true");
      const res = await fetch(`${SUPERVISOR_EMPLOYEES_URL}?${qp.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => []);
      if (handleProtectedAuthFailure(res.status, body?.detail)) {
        setSupervisorEmployees([]);
        return;
      }
      if (!res.ok || !Array.isArray(body)) {
        setSupervisorEmployees([]);
        return;
      }
      setSupervisorEmployees(body);
    } finally {
      setSupervisorEmployeesLoading(false);
    }
  }, [employeeFilters, getAccessToken, handleProtectedAuthFailure, role]);

  const loadSupervisorReviews = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = getAccessToken();
    if (!token) return;
    setReviewLoading(true);
    try {
      const qp = new URLSearchParams();
      if (reviewFilters.employee.trim()) qp.set("employee", reviewFilters.employee.trim());
      if (reviewFilters.dishType.trim()) qp.set("dish_type", reviewFilters.dishType.trim());
      if (reviewFilters.dateFrom) qp.set("date_from", `${reviewFilters.dateFrom}T00:00:00Z`);
      if (reviewFilters.dateTo) qp.set("date_to", `${reviewFilters.dateTo}T23:59:59Z`);
      if (reviewFilters.confidenceMin !== "") qp.set("confidence_min", String(reviewFilters.confidenceMin));
      if (reviewFilters.confidenceMax !== "") qp.set("confidence_max", String(reviewFilters.confidenceMax));
      if (reviewFilters.status) qp.set("status_filter", reviewFilters.status);
      const u = `${SUPERVISOR_REVIEWS_URL}?${qp.toString()}`;
      const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => []);
      if (handleProtectedAuthFailure(res.status, data?.detail)) return;
      if (!res.ok || !Array.isArray(data)) {
        setToast({ type: "error", text: protectedApiErrorText(res.status, data?.detail) || "تعذر تحميل سجلات المراجعة." });
        return;
      }
      const rank = (status) => {
        if (status === "pending_review" || status === "needs_review") return 0;
        if (status === "approved") return 1;
        if (status === "rejected") return 2;
        return 3;
      };
      const sorted = [...data].sort((a, b) => {
        const ra = rank(a?.status);
        const rb = rank(b?.status);
        if (ra !== rb) return ra - rb;
        return new Date(b?.recorded_at || 0).getTime() - new Date(a?.recorded_at || 0).getTime();
      });
      setReviewRecords(sorted);
    } catch {
      setToast({ type: "error", text: "تعذر تحميل سجلات المراجعة." });
    } finally {
      setReviewLoading(false);
    }
  }, [getAccessToken, handleProtectedAuthFailure, reviewFilters, role, setToast]);

  const loadSupervisorCameras = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = getAccessToken();
    if (!token) return;
    setCameraCardsLoading(true);
    setCameraCardsError("");
    try {
      const res = await fetch(SUPERVISOR_CAMERAS_URL, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => []);
      if (handleProtectedAuthFailure(res.status, body?.detail)) {
        setCameraCards([]);
        return;
      }
      if (!res.ok || !Array.isArray(body)) {
        setCameraCardsError("تعذر تحميل بيانات الكاميرات.");
        setCameraCards([]);
        return;
      }
      setCameraCards(body);
    } catch {
      setCameraCards([]);
      setCameraCardsError("تعذر تحميل بيانات الكاميرات.");
    } finally {
      setCameraCardsLoading(false);
    }
  }, [getAccessToken, handleProtectedAuthFailure, role]);

  const loadSupervisorAlerts = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = getAccessToken();
    if (!token) return;
    setAlertsLoading(true);
    setAlertsError("");
    try {
      const res = await fetch(SUPERVISOR_ALERTS_URL, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => []);
      if (handleProtectedAuthFailure(res.status, body?.detail)) {
        setAlertsList([]);
        return;
      }
      if (!res.ok || !Array.isArray(body)) {
        setAlertsError("تعذر تحميل التنبيهات.");
        setAlertsList([]);
        return;
      }
      setAlertsList(body);
    } catch {
      setAlertsError("تعذر تحميل التنبيهات.");
      setAlertsList([]);
    } finally {
      setAlertsLoading(false);
    }
  }, [getAccessToken, handleProtectedAuthFailure, role]);

  const fetchViolationsReport = useCallback(
    async (fromStr, toStr) => {
      if (role !== "admin") return;
      const token = getAccessToken();
      if (!token) return;
      const from = String(fromStr || "").trim();
      const to = String(toStr || "").trim();
      if (from && to && from > to) {
        setViolationsReportError("تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.");
        setViolationsReportRows([]);
        return;
      }
      setViolationsReportLoading(true);
      setViolationsReportError("");
      try {
        const qp = new URLSearchParams();
        qp.set("limit", "500");
        if (from && isValidYmdDate(from)) qp.set("date_from", from);
        if (to && isValidYmdDate(to)) qp.set("date_to", to);
        const res = await fetch(`${SUPERVISOR_ALERTS_URL}?${qp}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => []);
        if (handleProtectedAuthFailure(res.status, body?.detail)) {
          setViolationsReportRows([]);
          return;
        }
        if (!res.ok || !Array.isArray(body)) {
          setViolationsReportError(
            protectedApiErrorText(res.status, body?.detail) || "تعذر تحميل بيانات المخالفات.",
          );
          setViolationsReportRows([]);
          return;
        }
        setViolationsReportRows(body);
      } catch {
        setViolationsReportError("تعذر تحميل بيانات المخالفات.");
        setViolationsReportRows([]);
      } finally {
        setViolationsReportLoading(false);
      }
    },
    [getAccessToken, handleProtectedAuthFailure, role],
  );

  useEffect(() => {
    if (location.pathname !== "/monitoring") return;
    if (!(role === "supervisor" || role === "admin")) return;
    setActiveSection(SUPERVISOR_SECTION_IDS.cameras);
    if (typeof window !== "undefined" && window.location.hash !== "#cameras") {
      window.location.hash = "#cameras";
    }
  }, [location.pathname, role]);

  useEffect(() => {
    if (!(role === "supervisor" || role === "admin")) return;
    void loadSupervisorReviews();
  }, [role, loadSupervisorReviews]);

  useEffect(() => {
    if (!(role === "supervisor" || role === "admin")) return;
    void loadSupervisorSummary();
  }, [role, loadSupervisorSummary]);

  useEffect(() => {
    if (!(role === "supervisor" || role === "admin")) return;
    void loadSupervisorEmployees();
  }, [role, loadSupervisorEmployees]);

  useEffect(() => {
    if (!(role === "supervisor" || role === "admin")) return;
    void loadSupervisorCameras();
    void loadSupervisorAlerts();
  }, [role, loadSupervisorCameras, loadSupervisorAlerts]);

  useEffect(() => {
    setAlertsVisibleCount(ALERTS_PAGE_STEP);
  }, [alertsList.length]);

  useEffect(() => {
    setReviewPage(1);
  }, [
    reviewFilters.employee,
    reviewFilters.dishType,
    reviewFilters.dateFrom,
    reviewFilters.dateTo,
    reviewFilters.confidenceMin,
    reviewFilters.confidenceMax,
    reviewFilters.status,
  ]);

  useEffect(() => {
    setEmployeePage(1);
  }, [employeeFilters.search, employeeFilters.role, employeeFilters.activeToday, employeeFilters.hasPendingReviews]);

  useEffect(() => {
    if (role !== "admin") {
      setViolationsReportRows([]);
      setViolationsReportError("");
      return undefined;
    }
    void fetchViolationsReport("", "");
    return undefined;
  }, [role, fetchViolationsReport]);

  async function approveReviewRecord(record) {
    const token = getAccessToken();
    if (!token) return;
    setReviewActionLoadingId(record.id);
    try {
      const res = await fetch(`${SUPERVISOR_REVIEWS_URL}/${record.id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "error", text: body?.detail || "تعذر اعتماد السجل." });
        return;
      }
      setToast({ type: "success", text: "تم اعتماد السجل." });
      window.dispatchEvent(new CustomEvent(DISH_REVIEW_UPDATED_EVENT, { detail: { id: record.id, status: "approved" } }));
      await loadSupervisorReviews();
      await loadSupervisorSummary();
      await loadSupervisorEmployees();
    } catch {
      setToast({ type: "error", text: "تعذر اعتماد السجل." });
    } finally {
      setReviewActionLoadingId(null);
    }
  }

  async function confirmRejectReviewRecord() {
    if (!rejectTarget || !rejectReason.trim()) return;
    const token = getAccessToken();
    if (!token) return;
    setReviewActionLoadingId(rejectTarget.id);
    try {
      const res = await fetch(`${SUPERVISOR_REVIEWS_URL}/${rejectTarget.id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectReason.trim(), supervisor_notes: rejectNotes.trim() || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "error", text: body?.detail || "تعذر رفض السجل." });
        return;
      }
      setToast({ type: "success", text: "تم رفض السجل." });
      window.dispatchEvent(
        new CustomEvent(DISH_REVIEW_UPDATED_EVENT, { detail: { id: rejectTarget.id, status: "rejected" } }),
      );
      setRejectTarget(null);
      setRejectReason("");
      setRejectNotes("");
      await loadSupervisorReviews();
      await loadSupervisorSummary();
      await loadSupervisorEmployees();
    } catch {
      setToast({ type: "error", text: "تعذر رفض السجل." });
    } finally {
      setReviewActionLoadingId(null);
    }
  }

  async function submitEditApproveReviewRecord() {
    if (!editApproveTarget || !editApproveForm.dishName.trim()) return;
    const token = getAccessToken();
    if (!token) return;
    setReviewActionLoadingId(editApproveTarget.id);
    try {
      const res = await fetch(`${SUPERVISOR_REVIEWS_URL}/${editApproveTarget.id}/edit-approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dish_name: editApproveForm.dishName.trim(),
          quantity: Number(editApproveForm.quantity) || 1,
          source: editApproveForm.source.trim() || "غير محدد",
          notes: editApproveForm.notes.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "error", text: body?.detail || "تعذر تعديل واعتماد السجل." });
        return;
      }
      setToast({ type: "success", text: "تم تعديل السجل واعتماده." });
      window.dispatchEvent(
        new CustomEvent(DISH_REVIEW_UPDATED_EVENT, { detail: { id: editApproveTarget.id, status: "approved" } }),
      );
      setEditApproveTarget(null);
      await loadSupervisorReviews();
      await loadSupervisorSummary();
      await loadSupervisorEmployees();
    } catch {
      setToast({ type: "error", text: "تعذر تعديل واعتماد السجل." });
    } finally {
      setReviewActionLoadingId(null);
    }
  }

  // Shared fetch helper used by both image upload and video frame analysis.
  // Builds FormData with the exact same keys the backend expects, POSTs to
  // MONITORING_ANALYZE_URL, and returns { ok, status, body } — no side effects.
  async function callAnalyzeFrameEndpoint(imageFile, token) {
    const fd = new FormData();
    fd.append("image", imageFile);
    if (monitoringCameraSelectId) {
      const idNum = Number(monitoringCameraSelectId);
      if (Number.isFinite(idNum)) fd.append("camera_id", String(idNum));
    }
    const sel = cameraCards.find((c) => String(c.id) === String(monitoringCameraSelectId));
    const name = (newCameraForm.name || "").trim() || (sel?.name || "").trim();
    const loc = (newCameraForm.location || "").trim() || (sel?.location || "").trim();
    if (name) fd.append("camera_name", name);
    if (loc) fd.append("location", loc);
    const res = await fetch(MONITORING_ANALYZE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }

  async function analyzeMonitoringFrameUpload() {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = getAccessToken();
    if (!token || !cameraTestFile) {
      setToast({ type: "error", text: "يرجى اختيار صورة للتحليل." });
      return;
    }
    setMonitoringAnalyzeLoading(true);
    try {
      const { ok, status, body } = await callAnalyzeFrameEndpoint(cameraTestFile, token);
      if (handleProtectedAuthFailure(status, body?.detail)) return;
      if (!ok) {
        console.error("[monitoring] analyze-frame failed", { status, detail: body?.detail, url: MONITORING_ANALYZE_URL });
        const errDetail = typeof body?.detail === "string" && body.detail.trim() ? body.detail : null;
        if (status === 503) {
          setToast({ type: "error", text: errDetail || "تعذر تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي أو فعّل وضع التجريبي." });
        } else if (status === 400) {
          setToast({ type: "error", text: errDetail || "الصورة غير صالحة." });
        } else {
          setToast({ type: "error", text: errDetail || "فشل تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي." });
        }
        return;
      }
      setMonitoringAnalysisResult(body);
      setMonitoringLastAnalyzedAt(new Date().toISOString());
      if (Number(body?.alerts_created) > 0) {
        setToast({ type: "success", text: "تم تسجيل مخالفة" });
      }
      await loadSupervisorAlerts();
      await loadSupervisorCameras();
      await loadSupervisorSummary();
    } catch (err) {
      console.error("[monitoring] analyzeMonitoringFrameUpload exception:", err);
      setToast({ type: "error", text: "فشل تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي." });
    } finally {
      setMonitoringAnalyzeLoading(false);
    }
  }

  function onSelectMonitoringVideoFile(file) {
    if (!file) {
      setCameraVideoFile(null);
      setCameraVideoError("");
      setMonitoringVideoResults([]);
      setMonitoringVideoFrameResults([]);
      setMonitoringVideoAnalyzedTimes([]);
      setMonitoringVideoRawViolationCount(0);
      setMonitoringVideoAlertsCreated(0);
      return;
    }
    if (!String(file.type || "").startsWith("video/")) {
      setCameraVideoFile(null);
      setCameraVideoError("الملف المحدد ليس فيديو صالحاً. الرجاء اختيار ملف mp4 أو mov أو webm.");
      return;
    }
    setCameraVideoError("");
    setCameraVideoFile(file);
    setMonitoringVideoResults([]);
    setMonitoringVideoFrameResults([]);
    setMonitoringVideoAnalyzedTimes([]);
    setMonitoringVideoRawViolationCount(0);
    setMonitoringVideoAlertsCreated(0);
  }

  function extractFrameBlobAt(videoEl, atSecond) {
    return new Promise((resolve, reject) => {
      const onSeeked = () => {
        videoEl.removeEventListener("seeked", onSeeked);
        const canvas = document.createElement("canvas");
        canvas.width = videoEl.videoWidth || 1280;
        canvas.height = videoEl.videoHeight || 720;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("ctx_failed"));
          return;
        }
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("blob_failed"));
            return;
          }
          resolve(blob);
        }, "image/jpeg", 0.9);
      };
      videoEl.addEventListener("seeked", onSeeked, { once: true });
      videoEl.currentTime = Math.max(0, atSecond);
    });
  }

  async function analyzeMonitoringVideoUpload() {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = getAccessToken();
    if (!token || !cameraVideoFile) {
      setToast({ type: "error", text: "يرجى اختيار فيديو للتحليل." });
      return;
    }
    setMonitoringVideoAnalyzeLoading(true);
    setMonitoringVideoProgressText("جاري تجهيز الفيديو...");
    setMonitoringVideoResults([]);
    setMonitoringVideoFrameResults([]);
    setMonitoringVideoAnalyzedTimes([]);
    setMonitoringVideoRawViolationCount(0);
    setMonitoringVideoAlertsCreated(0);
    try {
      const url = URL.createObjectURL(cameraVideoFile);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.src = url;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("video_metadata_failed"));
      });
      const duration = Number(video.duration);
      const times = makeVideoFrameTimes(duration, 14);
      if (!times.length) {
        setToast({ type: "error", text: "تعذر قراءة مدة الفيديو للتحليل." });
        URL.revokeObjectURL(url);
        return;
      }
      const frameRows = [];
      const bestByType = new Map();
      let rawViolationCount = 0;
      let alertsCreated = 0;
      let apiErrorShown = false;
      for (let i = 0; i < times.length; i += 1) {
        const t = times[i];
        setMonitoringVideoProgressText(`جاري تحليل الفيديو... (${i + 1}/${times.length})`);
        const frameBlob = await extractFrameBlobAt(video, t);
        const frameUrl = URL.createObjectURL(frameBlob);
        const frameFile = new File([frameBlob], `video-frame-${Math.round(t * 1000)}.jpg`, { type: "image/jpeg" });
        // Use the same endpoint/FormData/auth as the working single-image upload.
        const { ok, status, body } = await callAnalyzeFrameEndpoint(frameFile, token);
        if (handleProtectedAuthFailure(status, body?.detail)) {
          URL.revokeObjectURL(url);
          return;
        }
        if (!ok) {
          console.error("[monitoring] video frame failed", { frame: i, atSecond: t, status, detail: body?.detail });
          if (!apiErrorShown) {
            apiErrorShown = true;
            const errDetail = typeof body?.detail === "string" && body.detail.trim() ? body.detail : null;
            setToast({ type: "error", text: errDetail || "تعذر تحليل بعض اللقطات. تحقق من إعدادات الذكاء الاصطناعي." });
          }
          frameRows.push({
            id: `frame-${i}`,
            atSecond: t,
            frameUrl,
            violations: [],
            errorText: typeof body?.detail === "string" && body.detail.trim() ? body.detail : "تعذر تحليل هذه اللقطة",
          });
          continue;
        }
        alertsCreated += Number(body?.alerts_created || 0);
        const violations = Array.isArray(body?.violations) ? body.violations : [];
        rawViolationCount += violations.length;
        const normalized = violations.map((v, idx) => ({
          id: `${i}-${idx}-${v?.type || "x"}`,
          atSecond: t,
          type: v?.label_ar || v?.type || "غير محدد",
          typeKey: String(v?.type || v?.label_ar || `unknown-${idx}`).trim().toLowerCase(),
          confidence: Number(v?.confidence || 0),
          status: v?.status || "open",
          reason: v?.reason_ar || "",
          frameId: `frame-${i}`,
        }));
        frameRows.push({
          id: `frame-${i}`,
          atSecond: t,
          frameUrl,
          violations: normalized,
          errorText: "",
        });
        normalized.forEach((v) => {
          const prev = bestByType.get(v.typeKey);
          if (!prev || Number(v.confidence || 0) > Number(prev.confidence || 0)) {
            bestByType.set(v.typeKey, v);
          }
        });
      }
      URL.revokeObjectURL(url);
      const aggregated = Array.from(bestByType.values()).sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
      setMonitoringVideoFrameResults(frameRows);
      setMonitoringVideoAnalyzedTimes(times);
      setMonitoringVideoRawViolationCount(rawViolationCount);
      setMonitoringVideoResults(aggregated);
      setMonitoringVideoAlertsCreated(alertsCreated);
      setMonitoringLastAnalyzedAt(new Date().toISOString());
      if (!apiErrorShown) {
        if (alertsCreated > 0) {
          setToast({ type: "success", text: `تم تسجيل ${alertsCreated} مخالفة من تحليل الفيديو.` });
        } else if (aggregated.length > 0) {
          setToast({ type: "success", text: "تم تحليل الفيديو وعرض المخالفات المكتشفة." });
        } else {
          setToast({ type: "success", text: "تم تحليل اللقطات ولم يتم اكتشاف مخالفات." });
        }
      }
      await loadSupervisorAlerts();
      await loadSupervisorCameras();
      await loadSupervisorSummary();
    } catch (err) {
      console.error("[monitoring] analyzeMonitoringVideoUpload exception:", err);
      setToast({ type: "error", text: "تعذر تحليل الفيديو حالياً." });
    } finally {
      setMonitoringVideoAnalyzeLoading(false);
      setMonitoringVideoProgressText("");
    }
  }

  async function resolveMonitoringAlert(alertId) {
    const token = getAccessToken();
    if (!token) return;
    setMonitoringResolveLoadingId(alertId);
    try {
      const res = await fetch(`${SUPERVISOR_ALERTS_URL}/${alertId}/resolve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "error", text: body?.detail ? String(body.detail) : "تعذر تحديث التنبيه." });
        return;
      }
      await loadSupervisorAlerts();
      await loadSupervisorSummary();
    } catch {
      setToast({ type: "error", text: "تعذر تحديث التنبيه." });
    } finally {
      setMonitoringResolveLoadingId(null);
    }
  }

  async function addSupervisorCamera() {
    const token = getAccessToken();
    if (!token || !newCameraForm.name.trim() || !newCameraForm.location.trim()) return;
    try {
      const res = await fetch(SUPERVISOR_CAMERAS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newCameraForm.name.trim(),
          location: newCameraForm.location.trim(),
          stream_url: newCameraForm.stream_url.trim() || null,
          is_connected: true,
          ai_enabled: true,
        }),
      });
      if (!res.ok) {
        setToast({ type: "error", text: "تعذر إضافة الكاميرا." });
        return;
      }
      setNewCameraForm({ name: "", location: "", stream_url: "" });
      setToast({ type: "success", text: "تمت إضافة الكاميرا." });
      await loadSupervisorCameras();
    } catch {
      setToast({ type: "error", text: "تعذر إضافة الكاميرا." });
    }
  }

  useEffect(() => {
    if (role !== "staff") return;
    void reloadStaffDishes();
  }, [role, reloadStaffDishes]);

  useEffect(() => {
    if (role !== "staff") return undefined;
    const onReviewUpdated = () => {
      void reloadStaffDishes();
    };
    window.addEventListener(DISH_REVIEW_UPDATED_EVENT, onReviewUpdated);
    return () => window.removeEventListener(DISH_REVIEW_UPDATED_EVENT, onReviewUpdated);
  }, [role, reloadStaffDishes]);

  const stopCameraStream = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => () => stopCameraStream(), [stopCameraStream]);

  async function startCameraPreview() {
    if (cameraLoading) return;
    setCameraError("");
    setCaptureMode("camera");
    setCameraLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("camera_unsupported");
      }
      stopCameraStream();
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError("تم رفض إذن الكاميرا. اسمح بالوصول للكاميرا ثم أعد المحاولة.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraError("لم يتم العثور على كاميرا متاحة على هذا الجهاز.");
      } else {
        setCameraError("تعذر تشغيل الكاميرا حاليًا.");
      }
    } finally {
      setCameraLoading(false);
    }
  }

  function closeCaptureModal() {
    setCaptureModalOpen(false);
    setCaptureMode("choice");
    setCameraError("");
    setCameraLoading(false);
    stopCameraStream();
  }

  function openCaptureModal() {
    setCaptureModalOpen(true);
    setCaptureMode("camera");
    setCameraError("");
    void startCameraPreview();
  }

  async function captureFromCamera() {
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth < 2 || video.videoHeight < 2) {
      setCameraError("الكاميرا غير جاهزة بعد. انتظر لحظة ثم أعد الالتقاط.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("تعذر معالجة الصورة الملتقطة.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setCameraError("فشل التقاط الصورة. حاول مرة أخرى.");
      return;
    }
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    setSelectedImage(file);
    closeCaptureModal();
    void handleDetectDish(file);
  }

  async function submitDishRecord() {
    if (!selectedImage) {
      setDishNotice({ type: "error", text: "يرجى رفع صورة أولًا." });
      return;
    }
    if (detectResult?.proteinConflict) {
      const pick = manualDish.trim() || selectedAlternative.trim();
      if (!pick) {
        setDishNotice({
          type: "error",
          text: "يوجد تعارض بين الاقتراحات. اختر أحد الخيارات أو اكتب اسم الطبق يدويًا قبل الحفظ.",
        });
        return;
      }
    }
    const confirmed =
      manualDish.trim() ||
      selectedAlternative ||
      (detectResult?.proteinConflict ? "" : detectResult?.detected) ||
      "";
    if (!confirmed.trim()) {
      setDishNotice({
        type: "error",
        text: detectResult
          ? "أدخل اسم الطبق أو اختر أحد الاقتراحات قبل الحفظ."
          : "اكتب اسم الطبق في الحقل أدناه (التعرف التلقائي غير متاح أو لم يكتمل بعد).",
      });
      return;
    }
    let imageDataUrl;
    try {
      imageDataUrl = await readImageFileAsDataURL(selectedImage);
    } catch {
      setDishNotice({ type: "error", text: "تعذر قراءة ملف الصورة. أعد المحاولة." });
      return;
    }
    if (imageDataUrl.length > DISH_IMAGE_DATA_URL_MAX_CHARS) {
      setDishNotice({
        type: "error",
        text: "صورة الطبق كبيرة جدًا. جرّب صورة أصغر أو أقل دقة ثم احفظ مجددًا.",
      });
      return;
    }
    const predictedFromAi =
      detectResult?.suggestions?.[0]?.name ||
      detectResult?.detected ||
      manualDish.trim() ||
      "طبق غير معروف";
    await saveDishEntry({
      imageDataUrl,
      predictedFromAi,
      confirmed,
      quantityValue: positiveIntQuantity(quantity),
      sourceEntity,
      staffMe,
      onSaved: () => {
        setSelectedImage(null);
        setDetectResult(null);
        setSelectedAlternative("");
        setManualDish("");
        setQuantity(1);
        setSourceEntity("");
      },
      onNetworkError: (err) => {
        console.error("[dish save] network or parse error", err);
        setDishNotice({
          type: "error",
          text: "تعذر الاتصال بالخادم أو قراءة الاستجابة. تحقق من تشغيل الـ backend والشبكة.",
        });
      },
    });
  }

  function openEditRecord(record) {
    if (record?.reviewStatus === "approved") return;
    setEditingRecord(record);
    setEditForm({
      label: record.label,
      quantity: record.quantity,
      source: record.sourceEntity || "",
    });
  }

  async function saveEditedRecord() {
    await saveEditedDishRecord({
      editingRecord,
      editForm,
      quantityValue: positiveIntQuantity(editForm.quantity),
    });
  }

  async function confirmDeleteRecord(recordOverride) {
    await confirmDeleteDishRecord({ recordOverride, deleteTarget });
  }

  const videoAllFramesFailed =
    monitoringVideoFrameResults.length > 0 &&
    monitoringVideoFrameResults.every((f) => Boolean(f.errorText));

  return (
    <div className="min-h-screen bg-surface text-slate-100" dir="rtl">
      {role === "admin" ? (
        <style>
          {`
@media print {
  html, body {
    background: #ffffff !important;
  }
  .ska-dashboard-no-print {
    display: none !important;
  }
  #ska-violations-report-print {
    display: block !important;
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: 100% !important;
    max-width: 100% !important;
    min-height: auto !important;
    box-sizing: border-box !important;
    background: #ffffff !important;
    color: #000000 !important;
    direction: rtl !important;
    padding: 10mm !important;
    overflow: visible !important;
    z-index: auto !important;
    font-family: system-ui, "Segoe UI", Tahoma, Arial, sans-serif !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #ska-violations-report-print * {
    color: #000000 !important;
  }
  #ska-violations-report-print table th {
    background: #f1f5f9 !important;
  }
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
}
`}
        </style>
      ) : null}
      <div className="ska-dashboard-no-print">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(37,99,235,0.12),transparent)]" />

      <DashboardNav
        role={role}
        navLinks={navLinks}
        activeStaffSection={activeStaffSection}
        activeSection={activeSection}
        currentHash={location.hash || ""}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        logout={logout}
        dashboardTitle={dashboardTitle}
      />

      <main id="home" className="relative z-10 mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {role === "staff" ? (
          <section className={`${glassCard} mb-6 select-none p-4 sm:mb-8 sm:p-6 lg:p-8`}>
            <StaffProfileCard staffProfileLoading={staffProfileLoading} staffMe={staffMe} />
          </section>
        ) : (
          <section className={`${glassCard} mb-6 p-4 sm:mb-8 sm:p-6 lg:p-8`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-sky">نظرة تحليلية</p>
                <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{dashboardTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  متابعة الجودة، تسجيل المخالفات، وعرض التنبيهات في منصة واحدة
                </p>
                {(role === "supervisor" || role === "admin") && !supervisorSummaryLoading ? (
                  <p className="mt-2 text-sm text-slate-300">
                    {role === "admin" ? (
                      "النطاق: جميع الفروع"
                    ) : (
                      <>الفرع: {supervisorSummary?.branch_name || "—"}</>
                    )}
                  </p>
                ) : null}
              </div>
              {!supervisorSummaryLoading && supervisorSummary && !hasMonitoringData ? (
                <span className="inline-flex w-fit max-w-[min(100%,20rem)] items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-400">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />
                  لا يوجد نشاط مسجّل بعد في مؤشرات المراقبة (صفر أطباق اليوم ومخالفات).
                </span>
              ) : null}
            </div>
          </section>
        )}

        {role === "staff" ? (
          <section id="dish-docs" className="grid gap-10 lg:gap-12">
            <div
              id={STAFF_SECTION_IDS.doc}
              ref={staffDocSectionRef}
              className="scroll-mt-28 sm:scroll-mt-32 lg:scroll-mt-36"
            >
            <DishDocSection
              staffCount={staffCount}
              selectedImage={selectedImage}
              selectedPreviewUrl={selectedPreviewUrl}
              detecting={detecting}
              detectResult={detectResult}
              manualDish={manualDish}
              setManualDish={setManualDish}
              selectedAlternative={selectedAlternative}
              setSelectedAlternative={setSelectedAlternative}
              quantity={quantity}
              setQuantity={setQuantity}
              sourceEntity={sourceEntity}
              setSourceEntity={setSourceEntity}
              saveLoading={saveLoading}
              dishNotice={dishNotice}
              captureModalOpen={captureModalOpen}
              videoRef={cameraVideoRef}
              cameraLoading={cameraLoading}
              cameraError={cameraError}
              dishFileInputRef={dishFileInputRef}
              onOpenCapture={openCaptureModal}
              onCloseCapture={closeCaptureModal}
              onCapturePhoto={() => void captureFromCamera()}
              onFileSelected={(file) => {
                setSelectedImage(file);
                closeCaptureModal();
                void handleDetectDish(file);
              }}
              onRetakeImage={() => {
                setSelectedImage(null);
                setDetectResult(null);
                setManualDish("");
                setSelectedAlternative("");
                setDishNotice(null);
              }}
              onDetectDish={handleDetectDish}
              onSave={submitDishRecord}
            />
            </div>

            <div
              id={STAFF_SECTION_IDS.search}
              ref={staffSearchSectionRef}
              className="scroll-mt-28 sm:scroll-mt-32 lg:scroll-mt-36"
            >
            <article className={`${glassCard} space-y-5 p-4 sm:p-6`}>
              <DishFilters
                filterSearch={filterSearch}
                setFilterSearch={setFilterSearch}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                quickPreset={quickPreset}
                setQuickPreset={setQuickPreset}
                filtersAreDefault={filtersAreDefault}
                filterDateFrom={filterDateFrom}
                setFilterDateFrom={setFilterDateFrom}
                filterDateTo={filterDateTo}
                setFilterDateTo={setFilterDateTo}
                filterDateErrors={filterDateErrors}
                setFilterDateErrors={setFilterDateErrors}
                dishStats={dishStats}
                filterDishType={filterDishType}
                setFilterDishType={setFilterDishType}
                filterQtyMin={filterQtyMin}
                setFilterQtyMin={setFilterQtyMin}
                filterQtyMax={filterQtyMax}
                setFilterQtyMax={setFilterQtyMax}
                sortKey={sortKey}
                setSortKey={setSortKey}
                onResetFilters={resetAllFilters}
              />
            </article>
            </div>

            <div
              id={STAFF_SECTION_IDS.records}
              ref={staffRecordsSectionRef}
              className="scroll-mt-28 sm:scroll-mt-32 lg:scroll-mt-36"
            >
            <article className={`${glassCard} space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8`}>
              <RecordsList
                staffRecords={staffRecords}
                displayedRecords={displayedRecords}
                staffRecordsLoading={staffRecordsLoading}
                staffRecordsLastUpdated={staffRecordsLastUpdated}
                highlightRawId={highlightRawId}
                onEdit={openEditRecord}
                onDelete={setDeleteTarget}
              />
            </article>
            </div>


            {captureModalOpen ? (
              <CameraCaptureSection
                videoRef={cameraVideoRef}
                cameraLoading={cameraLoading}
                cameraError={cameraError}
                onClose={closeCaptureModal}
                onCapture={() => void captureFromCamera()}
              />
            ) : null}

            <Toast toast={toast} />

            <DeleteConfirmModal
              deleteTarget={deleteTarget}
              onCancel={() => setDeleteTarget(null)}
              onConfirm={confirmDeleteRecord}
              isDeleting={deleteLoading}
            />

            <EditRecordModal
              editingRecord={editingRecord}
              editForm={editForm}
              setEditForm={setEditForm}
              onCancel={() => setEditingRecord(null)}
              onSave={saveEditedRecord}
              isSaving={editSaving}
            />
          </section>
        ) : (
          <>
            <section className={`${glassCard} mb-6 p-4 sm:mb-8 sm:p-6`}>
              <div className="mb-4 border-b border-white/10 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-sky">لوحة التحكم</p>
                <h3 className="mt-1 text-lg font-bold text-white">ملخص الحالة الحالية</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {supervisorHeaderStats.map((item) => (
                  <article key={item.label} className="rounded-xl border border-white/10 bg-[#0B1327]/70 px-3 py-2.5">
                    <p className="text-[11px] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{item.value}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="analytics" ref={supervisorAnalyticsRef} className="mb-8 scroll-mt-28">
              <div className="mb-3">
                <h3 className="text-lg font-bold text-white">مؤشرات الأداء</h3>
                <p className="text-sm text-slate-400">بطاقات سريعة لمتابعة الحالة العامة.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {supervisorCards.map((m) => (
                <article
                  key={m.label}
                  className={`${glassCard} relative overflow-hidden p-5 hover:-translate-y-0.5`}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${m.glow} to-transparent opacity-60`}
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <m.icon className="h-8 w-8 shrink-0 text-slate-400" />
                  </div>
                  <p className={`relative mt-4 text-[28px] font-bold leading-none tabular-nums ${m.valueClass}`}>{m.value}</p>
                  <p className="relative mt-2 text-xs font-medium text-slate-500">{m.label}</p>
                </article>
              ))}
              </div>
              <div className="mt-6 lg:mt-8">
                <SupervisorAnalyticsBars loading={supervisorSummaryLoading} supervisorSummary={supervisorSummary} />
              </div>
            </section>

            <section id="alerts" ref={supervisorAlertsRef} className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <IconBell className="h-5 w-5 text-accent-amber" />
                  آخر التنبيهات
                </h3>
                {!alertsLoading && alertsList.length > 0 ? (
                  <p className="text-xs text-slate-500">
                    عرض {Math.min(alertsVisibleCount, alertsList.length)} من {alertsList.length}
                  </p>
                ) : null}
              </div>
              {alertsLoading ? (
                <div className="space-y-3" aria-busy="true">
                  {[1, 2, 3, 4].map((i) => (
                    <SkeletonPulse key={i} className="h-[4.5rem] w-full" />
                  ))}
                </div>
              ) : alertsError ? (
                <div className="rounded-xl border border-accent-red/35 bg-accent-red/10 px-3 py-6 text-center text-sm text-red-200">
                  {alertsError}
                </div>
              ) : alertsList.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {alertsList.slice(0, alertsVisibleCount).map((a) => (
                    <li key={a.id} className="rounded-xl border border-white/10 bg-[#0B1327]/70 px-3 py-2.5 text-start text-sm">
                      <p className="font-medium text-slate-200">{a.label_ar || a.details || a.type}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {(a.type || "").toString()} · {a.camera_name || "—"} · {a.location || a.branch || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {displayAiConfidence(a.confidence)} · {formatSaudiDateTime(a.created_at)} ·{" "}
                        {monitoringAlertStatusAr(a.status)}
                      </p>
                      {a.status === "open" ? (
                        <button
                          type="button"
                          disabled={monitoringResolveLoadingId === a.id}
                          onClick={() => void resolveMonitoringAlert(a.id)}
                          className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200 disabled:opacity-50"
                        >
                          {monitoringResolveLoadingId === a.id ? "جاري…" : "تمت المعالجة"}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 px-3 py-6 text-center text-sm text-slate-400">
                  لا توجد تنبيهات مسجلة
                </div>
              )}
              {!alertsLoading && !alertsError && alertsList.length > alertsVisibleCount ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setAlertsVisibleCount((c) => c + ALERTS_PAGE_STEP)}
                    className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/35 hover:text-white"
                  >
                    عرض المزيد ({alertsList.length - alertsVisibleCount} متبقية)
                  </button>
                </div>
              ) : null}
            </section>

            <section id="cameras" ref={supervisorCamerasRef} className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-white">إدارة الكاميرات والفحص</h3>
                <p className="mt-1 text-xs text-slate-400">
                  تسجيل الكاميرات ومراقبة الحالة. أدوات التحليل أدناه للمشرفين المصرّح لهم.
                </p>
              </div>
              <div className="flex flex-col gap-6">
                <div className="mb-3 grid gap-2 sm:grid-cols-3">
                  <input
                    type="text"
                    placeholder="اسم الكاميرا (جديدة)"
                    value={newCameraForm.name}
                    onChange={(e) => setNewCameraForm((f) => ({ ...f, name: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="الفرع/المنطقة"
                    value={newCameraForm.location}
                    onChange={(e) => setNewCameraForm((f) => ({ ...f, location: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="رابط البث (اختياري)"
                    value={newCameraForm.stream_url}
                    onChange={(e) => setNewCameraForm((f) => ({ ...f, stream_url: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void addSupervisorCamera()}
                    className="rounded-xl border border-brand-sky/35 bg-brand/15 px-3 py-2 text-xs font-semibold text-brand-sky"
                  >
                    إضافة كاميرا
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#060d1f]/50 p-4">
                  <p className="mb-2 text-sm font-semibold text-white">مراقبة بالذكاء الاصطناعي</p>
                  <div className="mb-3 rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                    التحليل يتم على الخادم عبر Gemini. إذا ظهرت رسالة فشل، راجع ملف{" "}
                    <span className="font-mono text-slate-200" dir="ltr">backend/.env</span>:{" "}
                    <span className="font-mono text-slate-200" dir="ltr">GEMINI_API_KEY</span> و
                    <span className="font-mono text-slate-200" dir="ltr"> GEMINI_VISION_MODEL</span>
                    ، أو فعّل للتجربة{" "}
                    <span className="font-mono text-slate-200" dir="ltr">MONITORING_AI_DEMO_MODE=true</span>.
                    حقل «الذكاء الاصطناعي» في بطاقة الكاميرة يخص التسجيل فقط ولا يوقف رفع الصورة/الفيديو للتحليل.
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraAnalyzeMode("image")}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        cameraAnalyzeMode === "image"
                          ? "border-brand-sky/45 bg-brand/20 text-sky-100"
                          : "border-white/15 bg-[#0B1327]/60 text-slate-300 hover:text-white"
                      }`}
                    >
                      تحليل صورة
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraAnalyzeMode("video")}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        cameraAnalyzeMode === "video"
                          ? "border-brand-sky/45 bg-brand/20 text-sky-100"
                          : "border-white/15 bg-[#0B1327]/60 text-slate-300 hover:text-white"
                      }`}
                    >
                      تحليل فيديو
                    </button>
                  </div>
                  <label className="mb-2 block text-xs text-slate-400">ربط التحليل بكاميرا مسجلة (اختياري)</label>
                  <select
                    value={monitoringCameraSelectId}
                    onChange={(e) => setMonitoringCameraSelectId(e.target.value)}
                    className="mb-3 w-full max-w-md rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white"
                  >
                    <option value="">بدون ربط بكاميرا</option>
                    {cameraCards.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} — {c.location}
                      </option>
                    ))}
                  </select>
                  {cameraAnalyzeMode === "image" ? (
                    <>
                      <label className="mb-1 block text-xs font-medium text-slate-300">اختيار صورة اختبار</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCameraTestFile(e.target.files?.[0] || null)}
                        className="mb-3 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-200"
                      />
                      {!cameraTestFile ? (
                        <div className="mb-3 rounded-xl border border-dashed border-white/15 bg-[#0B1327]/40 px-3 py-4 text-center text-sm text-slate-400">
                          اختر صورة مطبخ لاختبار فحص السلامة
                        </div>
                      ) : null}
                      {cameraTestPreviewUrl ? (
                        <div className="mb-3 rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                          <img src={cameraTestPreviewUrl} alt="" className="block max-h-72 w-full object-contain" />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <label className="mb-1 block text-xs font-medium text-slate-300">اختيار فيديو اختبار</label>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                        onChange={(e) => onSelectMonitoringVideoFile(e.target.files?.[0] || null)}
                        className="mb-3 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-200"
                      />
                      {cameraVideoError ? (
                        <div className="mb-3 rounded-xl border border-accent-red/35 bg-accent-red/10 px-3 py-3 text-sm text-red-200">
                          {cameraVideoError}
                        </div>
                      ) : null}
                      {cameraVideoFile ? (
                        <div className="mb-3 rounded-xl border border-white/10 bg-[#060d1f]/80 p-3 text-xs text-slate-300">
                          <p>الاسم: <span className="text-slate-100">{cameraVideoFile.name}</span></p>
                          <p className="mt-1">الحجم: <span className="text-slate-100">{formatFileBytes(cameraVideoFile.size)}</span></p>
                          <p className="mt-1">المدة: <span className="text-slate-100">{formatVideoDuration(cameraVideoDurationSec)}</span></p>
                        </div>
                      ) : (
                        <div className="mb-3 rounded-xl border border-dashed border-white/15 bg-[#0B1327]/40 px-3 py-4 text-center text-sm text-slate-400">
                          اختر فيديو مطبخ بصيغة mp4 أو mov أو webm
                        </div>
                      )}
                      {cameraVideoPreviewUrl ? (
                        <div className="mb-3 rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                          <video
                            src={cameraVideoPreviewUrl}
                            controls
                            className="block max-h-72 w-full rounded-lg bg-black object-contain"
                            onLoadedMetadata={(e) => {
                              const dur = Number(e.currentTarget.duration);
                              setCameraVideoDurationSec(Number.isFinite(dur) ? dur : null);
                            }}
                          />
                        </div>
                      ) : null}
                      <div className="mb-3 rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-3 text-sm text-sky-100">
                        سيتم تحليل الفيديو على شكل لقطات متتابعة باستخدام endpoint التحليل الحالي.
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {cameraAnalyzeMode === "image" ? (
                      <button
                        type="button"
                        disabled={monitoringAnalyzeLoading || !cameraTestFile}
                        onClick={() => void analyzeMonitoringFrameUpload()}
                        className="rounded-xl border border-brand-sky/35 bg-brand/15 px-4 py-2 text-xs font-semibold text-brand-sky disabled:opacity-50"
                      >
                        {monitoringAnalyzeLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Spinner className="h-4 w-4 border-2 border-white/30 border-t-white" />
                            جاري التحليل…
                          </span>
                        ) : (
                          "تحليل الصورة"
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={monitoringVideoAnalyzeLoading || !cameraVideoFile}
                        onClick={() => void analyzeMonitoringVideoUpload()}
                        className="rounded-xl border border-brand-sky/35 bg-brand/15 px-4 py-2 text-xs font-semibold text-brand-sky disabled:opacity-50"
                      >
                        {monitoringVideoAnalyzeLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Spinner className="h-4 w-4 border-2 border-white/30 border-t-white" />
                            جاري تحليل الفيديو...
                          </span>
                        ) : (
                          "تحليل الفيديو"
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled
                      title="TODO: الوضع المستمر لاحقاً — إطار كل 2–3 ثوانٍ"
                      className="rounded-xl border border-white/15 bg-[#0B1327]/60 px-4 py-2 text-xs text-slate-500"
                    >
                      تشغيل الكاميرا المباشرة
                    </button>
                  </div>
                  {cameraAnalyzeMode === "video" ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      يتم حفظ المخالفات المكتشفة عبر تنبيهات النظام عند توفر شروط الحفظ في backend.
                    </p>
                  ) : null}
                  {cameraAnalyzeMode === "video" && monitoringVideoProgressText ? (
                    <p className="mt-1 text-xs text-slate-400">{monitoringVideoProgressText}</p>
                  ) : null}
                  {monitoringLastAnalyzedAt ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      آخر تحليل: {formatSaudiDateTime(monitoringLastAnalyzedAt)}
                    </p>
                  ) : null}
                </div>

                {cameraAnalyzeMode === "image" && monitoringAnalysisResult && Array.isArray(monitoringAnalysisResult.checks) ? (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 gap-y-1">
                      <span className="text-sm font-semibold text-white">نتيجة التحليل</span>
                      {monitoringAnalysisResult.provider === "demo" ? (
                        <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">
                          وضع تجريبي - النتائج غير حقيقية
                        </span>
                      ) : monitoringAnalysisResult.provider === "gemini" ? (
                        <>
                          <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">
                            Gemini Vision
                          </span>
                          <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-100">
                            تحليل حقيقي
                          </span>
                        </>
                      ) : (
                        <span className="rounded-full border border-white/15 bg-[#0B1327]/80 px-2 py-0.5 text-[10px] text-slate-300">
                          {String(monitoringAnalysisResult.provider || "")}
                        </span>
                      )}
                      {typeof monitoringAnalysisResult.people_count === "number" ? (
                        <span className="text-xs text-slate-400">الأشخاص: {monitoringAnalysisResult.people_count}</span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {monitoringAnalysisResult.checks.map((chk) => (
                        <article
                          key={chk.key}
                          className={`rounded-xl border px-3 py-2.5 text-start text-xs ${monitoringCheckCardClass(chk.status)}`}
                        >
                          <p className="font-semibold text-white">{chk.label_ar}</p>
                          <p className="mt-1 text-[11px] text-slate-300">
                            {(chk.status_ar && String(chk.status_ar).trim()) || monitoringStatusLabelAr(chk.status)} ·{" "}
                            {displayAiConfidence(chk.confidence)}
                          </p>
                          <p className="mt-1 text-[11px] leading-snug text-slate-400">{chk.reason_ar}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {cameraAnalyzeMode === "video" ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">نتائج تحليل الفيديو</span>
                      <span className="text-xs text-slate-400">تنبيهات محفوظة: {monitoringVideoAlertsCreated}</span>
                    </div>
                    <div className="mb-3 rounded-xl border border-white/10 bg-[#060d1f]/70 p-3 text-xs text-slate-300">
                      <p>
                        عدد اللقطات المحللة: <span className="font-semibold text-slate-100">{monitoringVideoFrameResults.length}</span>
                      </p>
                      <p className="mt-1">
                        أوقات اللقطات:{" "}
                        <span className="text-slate-100">
                          {monitoringVideoAnalyzedTimes.length
                            ? monitoringVideoAnalyzedTimes.map((t) => formatVideoDuration(t)).join("، ")
                            : "—"}
                        </span>
                      </p>
                    </div>

                    {import.meta.env.DEV ? (
                      <div className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-100">
                        <p>ملخص تطوير: endpoint = {MONITORING_ANALYZE_URL}</p>
                        <p className="mt-1">frames sent = {monitoringVideoFrameResults.length}</p>
                        <p className="mt-1">raw violation count = {monitoringVideoRawViolationCount}</p>
                      </div>
                    ) : null}

                    {monitoringVideoFrameResults.length > 0 ? (
                      <div className="mb-4">
                        <p className="mb-2 text-xs font-semibold text-slate-300">نتيجة كل لقطة</p>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {monitoringVideoFrameResults.map((frame) => (
                            <article key={frame.id} className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3 text-xs text-slate-200">
                              {frame.frameUrl ? (
                                <img src={frame.frameUrl} alt="" className="mb-2 h-24 w-full rounded-lg object-cover" />
                              ) : null}
                              <p className="text-slate-400">
                                الوقت: <span className="text-slate-100">{formatVideoDuration(frame.atSecond)}</span>
                              </p>
                              {frame.errorText ? (
                                <p className="mt-1 text-red-200">{frame.errorText}</p>
                              ) : frame.violations.length === 0 ? (
                                <p className="mt-1 text-emerald-200">لا توجد مخالفة</p>
                              ) : (
                                <div className="mt-1 space-y-1">
                                  {frame.violations.map((v) => (
                                    <p key={v.id}>
                                      <span className="text-slate-100">{v.type}</span> · {displayAiConfidence(v.confidence)}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {monitoringVideoResults.length === 0 ? (
                      videoAllFramesFailed ? (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-5 text-center text-sm text-red-200">
                          تعذر تحليل الفيديو. تحقق من إعدادات الذكاء الاصطناعي.
                        </div>
                      ) : monitoringVideoFrameResults.length > 0 ? (
                        <div className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/50 px-3 py-5 text-center text-sm text-slate-400">
                          تم تحليل اللقطات — لا توجد مخالفات مكتشفة.
                        </div>
                      ) : null
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {monitoringVideoResults.map((v) => (
                          <article key={v.id} className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3 text-xs text-slate-200">
                            <p className="font-semibold text-white">{v.type}</p>
                            <p className="mt-1 text-slate-400">
                              الوقت داخل الفيديو: <span className="text-slate-200">{formatVideoDuration(v.atSecond)}</span>
                            </p>
                            <p className="mt-1 text-slate-400">
                              الثقة: <span className="text-slate-200">{displayAiConfidence(v.confidence)}</span>
                            </p>
                            <p className="mt-1 text-slate-400">
                              الحالة: <span className="text-slate-200">{monitoringAlertStatusAr(v.status)}</span>
                            </p>
                            {v.reason ? <p className="mt-1 text-[11px] text-slate-400">{v.reason}</p> : null}
                            {monitoringVideoFrameResults.find((f) => f.id === v.frameId)?.frameUrl ? (
                              <img
                                src={monitoringVideoFrameResults.find((f) => f.id === v.frameId)?.frameUrl}
                                alt=""
                                className="mt-2 h-28 w-full rounded-lg object-cover"
                              />
                            ) : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {cameraCardsLoading ? (
                  <div className="space-y-3" aria-busy="true">
                    <SkeletonPulse className="h-24 w-full" />
                    <SkeletonPulse className="h-24 w-full" />
                  </div>
                ) : cameraCardsError ? (
                  <p className="rounded-xl border border-accent-red/35 bg-accent-red/10 px-3 py-4 text-sm text-red-200">{cameraCardsError}</p>
                ) : cameraCards.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/50 px-3 py-6 text-center text-sm text-slate-400">
                    لا يوجد بث مباشر متصل حاليًا
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400">حالة الكاميرات</p>
                    {cameraCards.some((c) => c?.is_connected && String(c?.stream_url || c?.streamUrl || "").trim()) ? null : (
                      <div className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/50 px-3 py-4 text-center text-sm text-slate-400">
                        لا يوجد بث مباشر متصل حاليًا
                      </div>
                    )}
                    {cameraCards.map((c) => (
                      <article
                        key={c.id}
                        className="rounded-xl border border-white/10 bg-gradient-to-br from-[#0B1327]/90 to-[#060d1f]/80 p-4 text-xs text-slate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/5 pb-2">
                          <p className="text-sm font-semibold text-white">{c.name}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              c.is_connected ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-600/30 text-slate-400"
                            }`}
                          >
                            {c.is_connected ? "متصل" : "غير متصل"}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                          <p>
                            <span className="text-slate-500">الموقع:</span> {c.location}
                          </p>
                          <p>
                            <span className="text-slate-500">الذكاء الاصطناعي:</span>{" "}
                            {c.ai_enabled ? "مفعّل" : "غير مفعّل"}
                          </p>
                          <p className="sm:col-span-2">
                            <span className="text-slate-500">آخر تحليل:</span>{" "}
                            {c.last_analysis_at ? formatSaudiDateTime(c.last_analysis_at) : "لا يوجد"}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-white">نظرة عامة على الأداء</h3>
                <p className="mt-1 text-xs text-slate-400">أرقام تشغيلية من خادم النظام.</p>
              </div>
              {supervisorSummaryLoading ? (
                <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
                  {[1, 2, 3, 4].map((i) => (
                    <SkeletonPulse key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : supervisorSummary ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-[#020617]/60 p-4">
                    <p className="text-xs text-slate-500">إجمالي الأطباق</p>
                    <p className="mt-1 text-xl font-bold text-white">{supervisorSummary.total_dishes}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#020617]/60 p-4">
                    <p className="text-xs text-slate-500">عدد الأطباق هذا الأسبوع</p>
                    <p className="mt-1 text-xl font-bold text-white">{supervisorSummary.dishes_week}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#020617]/60 p-4">
                    <p className="text-xs text-slate-500">إجمالي الكمية</p>
                    <p className="mt-1 text-xl font-bold text-white">{supervisorSummary.total_quantity}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#020617]/60 p-4">
                    <p className="text-xs text-slate-500">عدد الأطباق التي تحتاج مراجعة</p>
                    <p className="mt-1 text-xl font-bold text-amber-200">{supervisorSummary.pending_reviews}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-[#020617]/60 px-4 py-10 text-center text-sm text-slate-400">
                  لا توجد بيانات كافية
                </div>
              )}
            </section>

            <section id="reports" ref={supervisorReportsRef} className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">التقارير</h3>
                  <p className="mt-1 text-xs text-slate-400">مؤشرات ملخّصة من الخادم؛ تصدير CSV للملفات والتحليل الخارجي.</p>
                </div>
                <button
                  type="button"
                  disabled={!supervisorSummary}
                  onClick={() => exportSupervisorReportCsv()}
                  className="rounded-xl border border-brand-sky/40 bg-brand/15 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  تصدير CSV
                </button>
              </div>
              {supervisorSummaryLoading ? (
                <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
                  {[1, 2, 3, 4].map((i) => (
                    <SkeletonPulse key={i} className="h-[4.5rem] w-full" />
                  ))}
                </div>
              ) : supervisorSummary ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3">
                        <p className="text-xs text-slate-500">أكثر موظف لديه مراجعات</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {supervisorSummary.top_employee_review_name || "لا توجد بيانات كافية"}
                          {supervisorSummary.top_employee_review_count
                            ? ` (${supervisorSummary.top_employee_review_count})`
                            : ""}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3">
                        <p className="text-xs text-slate-500">أكثر طبق تم تسجيله</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {supervisorSummary.most_common_dish || "لا توجد بيانات كافية"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3">
                        <p className="text-xs text-slate-500">أكثر طبق يحتاج مراجعة</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {supervisorSummary.most_reviewed_dish || "لا توجد بيانات كافية"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3">
                        <p className="text-xs text-slate-500">متوسط الثقة</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {supervisorSummary.average_confidence != null
                            ? `${supervisorSummary.average_confidence}%`
                            : "لا توجد بيانات كافية"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-[#0B1327]/50 px-4 py-10 text-center text-sm text-slate-400">
                      لا توجد بيانات كافية للتقارير. تأكد من اتصال الخادم أو من صلاحيات المشرف.
                    </div>
                  )}
              {role === "admin" ? (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-white">تقرير مخالفات المراقبة</h4>
                      <p className="mt-1 text-xs text-slate-400">
                        بيانات من تنبيهات المراقبة المحفوظة في النظام (حتى 500 سجلًا لكل استعلام).
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setViolationsReportFrom("");
                          setViolationsReportTo("");
                          void fetchViolationsReport("", "");
                        }}
                        className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/25 hover:text-white"
                      >
                        إظهار الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => void fetchViolationsReport(violationsReportFrom, violationsReportTo)}
                        className="rounded-xl border border-brand-sky/40 bg-brand/15 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-brand/25"
                      >
                        تطبيق الفلتر
                      </button>
                      <button
                        type="button"
                        disabled={violationsReportLoading || violationsReportStats.total === 0}
                        onClick={() => exportViolationsReportLatestCsv()}
                        className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        تصدير CSV
                      </button>
                      <button
                        type="button"
                        disabled={violationsReportLoading || violationsReportStats.total === 0}
                        onClick={() => printViolationsReportPdf()}
                        title="طباعة أو حفظ PDF عبر نافذة المتصفح (اختر «حفظ كملف PDF»)"
                        className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        تصدير PDF
                      </button>
                    </div>
                  </div>
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                      <span className="text-xs text-slate-400">من تاريخ</span>
                      <input
                        type="date"
                        value={violationsReportFrom}
                        onChange={(e) => setViolationsReportFrom(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                      />
                    </label>
                    <label className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                      <span className="text-xs text-slate-400">إلى تاريخ</span>
                      <input
                        type="date"
                        value={violationsReportTo}
                        onChange={(e) => setViolationsReportTo(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                      />
                    </label>
                    <div className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3 sm:col-span-2">
                      <p className="text-xs text-slate-400">النطاق الزمني</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        يعتمد تقويم الرياض. اترك الحقلين فارغَين ثم اضغط «تطبيق الفلتر» لعرض أحدث السجلات دون
                        تقييد بالتاريخ.
                      </p>
                    </div>
                  </div>
                  {violationsReportError ? (
                    <div className="mb-4 rounded-xl border border-accent-red/35 bg-accent-red/10 px-3 py-3 text-sm text-red-200">
                      {violationsReportError}
                    </div>
                  ) : null}
                  {violationsReportLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <SkeletonPulse key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : violationsReportStats.total === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/50 px-4 py-10 text-center text-sm text-slate-400">
                      لا توجد مخالفات مسجّلة في النطاق الحالي.
                    </div>
                  ) : (
                    <>
                      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-[#020617]/70 p-4">
                          <p className="text-xs text-slate-500">إجمالي المخالفات</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{violationsReportStats.total}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#020617]/70 p-4">
                          <p className="text-xs text-slate-500">مفتوح</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-200">
                            {violationsReportStats.openCount}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#020617]/70 p-4">
                          <p className="text-xs text-slate-500">تمت المعالجة</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-200">
                            {violationsReportStats.resolvedCount}
                          </p>
                        </div>
                        <div className="rounded-xl border border-brand-sky/25 bg-brand/10 p-4">
                          <p className="text-xs text-slate-500">أكثر مخالفة تكرارًا</p>
                          {violationsReportStats.topRepeated.count > 0 ? (
                            <>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {violationsReportStats.topRepeated.label}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {violationsReportStats.topRepeated.count} مرة
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-slate-500">لا توجد بيانات</p>
                          )}
                        </div>
                      </div>
                      <div className="mb-6 grid gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-[#060d1f]/60 p-4">
                          <p className="mb-3 text-sm font-semibold text-white">المخالفات حسب النوع</p>
                          <ul className="space-y-2 text-sm">
                            {VIOLATION_REPORT_CATEGORY_ORDER.map((c) => (
                              <li key={c.key} className="flex items-center justify-between gap-2 text-slate-300">
                                <span>{c.label}</span>
                                <span className="tabular-nums font-semibold text-slate-100">
                                  {violationsReportStats.typeCounts[c.key]}
                                </span>
                              </li>
                            ))}
                            {violationsReportStats.typeCounts._other > 0 ? (
                              <li className="flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-slate-400">
                                <span>أخرى</span>
                                <span className="tabular-nums font-semibold text-slate-200">
                                  {violationsReportStats.typeCounts._other}
                                </span>
                              </li>
                            ) : null}
                          </ul>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#060d1f]/60 p-4">
                          <p className="mb-3 text-sm font-semibold text-white">حسب الحالة</p>
                          <ul className="space-y-3 text-sm">
                            <li className="flex items-center justify-between gap-2">
                              <span className="text-slate-400">مفتوح</span>
                              <span className="tabular-nums font-bold text-amber-200">
                                {violationsReportStats.openCount}
                              </span>
                            </li>
                            <li>
                              <div className="h-2 overflow-hidden rounded-full bg-[#020617]">
                                <div
                                  className="h-full rounded-full bg-amber-500/70 transition-all"
                                  style={{
                                    width: `${violationsReportStats.total ? Math.round((violationsReportStats.openCount / violationsReportStats.total) * 100) : 0}%`,
                                  }}
                                />
                              </div>
                            </li>
                            <li className="flex items-center justify-between gap-2">
                              <span className="text-slate-400">تمت المعالجة</span>
                              <span className="tabular-nums font-bold text-emerald-200">
                                {violationsReportStats.resolvedCount}
                              </span>
                            </li>
                            <li>
                              <div className="h-2 overflow-hidden rounded-full bg-[#020617]">
                                <div
                                  className="h-full rounded-full bg-emerald-500/70 transition-all"
                                  style={{
                                    width: `${violationsReportStats.total ? Math.round((violationsReportStats.resolvedCount / violationsReportStats.total) * 100) : 0}%`,
                                  }}
                                />
                              </div>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <div>
                        <p className="mb-3 text-sm font-semibold text-white">أحدث المخالفات</p>
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="min-w-full text-start text-xs sm:text-sm">
                            <thead className="border-b border-white/10 bg-[#0B1327]/80 text-slate-400">
                              <tr>
                                <th className="px-3 py-2">النوع</th>
                                <th className="px-3 py-2">التفاصيل</th>
                                <th className="px-3 py-2">الحالة</th>
                                <th className="px-3 py-2">الفرع</th>
                                <th className="px-3 py-2">الكاميرا</th>
                                <th className="px-3 py-2">الوقت</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-200">
                              {violationsReportStats.latest.map((row) => (
                                <tr key={row.id} className="bg-[#060d1f]/40">
                                  <td className="px-3 py-2 font-medium text-white">
                                    {violationReportTypeLabel(row.type) || row.label_ar || row.type || "—"}
                                  </td>
                                  <td className="max-w-[14rem] truncate px-3 py-2 text-slate-400" title={row.details}>
                                    {row.details || "—"}
                                  </td>
                                  <td className="px-3 py-2">{monitoringAlertStatusAr(row.status)}</td>
                                  <td className="px-3 py-2">{row.branch || "—"}</td>
                                  <td className="px-3 py-2">{row.camera_name || "—"}</td>
                                  <td className="whitespace-nowrap px-3 py-2">{formatSaudiDateTime(row.created_at)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </section>

            <section id="dish-reviews" ref={supervisorReviewsRef} className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">مراجعة الأطباق</h3>
                  <p className="text-sm text-slate-400">اعتماد أو رفض سجلات الأطباق مع تتبع سجل المراجعة.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!reviewRecords.length}
                    onClick={() => exportReviewRecordsCsv()}
                    className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    تصدير CSV ({reviewRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadSupervisorReviews()}
                    className="rounded-xl border border-brand-sky/35 bg-brand/15 px-3 py-2 text-xs font-semibold text-brand-sky transition hover:bg-brand/25"
                  >
                    تحديث
                  </button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  { value: "needs_review", label: "يحتاج مراجعة" },
                  { value: "approved", label: "تم الاعتماد" },
                  { value: "rejected", label: "مرفوض" },
                  { value: "all", label: "الكل" },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setReviewFilters((f) => ({ ...f, status: t.value }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      reviewFilters.status === t.value
                        ? "border-brand-sky/60 bg-brand/30 text-sky-100"
                        : "border-white/15 bg-[#0B1327]/70 text-slate-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                  <p className="text-xs text-slate-500">عدد الأطباق التي تحتاج مراجعة</p>
                    <p className="mt-1 text-xl font-bold text-amber-200">{supervisorSummary?.pending_reviews ?? "لا توجد بيانات كافية"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                  <p className="text-xs text-slate-500">عدد المقبولة اليوم</p>
                    <p className="mt-1 text-xl font-bold text-emerald-200">{supervisorSummary?.approved_today ?? "لا توجد بيانات كافية"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                  <p className="text-xs text-slate-500">عدد المرفوضة اليوم</p>
                    <p className="mt-1 text-xl font-bold text-red-200">{supervisorSummary?.rejected_today ?? "لا توجد بيانات كافية"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                    <p className="text-xs text-slate-500">إجمالي الموظفين</p>
                    <p className="mt-1 text-xl font-bold text-brand-sky">{supervisorSummary?.total_employees ?? "لا توجد بيانات كافية"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                    <p className="text-xs text-slate-500">الموظفين النشطين اليوم</p>
                    <p className="mt-1 text-xl font-bold text-slate-100">{supervisorSummary?.active_employees_today ?? "لا توجد بيانات كافية"}</p>
                </div>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-[#060d1f]/70 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <input
                  type="search"
                  placeholder="فلتر الموظف"
                  value={reviewFilters.employee}
                  onChange={(e) => setReviewFilters((f) => ({ ...f, employee: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                />
                <input
                  type="search"
                  placeholder="نوع الطبق"
                  value={reviewFilters.dishType}
                  onChange={(e) => setReviewFilters((f) => ({ ...f, dishType: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                />
                <input
                  type="date"
                  value={reviewFilters.dateFrom}
                  onChange={(e) => setReviewFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                />
                <input
                  type="date"
                  value={reviewFilters.dateTo}
                  onChange={(e) => setReviewFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="الثقة من"
                  value={reviewFilters.confidenceMin}
                  onChange={(e) => setReviewFilters((f) => ({ ...f, confidenceMin: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="الثقة إلى"
                  value={reviewFilters.confidenceMax}
                  onChange={(e) => setReviewFilters((f) => ({ ...f, confidenceMax: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                />
                <select
                  value={reviewFilters.status}
                  onChange={(e) => setReviewFilters((f) => ({ ...f, status: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                >
                  <option value="needs_review">يحتاج مراجعة</option>
                  <option value="approved">مقبول</option>
                  <option value="rejected">مرفوض</option>
                  <option value="all">الكل</option>
                </select>
              </div>

              {reviewLoading ? (
                <div className="space-y-3" aria-busy="true">
                  {[1, 2, 3].map((i) => (
                    <SkeletonPulse key={i} className="h-40 w-full" />
                  ))}
                </div>
              ) : reviewRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/60 px-3 py-8 text-center text-sm text-slate-400">
                  {reviewFiltersAreActive
                    ? "لا توجد سجلات تطابق الفلاتر الحالية. جرّب توسيع نطاق البحث أو تغيير حالة المراجعة."
                    : "لا توجد سجلات ضمن العرض الافتراضي (يحتاج مراجعة) حالياً."}
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewTotalPages > 1 ? (
                    <p className="text-center text-xs text-slate-500">
                      عرض الصفحة {reviewPage} من {reviewTotalPages} · إجمالي {reviewRecords.length} سجلًا
                    </p>
                  ) : null}
                  {pagedReviewRecords.map((r) => {
                    const conf = Number(r.ai_confidence);
                    const confText = displayAiConfidence(conf);
                    const badge =
                      r.status === "approved"
                        ? "border-accent-green/45 bg-accent-green/15 text-emerald-200"
                        : r.status === "rejected"
                          ? "border-accent-red/45 bg-accent-red/15 text-red-100"
                          : "border-accent-amber/45 bg-accent-amber/15 text-amber-100";
                    const statusLabel =
                      r.status === "approved" ? "تم الاعتماد" : r.status === "rejected" ? "مرفوض" : "يحتاج مراجعة";
                    const suggestions = Array.isArray(r.ai_suggestions) ? r.ai_suggestions.slice(0, 3) : [];
                    return (
                      <article key={r.id} className="rounded-2xl border border-white/10 bg-[#060d1f]/85 p-4 shadow-glass sm:p-5">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
                          <FoodImageThumb src={r.image_url} alt={r.confirmed_label || r.predicted_label || "dish"} sizeClass="h-32 w-32 shrink-0 rounded-xl sm:h-36 sm:w-36" />
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge}`}>
                                {statusLabel}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400">
                              اقتراح الذكاء الاصطناعي: <span className="font-semibold text-brand-sky">{r.predicted_label || "—"}</span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {suggestions.length ? (
                                suggestions.map((s, idx) => (
                                  <span key={`${r.id}-${idx}`} className="rounded-lg border border-white/10 bg-[#0B1327]/80 px-2 py-1 text-xs text-slate-200">
                                    {s?.name || "—"} ({formatConfidencePercentDisplay(s?.confidence)})
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-500">لا توجد اقتراحات إضافية</span>
                              )}
                            </div>
                            <div className="grid gap-3 lg:grid-cols-[1fr_16rem]">
                              <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                              <p>اسم الطبق النهائي: <span className="font-semibold text-white">{r.confirmed_label || "—"}</span></p>
                              <p>الكمية: <span className="font-semibold text-white">{r.quantity}</span></p>
                              <p>المصدر: <span className="font-semibold text-white">{r.source_entity || "—"}</span></p>
                              <p>الثقة: <span className="font-semibold text-white">{confText}</span></p>
                              <p>وقت التسجيل: <span className="font-semibold text-white">{formatSaudiDateTime(r.recorded_at)}</span></p>
                              <p>الحالة/السبب: <span className="font-semibold text-white">{r.rejected_reason || supervisorStatusText(r.status)}</span></p>
                              <p>راجع بواسطة: <span className="font-semibold text-white">{r.reviewed_by_name || "—"}</span></p>
                              <p>وقت المراجعة: <span className="font-semibold text-white">{r.reviewed_at ? formatSaudiDateTime(r.reviewed_at) : "—"}</span></p>
                              </div>
                              <aside className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3 text-xs text-slate-300">
                                <p className="font-semibold text-slate-200">بيانات الموظف</p>
                                <p className="mt-2">الاسم: <span className="text-white">{r.employee_name || "—"}</span></p>
                                <p className="mt-1" dir="ltr">البريد: <span className="text-white">{r.employee_email || "—"}</span></p>
                              </aside>
                            </div>
                            {r.supervisor_notes ? (
                              <p className="rounded-lg border border-white/10 bg-[#0B1327]/70 px-3 py-2 text-xs text-slate-300">
                                ملاحظات: {r.supervisor_notes}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                type="button"
                                disabled={reviewActionLoadingId === r.id}
                                onClick={() => void approveReviewRecord(r)}
                                className="rounded-xl border border-emerald-500/45 bg-emerald-600/20 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-600/30 disabled:opacity-50"
                              >
                                قبول
                              </button>
                              <button
                                type="button"
                                disabled={reviewActionLoadingId === r.id}
                                onClick={() => {
                                  setRejectTarget(r);
                                  setRejectReason("");
                                  setRejectNotes(r.supervisor_notes || "");
                                }}
                                className="rounded-xl border border-accent-red/45 bg-accent-red/15 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-accent-red/25 disabled:opacity-50"
                              >
                                رفض
                              </button>
                              <button
                                type="button"
                                disabled={reviewActionLoadingId === r.id}
                                onClick={() => {
                                  setEditApproveTarget(r);
                                  setEditApproveForm({
                                    dishName: r.confirmed_label || r.predicted_label || "",
                                    quantity: r.quantity || 1,
                                    source: r.source_entity || "",
                                    notes: r.supervisor_notes || "",
                                  });
                                }}
                                className="rounded-xl border border-brand-sky/45 bg-brand/15 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-brand/25 disabled:opacity-50"
                              >
                                تعديل واعتماد
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {reviewTotalPages > 1 ? (
                    <nav
                      className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4"
                      aria-label="ترقيم صفحات المراجعة"
                    >
                      <button
                        type="button"
                        disabled={reviewPage <= 1}
                        onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                        className="rounded-lg border border-white/15 bg-[#0B1327]/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/35 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        السابق
                      </button>
                      <span className="text-xs tabular-nums text-slate-500">
                        {reviewPage} / {reviewTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={reviewPage >= reviewTotalPages}
                        onClick={() => setReviewPage((p) => Math.min(reviewTotalPages, p + 1))}
                        className="rounded-lg border border-white/15 bg-[#0B1327]/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/35 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        التالي
                      </button>
                    </nav>
                  ) : null}
                </div>
              )}
            </section>

            <section id="employees" ref={supervisorEmployeesRef} className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">الموظفين</h3>
                  <p className="text-sm text-slate-400">عرض الموظفين مع إحصائيات السجلات الحقيقية.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadSupervisorEmployees()}
                  className="rounded-xl border border-brand-sky/35 bg-brand/15 px-3 py-2 text-xs font-semibold text-brand-sky transition hover:bg-brand/25"
                >
                  تحديث
                </button>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-[#060d1f]/70 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="search"
                  placeholder="بحث بالاسم/البريد"
                  value={employeeFilters.search}
                  onChange={(e) => setEmployeeFilters((f) => ({ ...f, search: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                />
                <select
                  value={employeeFilters.role}
                  onChange={(e) => setEmployeeFilters((f) => ({ ...f, role: e.target.value }))}
                  className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                >
                  <option value="">كل الأدوار</option>
                  <option value="staff">staff</option>
                  <option value="supervisor">supervisor</option>
                  <option value="admin">admin</option>
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={employeeFilters.activeToday}
                    onChange={(e) => setEmployeeFilters((f) => ({ ...f, activeToday: e.target.checked }))}
                  />
                  نشط اليوم
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={employeeFilters.hasPendingReviews}
                    onChange={(e) => setEmployeeFilters((f) => ({ ...f, hasPendingReviews: e.target.checked }))}
                  />
                  لديه مراجعات معلّقة
                </label>
              </div>
              {supervisorEmployeesLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <SkeletonPulse key={i} className="h-36 w-full" />
                  ))}
                </div>
              ) : supervisorEmployees.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/60 px-3 py-8 text-center text-sm text-slate-400">
                  {employeeFiltersAreActive
                    ? "لا يوجد موظفون يطابقون الفلاتر الحالية."
                    : "لا توجد بيانات موظفين من الخادم حتى الآن."}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {employeeTotalPages > 1 ? (
                    <p className="col-span-full text-center text-xs text-slate-500">
                      عرض {(employeePage - 1) * EMPLOYEE_PAGE_SIZE + 1}–
                      {Math.min(employeePage * EMPLOYEE_PAGE_SIZE, supervisorEmployees.length)} من{" "}
                      {supervisorEmployees.length}
                    </p>
                  ) : null}
                  {pagedSupervisorEmployees.map((e) => (
                    <article key={e.id} className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3">
                      <p className="font-semibold text-white">
                        {e.full_name || e.username}
                        <span className="ms-2 text-xs font-normal text-slate-400">
                          ({e.branch_name?.trim() ? e.branch_name : "—"})
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400" dir="ltr">{e.email}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                        <p>الدور: <span className="text-white">{roleAr(e.role)}</span></p>
                        <p>اليوم: <span className="text-white">{e.dishes_today}</span></p>
                        <p>الإجمالي: <span className="text-white">{e.total_dishes}</span></p>
                        <p>معلّق: <span className="text-white">{e.pending_reviews}</span></p>
                        <p className="col-span-2">آخر نشاط: <span className="text-white">{e.last_activity ? formatSaudiDateTime(e.last_activity) : "لا توجد بيانات كافية"}</span></p>
                        <p className="col-span-2">الحالة: <span className={`${e.status === "نشط" ? "text-emerald-300" : "text-slate-400"}`}>{e.status}</span></p>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewFilters((f) => ({ ...f, employee: e.email || e.username }));
                            document.getElementById("dish-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="col-span-2 mt-2 rounded-lg border border-brand-sky/40 bg-brand/15 px-2 py-1 text-xs font-semibold text-sky-100"
                        >
                          عرض سجلات الموظف
                        </button>
                      </div>
                    </article>
                  ))}
                  {employeeTotalPages > 1 ? (
                    <nav
                      className="col-span-full flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-4"
                      aria-label="ترقيم صفحات الموظفين"
                    >
                      <button
                        type="button"
                        disabled={employeePage <= 1}
                        onClick={() => setEmployeePage((p) => Math.max(1, p - 1))}
                        className="rounded-lg border border-white/15 bg-[#0B1327]/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/35 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        السابق
                      </button>
                      <span className="text-xs tabular-nums text-slate-500">
                        {employeePage} / {employeeTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={employeePage >= employeeTotalPages}
                        onClick={() => setEmployeePage((p) => Math.min(employeeTotalPages, p + 1))}
                        className="rounded-lg border border-white/15 bg-[#0B1327]/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/35 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        التالي
                      </button>
                    </nav>
                  ) : null}
                </div>
              )}
            </section>

            {role === "admin" ? (
              <section id="users" className={`${glassCard} mt-6`}>
                <h3 className="mb-2 text-lg font-bold text-white">إدارة المستخدمين</h3>
                <p className="text-sm text-slate-400">
                  يمكنك من هذه اللوحة إدارة حسابات staff/supervisor/admin.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/admin/users"
                    className="inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/35 transition hover:bg-blue-600"
                  >
                    فتح إدارة المستخدمين
                  </Link>
                  <Link
                    to="/admin/requests"
                    className="inline-flex rounded-xl border border-white/15 bg-[rgba(15,23,42,0.72)] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-brand-sky/40 hover:bg-[#1a2644]"
                  >
                    طلبات الحساب الإداري
                  </Link>
                </div>
              </section>
            ) : null}

            <section id="settings" ref={supervisorSettingsRef} className={`${glassCard} mt-6`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">إعدادات النظام</h3>
                  <p className="text-xs text-slate-400">هذه الإعدادات محلية على المتصفح الحالي فقط (localStorage).</p>
                </div>
                {role === "admin" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetAdminSettings}
                      className="rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
                    >
                      إعادة الافتراضي
                    </button>
                    <button
                      type="button"
                      onClick={saveAdminSettings}
                      disabled={adminSettingsSaving}
                      className="rounded-xl border border-brand-sky/40 bg-brand/20 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-brand/30 disabled:opacity-60"
                    >
                      {adminSettingsSaving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
                    </button>
                  </div>
                ) : null}
              </div>

              {role !== "admin" ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/60 px-4 py-6 text-sm text-slate-300">
                  هذه الإعدادات متاحة لمدير النظام فقط
                </div>
              ) : (
                <div className="space-y-5">
                  <article className="rounded-2xl border border-white/10 bg-[#0B1327]/70 p-4">
                    <h4 className="text-sm font-semibold text-white">إعدادات الذكاء الاصطناعي</h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                        <span className="text-xs text-slate-400">الحد الأدنى للثقة</span>
                        <div className="mt-2 flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={adminSettings.ai.minConfidence}
                            onChange={(e) =>
                              setAdminSettings((prev) => ({
                                ...prev,
                                ai: { ...prev.ai, minConfidence: Number(e.target.value) || 0 },
                              }))
                            }
                            className="w-full accent-sky-400"
                          />
                          <span className="min-w-10 text-sm font-semibold text-sky-100">
                            {adminSettings.ai.minConfidence}%
                          </span>
                        </div>
                      </label>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["mask", "الكمامة"],
                        ["gloves", "القفازات"],
                        ["headCover", "غطاء الرأس"],
                        ["wetFloor", "الأرضيات المبللة"],
                        ["containers", "الحاويات"],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-[#060d1f]/80 px-3 py-2 text-sm text-slate-200"
                        >
                          <span>{label}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={Boolean(adminSettings.ai.violations[key])}
                            onClick={() =>
                              setAdminSettings((prev) => ({
                                ...prev,
                                ai: {
                                  ...prev.ai,
                                  violations: {
                                    ...prev.ai.violations,
                                    [key]: !prev.ai.violations[key],
                                  },
                                },
                              }))
                            }
                            className={`relative h-6 w-11 rounded-full transition ${
                              adminSettings.ai.violations[key] ? "bg-sky-500/70" : "bg-slate-700"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                                adminSettings.ai.violations[key] ? "right-0.5" : "right-[1.35rem]"
                              }`}
                            />
                          </button>
                        </label>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-white/10 bg-[#0B1327]/70 p-4">
                    <h4 className="text-sm font-semibold text-white">إعدادات التنبيهات</h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#060d1f]/80 px-3 py-2 text-sm text-slate-200">
                        <span>تفعيل التنبيهات محلياً</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={adminSettings.alerts.enabled}
                          onClick={() =>
                            setAdminSettings((prev) => ({
                              ...prev,
                              alerts: { ...prev.alerts, enabled: !prev.alerts.enabled },
                            }))
                          }
                          className={`relative h-6 w-11 rounded-full transition ${
                            adminSettings.alerts.enabled ? "bg-sky-500/70" : "bg-slate-700"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                              adminSettings.alerts.enabled ? "right-0.5" : "right-[1.35rem]"
                            }`}
                          />
                        </button>
                      </label>
                      <label className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                        <span className="text-xs text-slate-400">الحدّة الافتراضية للتنبيه</span>
                        <select
                          value={adminSettings.alerts.defaultSeverity}
                          onChange={(e) =>
                            setAdminSettings((prev) => ({
                              ...prev,
                              alerts: { ...prev.alerts, defaultSeverity: e.target.value },
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                        >
                          <option value="low">منخفض</option>
                          <option value="medium">متوسط</option>
                          <option value="high">عالي</option>
                        </select>
                      </label>
                    </div>
                  </article>

                  <article className="rounded-2xl border border-white/10 bg-[#0B1327]/70 p-4">
                    <h4 className="text-sm font-semibold text-white">إعدادات التقارير</h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={!hasPdfExport}
                        onClick={() =>
                          setAdminSettings((prev) => ({
                            ...prev,
                            reports: { ...prev.reports, pdfEnabled: !prev.reports.pdfEnabled },
                          }))
                        }
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-[#060d1f]/80 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>تفعيل تصدير PDF</span>
                        <span className="text-xs text-slate-400">{hasPdfExport ? "متاح" : "غير متاح حالياً"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!hasExcelExport}
                        onClick={() =>
                          setAdminSettings((prev) => ({
                            ...prev,
                            reports: { ...prev.reports, excelEnabled: !prev.reports.excelEnabled },
                          }))
                        }
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-[#060d1f]/80 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span>تفعيل تصدير Excel</span>
                        <span className="text-xs text-slate-400">{hasExcelExport ? "متاح" : "غير متاح حالياً"}</span>
                      </button>
                    </div>
                  </article>

                  <article className="rounded-2xl border border-white/10 bg-[#0B1327]/70 p-4">
                    <h4 className="text-sm font-semibold text-white">إعدادات النظام</h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                        <span className="text-xs text-slate-400">اسم المنصة المعروض</span>
                        <input
                          type="text"
                          value={adminSettings.system.platformName}
                          onChange={(e) =>
                            setAdminSettings((prev) => ({
                              ...prev,
                              system: { ...prev.system, platformName: e.target.value },
                            }))
                          }
                          className="mt-2 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-sky/50"
                        />
                      </label>
                      <label className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                        <span className="text-xs text-slate-400">اللغة الافتراضية</span>
                        <input
                          type="text"
                          value={adminSettings.system.defaultLanguage}
                          disabled
                          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B1327]/50 px-3 py-2 text-sm text-slate-300"
                        />
                      </label>
                      <label className="rounded-xl border border-white/10 bg-[#060d1f]/80 p-3">
                        <span className="text-xs text-slate-400">المنطقة الزمنية</span>
                        <input
                          type="text"
                          value={adminSettings.system.timezone}
                          disabled
                          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0B1327]/50 px-3 py-2 text-sm text-slate-300"
                        />
                      </label>
                    </div>
                  </article>
                </div>
              )}
            </section>
          </>
        )}

        {role !== "staff" ? <Toast toast={toast} /> : null}

        {rejectTarget ? (
          <div
            className="fixed inset-0 z-[185] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setRejectTarget(null);
            }}
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-5 shadow-2xl">
              <h4 className="text-lg font-bold text-white">سبب رفض السجل</h4>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="اكتب سبب الرفض (إجباري)"
                className="mt-3 min-h-[6rem] w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
              />
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="ملاحظات إضافية (اختياري)"
                className="mt-2 min-h-[4rem] w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!rejectReason.trim() || reviewActionLoadingId === rejectTarget.id}
                  onClick={() => void confirmRejectReviewRecord()}
                  className="rounded-xl border border-accent-red/45 bg-accent-red/15 px-4 py-2 text-sm font-semibold text-red-100 disabled:opacity-50"
                >
                  تأكيد الرفض
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editApproveTarget ? (
          <div
            className="fixed inset-0 z-[185] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditApproveTarget(null);
            }}
          >
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0F172A] p-5 shadow-2xl">
              <h4 className="text-lg font-bold text-white">تعديل واعتماد السجل</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400">اسم الطبق</label>
                  <input
                    value={editApproveForm.dishName}
                    onChange={(e) => setEditApproveForm((f) => ({ ...f, dishName: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">الكمية</label>
                  <input
                    type="number"
                    min="1"
                    value={editApproveForm.quantity}
                    onChange={(e) => setEditApproveForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">المصدر</label>
                  <input
                    value={editApproveForm.source}
                    onChange={(e) => setEditApproveForm((f) => ({ ...f, source: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-400">ملاحظات</label>
                  <textarea
                    value={editApproveForm.notes}
                    onChange={(e) => setEditApproveForm((f) => ({ ...f, notes: e.target.value }))}
                    className="mt-1 min-h-[5rem] w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditApproveTarget(null)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!editApproveForm.dishName.trim() || reviewActionLoadingId === editApproveTarget.id}
                  onClick={() => void submitEditApproveReviewRecord()}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  حفظ واعتماد
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      </div>
      {role === "admin" && violationsReportStats.total > 0 ? (
        <div
          id="ska-violations-report-print"
          dir="rtl"
          lang="ar"
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            width: "210mm",
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <header className="mb-4 border-b border-slate-300 pb-3">
            <h1 className="text-xl font-bold text-slate-900">تقرير مخالفات المراقبة</h1>
            <p className="mt-1 text-xs text-slate-600">
              وقت التصدير: {formatSaudiDateTime(new Date())}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              نطاق التواريخ في التقرير: من {violationsReportFrom?.trim() || "—"} إلى{" "}
              {violationsReportTo?.trim() || "—"}
            </p>
          </header>
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">ملخص</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">إجمالي المخالفات</p>
                <p className="text-lg font-bold text-slate-900">{violationsReportStats.total}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">مفتوح</p>
                <p className="text-lg font-bold text-slate-900">{violationsReportStats.openCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">تمت المعالجة</p>
                <p className="text-lg font-bold text-slate-900">{violationsReportStats.resolvedCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[11px] text-slate-500">أكثر مخالفة تكرارًا</p>
                {violationsReportStats.topRepeated.count > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-slate-900">{violationsReportStats.topRepeated.label}</p>
                    <p className="text-[11px] text-slate-600">{violationsReportStats.topRepeated.count} مرة</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">لا توجد بيانات</p>
                )}
              </div>
            </div>
          </section>
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">المخالفات حسب النوع</h2>
            <table className="w-full border-collapse text-sm text-slate-900">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  <th className="px-2 py-2 text-start font-semibold">النوع</th>
                  <th className="px-2 py-2 text-start font-semibold">العدد</th>
                </tr>
              </thead>
              <tbody>
                {VIOLATION_REPORT_CATEGORY_ORDER.map((c) => (
                  <tr key={c.key} className="border-b border-slate-200">
                    <td className="px-2 py-1.5">{c.label}</td>
                    <td className="px-2 py-1.5 tabular-nums">{violationsReportStats.typeCounts[c.key]}</td>
                  </tr>
                ))}
                {violationsReportStats.typeCounts._other > 0 ? (
                  <tr className="border-b border-slate-200">
                    <td className="px-2 py-1.5">أخرى</td>
                    <td className="px-2 py-1.5 tabular-nums">{violationsReportStats.typeCounts._other}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">أحدث المخالفات (كل الأعمدة)</h2>
            <table className="w-full border-collapse text-xs text-slate-900">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100">
                  <th className="px-1 py-2 text-start font-semibold">النوع</th>
                  <th className="px-1 py-2 text-start font-semibold">التفاصيل</th>
                  <th className="px-1 py-2 text-start font-semibold">الحالة</th>
                  <th className="px-1 py-2 text-start font-semibold">الفرع</th>
                  <th className="px-1 py-2 text-start font-semibold">الكاميرا</th>
                  <th className="px-1 py-2 text-start font-semibold">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {violationsReportStats.latest.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 align-top">
                    <td className="px-1 py-1.5 font-medium">
                      {violationReportTypeLabel(row.type) || row.label_ar || row.type || "—"}
                    </td>
                    <td className="max-w-[12rem] px-1 py-1.5 break-words text-slate-700">{row.details || "—"}</td>
                    <td className="px-1 py-1.5 whitespace-nowrap">{monitoringAlertStatusAr(row.status)}</td>
                    <td className="px-1 py-1.5">{row.branch || "—"}</td>
                    <td className="px-1 py-1.5">{row.camera_name || "—"}</td>
                    <td className="px-1 py-1.5 whitespace-nowrap">{formatSaudiDateTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </div>
  );
}
