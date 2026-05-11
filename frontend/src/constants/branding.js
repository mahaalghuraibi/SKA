/**
 * Production branding — منصة تعيين الجودة
 * Single source of truth for titles shown across nav, auth, dashboard, and HTML meta.
 */
export const PLATFORM_BRAND = {
  /** Primary Arabic product name */
  nameAr: "منصة تعيين الجودة",
  /** Subtitle / positioning line */
  taglineAr: "المنصة الذكية لمراقبة معايير الجودة في المطابخ",
  /** Short nav chip (optional) */
  nameShortAr: "تعيين الجودة",
  /** Browser title / meta */
  documentTitle: "منصة تعيين الجودة",
  /** Legacy English slug for asset alt text only */
  logoAlt: "منصة تعيين الجودة — شعار المنصة",
};

/** Tab titles for public & admin utility routes — unified platform title. */
export const PUBLIC_PAGE_TITLES = {
  home: PLATFORM_BRAND.nameAr,
  login: PLATFORM_BRAND.nameAr,
  signup: PLATFORM_BRAND.nameAr,
  adminRequest: PLATFORM_BRAND.nameAr,
  adminUsers: PLATFORM_BRAND.nameAr,
  adminRequests: PLATFORM_BRAND.nameAr,
};

export function dashboardTitleForRole(role) {
  if (role === "staff") return "توثيق وجودة الأطباق";
  if (role === "supervisor") return "لوحة مراقبة الجودة والتنبيهات";
  return "لوحة إدارة المنصة";
}
