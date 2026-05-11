import skaLogo from "../assets/images/ska-logo.png";
import { PLATFORM_BRAND } from "../constants/branding.js";

export default function SKALogo({ compact = false, className = "" }) {
  /** شعار + اسم المنصة ككتلة عنوان رابط: أحجام متناسقة، السطر الثانوي أوضح هرمياً. */
  const imageSizeClass = compact
    ? "h-9 w-auto max-h-10 max-w-[9.5rem] shrink-0 object-contain sm:h-10 sm:max-h-11 sm:max-w-[11rem]"
    : "h-11 w-auto max-h-12 max-w-[11.5rem] shrink-0 object-contain sm:h-12 sm:max-h-14 sm:max-w-[13.5rem] md:h-14 md:max-h-[56px] md:max-w-[15rem]";
  const titleSizeClass = compact
    ? "text-xs font-extrabold leading-snug text-white sm:text-sm"
    : "text-base font-extrabold leading-[1.2] tracking-tight text-white sm:text-lg md:text-xl";
  const subtitleClass = compact
    ? "text-[10px] leading-snug text-cyan-200/90 md:text-[11px]"
    : "mt-0.5 text-[11px] font-medium leading-snug text-cyan-200/88 sm:text-xs md:text-sm";

  return (
    <span
      className={`group inline-flex min-w-0 max-w-full items-center gap-2.5 sm:gap-3 transition duration-200 hover:drop-shadow-[0_0_14px_rgba(56,189,248,0.3)] ${className}`}
    >
      <img
        src={skaLogo}
        alt=""
        aria-hidden
        className={`${imageSizeClass} drop-shadow-[0_6px_18px_rgba(56,189,248,0.25)] transition duration-200 group-hover:drop-shadow-[0_8px_22px_rgba(56,189,248,0.42)]`}
        loading="eager"
        decoding="async"
      />
      <span className="flex min-w-0 flex-1 flex-col items-start justify-center text-start leading-none">
        <span className={titleSizeClass}>{PLATFORM_BRAND.nameAr}</span>
        <span className={subtitleClass}>{PLATFORM_BRAND.taglineAr}</span>
      </span>
    </span>
  );
}
