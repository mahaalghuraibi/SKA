import StaffProfileAvatar from "../shared/StaffProfileAvatar.jsx";
import { staffAvatarInitials } from "../../utils/avatarInitials.js";

export default function DashboardNav({
  role,
  navLinks,
  activeStaffSection,
  activeSection,
  mobileNavOpen,
  setMobileNavOpen,
  logout,
  dashboardTitle,
  staffMe,
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F172A]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0F172A]/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 lg:px-8">
        {/* Left: hamburger + avatar + title */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 text-slate-200 transition hover:border-brand-sky/40 hover:bg-white/5 lg:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="dashboard-mobile-nav"
            aria-label={mobileNavOpen ? "إغلاق القائمة" : "فتح القائمة"}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? (
              <span className="text-lg leading-none" aria-hidden>×</span>
            ) : (
              <span className="flex flex-col gap-1.5 p-0.5" aria-hidden>
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
              </span>
            )}
          </button>
          {role === "staff" ? (
            <StaffProfileAvatar
              imageUrl={staffMe?.avatar_url}
              initials={staffAvatarInitials(staffMe?.username, staffMe?.email)}
              sizeClass="h-9 w-9 sm:h-10 sm:w-10"
              textClass="text-xs sm:text-sm"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-sky text-xs font-bold text-white shadow-lg shadow-brand/30 sm:h-10 sm:w-10 sm:text-sm">
              S
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-white sm:text-base lg:text-lg">
              {dashboardTitle}
            </h1>
            <p className="hidden text-xs text-slate-500 xs:block">SKA Dashboard</p>
          </div>
        </div>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-3 lg:flex" aria-label="التنقل الرئيسي">
          {navLinks.map((item) => {
            const isActive =
              item.sectionId != null
                ? role === "staff"
                  ? activeStaffSection === item.sectionId
                  : activeSection === item.sectionId
                : false;
            return (
              <a
                key={item.sectionId || item.href}
                href={item.href}
                onClick={(e) => {
                  if (item.sectionId) {
                    e.preventDefault();
                    const wantedHash = `#${item.sectionId}`;
                    if (window.location.hash !== wantedHash) {
                      window.history.replaceState(null, "", wantedHash);
                    }
                    document
                      .getElementById(item.sectionId)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={`nav-tab whitespace-nowrap rounded-[12px] px-[18px] py-[10px] text-sm font-medium transition ${
                  isActive
                    ? "border border-[rgba(56,189,248,0.65)] bg-[rgba(59,130,246,0.18)] text-white shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                    : "border border-transparent bg-transparent text-[#aaa] hover:bg-[rgba(59,130,246,0.08)] hover:text-white"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span>{item.label}</span>
                  {item.emoji ? (
                    <span className="text-base leading-none opacity-90" aria-hidden>
                      {item.emoji}
                    </span>
                  ) : null}
                </span>
              </a>
            );
          })}
        </nav>

        {/* Right: logout */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={logout}
            className="min-h-[44px] rounded-xl border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-accent-red/20 hover:text-white sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">خروج</span>
            <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      <nav
        id="dashboard-mobile-nav"
        className={`border-t border-white/10 bg-[#0F172A]/95 lg:hidden ${mobileNavOpen ? "block" : "hidden"}`}
        aria-hidden={!mobileNavOpen}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-3 py-3 sm:px-6">
          {navLinks.map((item) => {
            const isActive =
              item.sectionId != null
                ? role === "staff"
                  ? activeStaffSection === item.sectionId
                  : activeSection === item.sectionId
                : false;
            return (
              <a
                key={item.sectionId || item.href}
                href={item.href}
                onClick={(e) => {
                  if (item.sectionId) {
                    e.preventDefault();
                    const wantedHash = `#${item.sectionId}`;
                    if (window.location.hash !== wantedHash) {
                      window.history.replaceState(null, "", wantedHash);
                    }
                    document
                      .getElementById(item.sectionId)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                  setMobileNavOpen(false);
                }}
                className={`nav-tab rounded-[12px] px-[18px] py-[10px] text-sm font-medium transition ${
                  isActive
                    ? "border border-[rgba(56,189,248,0.65)] bg-[rgba(59,130,246,0.18)] text-white shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                    : "border border-transparent bg-transparent text-[#aaa] hover:bg-[rgba(59,130,246,0.08)] hover:text-white"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.emoji ? (
                    <span className="text-lg leading-none opacity-90" aria-hidden>
                      {item.emoji}
                    </span>
                  ) : null}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
