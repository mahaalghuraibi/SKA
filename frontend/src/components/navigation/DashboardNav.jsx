import SKALogo from "../SKALogo.jsx";
import { useEffect, useState } from "react";

export default function DashboardNav({
  role,
  navLinks,
  activeStaffSection,
  activeSection,
  currentHash,
  mobileNavOpen,
  setMobileNavOpen,
  logout,
  dashboardTitle,
}) {
  const [liveHash, setLiveHash] = useState(
    currentHash || (typeof window !== "undefined" ? window.location.hash : "")
  );

  useEffect(() => {
    setLiveHash(currentHash || (typeof window !== "undefined" ? window.location.hash : ""));
  }, [currentHash]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncHash = () => setLiveHash(window.location.hash || "");
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    window.addEventListener("scroll", syncHash, { passive: true });
    let rafId = 0;
    const watchHash = () => {
      const h = window.location.hash || "";
      setLiveHash((prev) => (prev === h ? prev : h));
      rafId = window.requestAnimationFrame(watchHash);
    };
    rafId = window.requestAnimationFrame(watchHash);
    syncHash();
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
      window.removeEventListener("scroll", syncHash);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  const jumpToSection = (sectionId) => {
    if (!sectionId || typeof window === "undefined") return;
    const wantedHash = `#${sectionId}`;
    if (window.location.hash !== wantedHash) {
      window.location.hash = wantedHash;
      setLiveHash(wantedHash);
    }
    const scrollNow = () => {
      const el = document.getElementById(sectionId);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };
    if (scrollNow()) return;
    // If section mounts a bit later (async records), retry once.
    window.setTimeout(scrollNow, 90);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F172A]/90 shadow-[0_8px_30px_-18px_rgba(2,6,23,0.9)] backdrop-blur-xl supports-[backdrop-filter]:bg-[#0F172A]/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6 lg:px-8">
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
          <SKALogo className="inline-flex" />
          {role === "staff" ? null : (
            <span className="hidden rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-medium text-slate-300 md:inline-flex">
              {dashboardTitle}
            </span>
          )}
        </div>

        {/* Desktop nav links */}
        <nav className="hidden flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-2 lg:flex" aria-label="التنقل الرئيسي">
          {navLinks.map((item) => {
            const normalizeHash = (hash) => (hash === "#notifications" ? "#alerts" : hash);
            const wantedHash = item.sectionId ? normalizeHash(`#${item.sectionId}`) : "";
            const normalizedCurrentHash = normalizeHash(liveHash || "");
            const hashBasedMode = [
              "#analytics",
              "#cameras",
              "#reports",
              "#dish-reviews",
              "#alerts",
              "#employees",
              "#settings",
              "#section-dish-doc",
              "#section-search-filter",
              "#section-dish-records",
            ].includes(normalizedCurrentHash);
            const hashActive = wantedHash && normalizedCurrentHash === wantedHash;
            const sectionActive =
              item.sectionId != null
                ? role === "staff"
                  ? activeStaffSection === item.sectionId
                  : activeSection === item.sectionId
                : false;
            const isActive = hashBasedMode ? Boolean(hashActive) : Boolean(sectionActive);
            return (
              <a
                key={item.sectionId || item.href}
                href={item.href}
                onClick={(e) => {
                  if (item.sectionId) {
                    e.preventDefault();
                    jumpToSection(item.sectionId);
                  }
                }}
                aria-current={isActive ? "page" : undefined}
                className={`nav-tab whitespace-nowrap rounded-[10px] px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border border-[rgba(56,189,248,0.55)] bg-[rgba(59,130,246,0.15)] text-white shadow-[0_0_10px_rgba(56,189,248,0.2)]"
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
            className="min-h-[40px] rounded-xl border border-accent-red/35 bg-accent-red/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-accent-red/20 hover:text-white sm:px-3.5 sm:text-sm"
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
            const normalizeHash = (hash) => (hash === "#notifications" ? "#alerts" : hash);
            const wantedHash = item.sectionId ? normalizeHash(`#${item.sectionId}`) : "";
            const normalizedCurrentHash = normalizeHash(liveHash || "");
            const hashBasedMode = [
              "#analytics",
              "#cameras",
              "#reports",
              "#dish-reviews",
              "#alerts",
              "#employees",
              "#settings",
              "#section-dish-doc",
              "#section-search-filter",
              "#section-dish-records",
            ].includes(normalizedCurrentHash);
            const hashActive = wantedHash && normalizedCurrentHash === wantedHash;
            const sectionActive =
              item.sectionId != null
                ? role === "staff"
                  ? activeStaffSection === item.sectionId
                  : activeSection === item.sectionId
                : false;
            const isActive = hashBasedMode ? Boolean(hashActive) : Boolean(sectionActive);
            return (
              <a
                key={item.sectionId || item.href}
                href={item.href}
                onClick={(e) => {
                  if (item.sectionId) {
                    e.preventDefault();
                    jumpToSection(item.sectionId);
                  }
                  setMobileNavOpen(false);
                }}
                aria-current={isActive ? "page" : undefined}
                className={`nav-tab rounded-[10px] px-3 py-2 text-sm font-medium transition ${
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
