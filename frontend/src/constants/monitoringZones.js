/**
 * Fixed monitoring zones for the smart-kitchen CCTV dashboard (UI only).
 * Matches API cameras by name/location substring when possible; otherwise shows synthetic CAM-xx panels.
 */

export const MONITORING_ZONE_DEFINITIONS = [
  {
    id: "kitchen",
    camCode: "CAM-01",
    zoneAr: "منطقة المطبخ",
    zoneEn: "Main Kitchen",
    /** Restaurant-facing title (CCTV card) */
    ownerTitleAr: "كاميرا المطبخ الرئيسية",
    displayNameAr: "كاميرا المطبخ الرئيسية",
    match: (cam) => {
      const s = `${cam?.name || ""} ${cam?.location || ""}`.toLowerCase();
      return /kitchen|مطبخ|طبخ|طباخ/i.test(s);
    },
  },
  {
    id: "storage",
    camCode: "CAM-02",
    zoneAr: "منطقة التخزين",
    zoneEn: "Storage Area",
    ownerTitleAr: "كاميرا منطقة التخزين",
    displayNameAr: "كاميرا التخزين",
    match: (cam) => {
      const s = `${cam?.name || ""} ${cam?.location || ""}`.toLowerCase();
      return /storage|store|تخزين|مخزن/i.test(s);
    },
  },
  {
    id: "prep",
    camCode: "CAM-03",
    zoneAr: "منطقة تحضير الطعام",
    zoneEn: "Food Preparation Area",
    ownerTitleAr: "كاميرا منطقة تحضير الطعام",
    displayNameAr: "كاميرا التحضير",
    match: (cam) => {
      const s = `${cam?.name || ""} ${cam?.location || ""}`.toLowerCase();
      return /prep|تحضير|preparation|food prep|جاهز/i.test(s);
    },
  },
];

export function findCameraForZone(zone, cameras) {
  const list = Array.isArray(cameras) ? cameras : [];
  return list.find((c) => zone.match(c)) || null;
}

function alertMatchesZone(zone, alert) {
  const fakeCam = {
    name: String(alert?.camera_name || ""),
    location: String(alert?.location || ""),
  };
  return zone.match(fakeCam);
}

/** Alerts whose stored camera name / location match this zone heuristic */
export function alertsForZone(zone, alerts) {
  const list = Array.isArray(alerts) ? alerts : [];
  return list.filter((a) => alertMatchesZone(zone, a));
}

export function todayIsoDateLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isAlertToday(alert, ymdToday) {
  const raw = alert?.created_at || alert?.createdAt;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === ymdToday;
}
