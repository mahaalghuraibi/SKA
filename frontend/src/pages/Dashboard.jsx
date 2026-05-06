import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ACCESS_TOKEN_KEY, CURRENT_USER_ME_URLS, USER_INFO_KEY, USER_ROLE_KEY } from "../constants.js";
import { dishSaveErrorMessage } from "../utils/apiError.js";
import { formatConfidencePercentDisplay } from "../utils/confidence.js";
import { detectDish, UNKNOWN_DISH_TEXT } from "../services/detectDishService.js";
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
};

const SUPERVISOR_HASH_TO_SECTION = {
  "#analytics": SUPERVISOR_SECTION_IDS.analytics,
  "#cameras": SUPERVISOR_SECTION_IDS.cameras,
  "#alerts": SUPERVISOR_SECTION_IDS.alerts,
  "#dish-reviews": SUPERVISOR_SECTION_IDS.reviews,
  "#reports": SUPERVISOR_SECTION_IDS.reports,
  "#employees": SUPERVISOR_SECTION_IDS.employees,
};

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

const DISHES_URL = "/api/v1/dishes";
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
  if (s === "resolved") return "تمت المعالجة";
  return status || "—";
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
  const navigate = useNavigate();
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
  const [role, setRole] = useState(localStorage.getItem(USER_ROLE_KEY) || "");
  const [staffRecords, setStaffRecords] = useState([]);
  const [staffRecordsLoading, setStaffRecordsLoading] = useState(false);
  const [staffRecordsLastUpdated, setStaffRecordsLastUpdated] = useState("");
  const [staffCount, setStaffCount] = useState(0);
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
  const [saveLoading, setSaveLoading] = useState(false);
  const [dishNotice, setDishNotice] = useState(null);
  const [toast, setToast] = useState(null);
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
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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
  const [alertsList, setAlertsList] = useState([]);
  const [cameraTestFile, setCameraTestFile] = useState(null);
  const [cameraTestPreviewUrl, setCameraTestPreviewUrl] = useState("");
  const [newCameraForm, setNewCameraForm] = useState({ name: "", location: "", stream_url: "" });
  const [monitoringAnalysisResult, setMonitoringAnalysisResult] = useState(null);
  const [monitoringAnalyzeLoading, setMonitoringAnalyzeLoading] = useState(false);
  const [monitoringLastAnalyzedAt, setMonitoringLastAnalyzedAt] = useState(null);
  const [monitoringCameraSelectId, setMonitoringCameraSelectId] = useState("");
  const [monitoringResolveLoadingId, setMonitoringResolveLoadingId] = useState(null);

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
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

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
  }, []);

  useEffect(() => {
    if (role !== "staff") return undefined;
    const fromHash = staffSectionFromHash(window.location.hash);
    if (fromHash) setActiveStaffSection(fromHash);
    const nodes = [
      staffDocSectionRef.current,
      staffSearchSectionRef.current,
      staffRecordsSectionRef.current,
    ].filter(Boolean);
    if (nodes.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.target.id)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          const id = visible[0].target.id;
          setActiveStaffSection(id);
          const wantedHash = `#${id}`;
          if (window.location.hash !== wantedHash) {
            window.history.replaceState(null, "", wantedHash);
          }
        }
      },
      { root: null, rootMargin: "-28% 0px -52% 0px", threshold: [0, 0.08, 0.15, 0.25, 0.4] },
    );
    nodes.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [role]);

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
  }, [role]);

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
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
  }, []);

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

  useEffect(() => {
    const localRole = localStorage.getItem(USER_ROLE_KEY);
    if (localRole) {
      setRole(localRole);
      return;
    }

    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;

    (async () => {
      for (const url of CURRENT_USER_ME_URLS) {
        try {
          const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          const body = await r.json().catch(() => ({}));
          if (r.ok && body?.role) {
            localStorage.setItem(USER_ROLE_KEY, body.role);
            setRole(body.role);
            return;
          }
        } catch {
          /* try next */
        }
      }
    })();
  }, []);

  function logout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    navigate("/login", { replace: true });
  }

  function handleProtectedAuthFailure(status, detail) {
    if (status === 401) {
      setToast({ type: "error", text: "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى" });
      logout();
      return true;
    }
    if (status === 403) {
      setToast({ type: "error", text: "ليس لديك صلاحية للوصول لهذه الصفحة" });
      return true;
    }
    if (typeof detail === "string" && detail.includes("لم يتم تحديد الفرع")) {
      setToast({ type: "error", text: "لم يتم تحديد الفرع لهذا الحساب" });
      return true;
    }
    return false;
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
        { href: "#dish-reviews", label: "مراجعة الأطباق", sectionId: SUPERVISOR_SECTION_IDS.reviews },
        { href: "#reports", label: "التقارير", sectionId: SUPERVISOR_SECTION_IDS.reports },
        { href: "#employees", label: "الموظفين", sectionId: SUPERVISOR_SECTION_IDS.employees },
      ];
    }
    return [
      { href: "#analytics", label: "التحليلات", sectionId: SUPERVISOR_SECTION_IDS.analytics },
      { href: "#alerts", label: "التنبيهات", sectionId: SUPERVISOR_SECTION_IDS.alerts },
      { href: "#cameras", label: "الكاميرات", sectionId: SUPERVISOR_SECTION_IDS.cameras },
      { href: "#dish-reviews", label: "مراجعة الأطباق", sectionId: SUPERVISOR_SECTION_IDS.reviews },
      { href: "#reports", label: "التقارير", sectionId: SUPERVISOR_SECTION_IDS.reports },
      { href: "#employees", label: "الموظفين", sectionId: SUPERVISOR_SECTION_IDS.employees },
    ];
  }, [role]);

  const supervisorCards = useMemo(
    () => {
      const loading = supervisorSummaryLoading;
      const numOrZero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
      const qualityScore = numOrZero(supervisorSummary?.quality_score ?? supervisorSummary?.compliance_rate);
      const alertsCount = numOrZero(supervisorSummary?.alerts_count);
      const violationsCount = numOrZero(supervisorSummary?.violations_count);
      const dishesCount = numOrZero(supervisorSummary?.dishes_count ?? supervisorSummary?.dishes_today);
      const valueText = (n) => (loading ? "..." : String(n));
      const valueClass = (n, isAlert = false) => {
        if (loading) return "text-white";
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

  const loadSupervisorSummary = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
  }, [role]);

  const loadSupervisorEmployees = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
  }, [role, employeeFilters]);

  const loadSupervisorReviews = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
  }, [role, reviewFilters]);

  const loadSupervisorCameras = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
    setCameraCardsLoading(true);
    try {
      const res = await fetch(SUPERVISOR_CAMERAS_URL, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => []);
      if (handleProtectedAuthFailure(res.status, body?.detail)) {
        setCameraCards([]);
        return;
      }
      if (!res.ok || !Array.isArray(body)) {
        setCameraCards([]);
        return;
      }
      setCameraCards(body);
    } finally {
      setCameraCardsLoading(false);
    }
  }, [role]);

  const loadSupervisorAlerts = useCallback(async () => {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
    try {
      const res = await fetch(SUPERVISOR_ALERTS_URL, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => []);
      if (handleProtectedAuthFailure(res.status, body?.detail)) {
        setAlertsList([]);
        return;
      }
      if (!res.ok || !Array.isArray(body)) {
        setAlertsList([]);
        return;
      }
      setAlertsList(body);
    } catch {
      setAlertsList([]);
    }
  }, [role]);

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

  async function approveReviewRecord(record) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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

  async function analyzeMonitoringFrameUpload() {
    if (!(role === "supervisor" || role === "admin")) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token || !cameraTestFile) {
      setToast({ type: "error", text: "يرجى اختيار صورة للتحليل." });
      return;
    }
    setMonitoringAnalyzeLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", cameraTestFile);
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
      if (handleProtectedAuthFailure(res.status, body?.detail)) return;
      if (res.status === 503) {
        setToast({
          type: "error",
          text:
            typeof body?.detail === "string" && body.detail.trim()
              ? body.detail
              : "تعذر تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي أو فعّل وضع التجريبي.",
        });
        return;
      }
      if (res.status === 400) {
        setToast({ type: "error", text: "الصورة غير صالحة." });
        return;
      }
      if (!res.ok) {
        setToast({ type: "error", text: "فشل تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي." });
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
    } catch {
      setToast({ type: "error", text: "فشل تحليل الصورة. تحقق من إعدادات الذكاء الاصطناعي." });
    } finally {
      setMonitoringAnalyzeLoading(false);
    }
  }

  async function resolveMonitoringAlert(alertId) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
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

  const reloadStaffDishes = useCallback(async () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
    setStaffRecordsLoading(true);
    try {
      const res = await fetch(DISHES_URL, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) return;
      committedBlobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      committedBlobUrlsRef.current.clear();
      const mapped = data.map((row) => toStaffRecord(row));
      setStaffRecords(mapped);
      setStaffCount(mapped.length);
      setStaffRecordsLastUpdated(formatSaudiTimeLine(new Date()));
    } catch {
      /* ignore */
    } finally {
      setStaffRecordsLoading(false);
    }
  }, []);

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

  async function handleDetectDish(file, opts = {}) {
    const preserveManual = Boolean(opts.preserveManual);
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token || !file) return;
    setDetecting(true);
    setDishNotice({ type: "info", text: "جاري تحليل الصورة باستخدام الذكاء الاصطناعي..." });
    setDetectResult(null);
    setSelectedAlternative("");
    if (!preserveManual) setManualDish("");
    try {
      const result = await detectDish(token, file);
      if (!result.ok) {
        console.error("detect-dish failed:", { status: result.status, body: result.body });
        if (result.status === 401) {
          setDishNotice({ type: "error", text: "انتهت الجلسة — سجّل الدخول مجددًا ثم أعد المحاولة." });
        } else {
          setDishNotice({ type: "error", text: "تعذر التعرف على الطبق، يرجى الاختيار يدويًا" });
        }
        return;
      }
      const normalized = result.normalized;
      const autofillDishName =
        normalized.suggestions[0]?.name ||
        (normalized.detected === UNKNOWN_DISH_TEXT && normalized.suggestedName
          ? normalized.suggestedName
          : normalized.alternatives[0] || normalized.detected);
      setDetectResult(normalized);
      const skipAutofill = normalized.proteinConflict || normalized.needsReviewLowConf;
      if (skipAutofill) {
        setSelectedAlternative("");
        setManualDish("");
        setDishNotice({
          type: "warning",
          text: normalized.proteinConflict
            ? "تعارض بين الاقتراحات (مثل سمك ولحم أو سمك ودجاج). اختر أحد الخيارات أو اكتب الاسم يدويًا — لم يُملأ الحقل تلقائيًا."
            : "ثقة الاقتراح أقل من 75%. اختر أحد الخيارات أو اكتب اسم الطبق يدويًا — لم يُملأ الحقل تلقائيًا.",
        });
      } else {
        setSelectedAlternative(autofillDishName);
        setManualDish(autofillDishName);
        setDishNotice({
          type: "success",
          text: `تم التعرف على الطبق: ${autofillDishName}`,
        });
      }
    } catch (err) {
      console.error("detect-dish request error:", err);
      setDishNotice({ type: "error", text: "تعذر التعرف على الطبق، يرجى الاختيار يدويًا" });
    } finally {
      setDetecting(false);
    }
  }

  async function submitDishRecord() {
    if (!selectedImage) {
      setDishNotice({ type: "error", text: "يرجى رفع صورة أولًا." });
      return;
    }
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
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
    setSaveLoading(true);
    setDishNotice(null);
    try {
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
      const payload = {
        image_url: imageDataUrl,
        predicted_label: predictedFromAi.slice(0, 255),
        confirmed_label: confirmed.slice(0, 255),
        quantity: positiveIntQuantity(quantity),
        source_entity: (sourceEntity.trim() || "غير محدد").slice(0, 100),
        employee_id: staffMe?.id ?? null,
        employee_name: staffMe?.full_name || staffMe?.username || staffMe?.email || null,
        employee_email: staffMe?.email || null,
        branch_id: staffMe?.branch_id ?? 1,
        branch_name: staffMe?.branch_name || "فرع تجريبي",
        // ISO UTC — satisfies strict APIs; current backend overwrites with server time.
        recorded_at: new Date().toISOString(),
      };
      const res = await fetch(DISHES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[dish save] failed", { status: res.status, payload, responseBody: data });
        setDishNotice({ type: "error", text: dishSaveErrorMessage(res.status, data) });
        return;
      }
      setToast({
        type: "success",
        text: "تم حفظ الطبق وإرساله للمراجعة",
      });
      setDishNotice(null);
      const savedId = data?.id;
      await reloadStaffDishes();
      if (savedId != null) {
        setHighlightRawId(savedId);
        requestAnimationFrame(() => {
          document.getElementById(`dish-row-${savedId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
      setSelectedImage(null);
      setDetectResult(null);
      setSelectedAlternative("");
      setManualDish("");
      setQuantity(1);
      setSourceEntity("");
    } catch (err) {
      console.error("[dish save] network or parse error", err);
      setDishNotice({
        type: "error",
        text: "تعذر الاتصال بالخادم أو قراءة الاستجابة. تحقق من تشغيل الـ backend والشبكة.",
      });
    } finally {
      setSaveLoading(false);
    }
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
    if (!editingRecord) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
    setEditSaving(true);
    try {
      const res = await fetch(`${DISHES_URL}/${editingRecord.rawId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          confirmed_label: editForm.label.trim().slice(0, 255),
          quantity: positiveIntQuantity(editForm.quantity),
          source_entity: (editForm.source.trim() || "غير محدد").slice(0, 100),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ type: "error", text: dishSaveErrorMessage(res.status, body) });
        return;
      }
      const updated = toStaffRecord(body, {
        localPreviewUrl: editingRecord.localPreviewUrl,
        confidenceRatio: editingRecord.confidenceRatio,
      });
      setStaffRecords((prev) => prev.map((r) => (r.rawId === updated.rawId ? updated : r)));
      setToast({ type: "success", text: "تم تحديث السجل." });
      setEditingRecord(null);
    } catch {
      setToast({ type: "error", text: "تعذر تحديث السجل." });
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDeleteRecord(recordOverride) {
    const target = recordOverride ?? deleteTarget;
    if (!target) return;
    if (target.reviewStatus === "approved") return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${DISHES_URL}/${target.rawId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setToast({ type: "error", text: dishSaveErrorMessage(res.status, body) });
        return;
      }
      if (target.localPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.localPreviewUrl);
        committedBlobUrlsRef.current.delete(target.localPreviewUrl);
      }
      setStaffRecords((prev) => prev.filter((r) => r.rawId !== target.rawId));
      setStaffCount((c) => Math.max(0, c - 1));
      setToast({ type: "success", text: "تم حذف السجل." });
      setDeleteTarget(null);
    } catch {
      setToast({ type: "error", text: "تعذر حذف السجل." });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-slate-100" dir="rtl">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(37,99,235,0.12),transparent)]" />

      <DashboardNav
        role={role}
        navLinks={navLinks}
        activeStaffSection={activeStaffSection}
        activeSection={activeSection}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        logout={logout}
        dashboardTitle={dashboardTitle}
        staffMe={staffMe}
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
                {role === "supervisor" ? (
                  <p className="mt-2 text-sm text-slate-300">الفرع: {supervisorSummary?.branch_name || "فرع تجريبي"}</p>
                ) : null}
              </div>
              {!hasMonitoringData ? (
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-3 py-1 text-xs font-medium text-brand-sky">
                  <span className="h-2 w-2 rounded-full bg-brand-sky" />
                  بيانات تجريبية
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
            <div className="sticky top-16 z-30 mb-4 rounded-xl border border-brand-sky/25 bg-[#0F172A]/80 px-3 py-2 text-xs text-sky-100 backdrop-blur">
              القسم الحالي: {navLinks.find((n) => n.sectionId === activeSection)?.label || "التحليلات"}
            </div>

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
            </section>

            <section id="alerts" ref={supervisorAlertsRef} className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 border-b border-white/10 pb-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <IconBell className="h-5 w-5 text-accent-amber" />
                  آخر التنبيهات
                </h3>
              </div>
              {alertsList.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {alertsList.slice(0, 8).map((a) => (
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
            </section>

            <section id="cameras" ref={supervisorCamerasRef} className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-white">الكاميرات</h3>
                <p className="mt-1 text-xs text-slate-400">
                  تحليل صور السلامة للمشرفين فقط.{" "}
                  {/* TODO: الوضع المستمر لاحقاً — التقاط إطار كل 2–3 ثوانٍ وتحليله تلقائياً (24/7). */}
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
                  <p className="mb-2 text-sm font-semibold text-white">مراقبة بالذكاء الاصطناعي (صورة)</p>
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
                  <div className="flex flex-wrap gap-2">
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
                    <button
                      type="button"
                      disabled
                      title="TODO: الوضع المستمر لاحقاً — إطار كل 2–3 ثوانٍ"
                      className="rounded-xl border border-white/15 bg-[#0B1327]/60 px-4 py-2 text-xs text-slate-500"
                    >
                      تشغيل الكاميرا المباشرة
                    </button>
                  </div>
                  {monitoringLastAnalyzedAt ? (
                    <p className="mt-2 text-[11px] text-slate-500">
                      آخر تحليل: {formatSaudiDateTime(monitoringLastAnalyzedAt)}
                    </p>
                  ) : null}
                </div>

                {monitoringAnalysisResult && Array.isArray(monitoringAnalysisResult.checks) ? (
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

                {cameraCardsLoading ? (
                  <p className="text-sm text-slate-400">جاري تحميل الكاميرات...</p>
                ) : cameraCards.length === 0 ? (
                  <p className="text-sm text-slate-400">لا توجد كاميرات مضافة بعد.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400">حالة الكاميرات</p>
                    {cameraCards.map((c) => (
                      <article key={c.id} className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3 text-xs text-slate-200">
                        <p className="font-semibold text-white">{c.name}</p>
                        <p>الموقع: {c.location}</p>
                        <p>الاتصال: {c.is_connected ? "متصل" : "غير متصل"}</p>
                        <p>الذكاء الاصطناعي: {c.ai_enabled ? "مفعّل" : "غير مفعّل"}</p>
                        <p>آخر تحليل: {c.last_analysis_at ? formatSaudiDateTime(c.last_analysis_at) : "لا يوجد"}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-white">نظرة عامة على الأداء</h3>
              </div>
              {supervisorSummaryLoading ? (
                <div className="rounded-xl border border-white/10 bg-[#020617]/60 px-4 py-10 text-center text-sm text-slate-400">
                  جاري تحميل البيانات...
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
              <div className="mb-4 border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-white">التقارير</h3>
              </div>
                  {supervisorSummary ? (
                    <div className="grid gap-3">
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
                    <p className="text-sm text-slate-400">لا توجد بيانات كافية</p>
                  )}
            </section>

            <section id="dish-reviews" ref={supervisorReviewsRef} className={`${glassCard} mb-8 p-5`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">مراجعة الأطباق</h3>
                  <p className="text-sm text-slate-400">اعتماد أو رفض سجلات الأطباق مع تتبع سجل المراجعة.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadSupervisorReviews()}
                  className="rounded-xl border border-brand-sky/35 bg-brand/15 px-3 py-2 text-xs font-semibold text-brand-sky transition hover:bg-brand/25"
                >
                  تحديث
                </button>
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
                <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 px-3 py-8 text-center text-sm text-slate-400">
                  جاري تحميل سجلات المراجعة...
                </div>
              ) : reviewRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/60 px-3 py-8 text-center text-sm text-slate-400">
                  لا توجد أطباق تحتاج مراجعة حاليًا
                </div>
              ) : (
                <div className="space-y-4">
                  {reviewRecords.map((r) => {
                    const conf = Number(r.ai_confidence);
                    const confText = displayAiConfidence(conf);
                    const badge =
                      r.status === "approved"
                        ? "border-accent-green/45 bg-accent-green/15 text-emerald-200"
                        : r.status === "rejected"
                          ? "border-accent-red/45 bg-accent-red/15 text-red-100"
                          : "border-accent-amber/45 bg-accent-amber/15 text-amber-100";
                    const suggestions = Array.isArray(r.ai_suggestions) ? r.ai_suggestions.slice(0, 3) : [];
                    return (
                      <article key={r.id} className="rounded-2xl border border-white/10 bg-[#060d1f]/85 p-4 sm:p-5">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
                          <FoodImageThumb src={r.image_url} alt={r.confirmed_label || r.predicted_label || "dish"} sizeClass="h-28 w-28 shrink-0 sm:h-32 sm:w-32" />
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge}`}>
                                {supervisorStatusText(r.status)}
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
                <div className="rounded-xl border border-white/10 bg-[#0B1327]/70 px-3 py-8 text-center text-sm text-slate-400">
                  جاري تحميل بيانات الموظفين...
                </div>
              ) : supervisorEmployees.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#0B1327]/60 px-3 py-8 text-center text-sm text-slate-400">
                  لا توجد بيانات كافية
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {supervisorEmployees.map((e) => (
                    <article key={e.id} className="rounded-xl border border-white/10 bg-[#0B1327]/70 p-3">
                      <p className="font-semibold text-white">
                        {e.full_name || e.username}
                        <span className="ms-2 text-xs font-normal text-slate-400">({e.branch_name || "فرع تجريبي"})</span>
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

            {role === "admin" ? (
              <section id="settings" className={`${glassCard} mt-6`}>
                <h3 className="mb-2 text-lg font-bold text-white">إعدادات النظام</h3>
                <p className="text-sm text-slate-400">
                  إعدادات النظام متاحة فقط لمدير النظام.
                </p>
              </section>
            ) : null}
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
  );
}
