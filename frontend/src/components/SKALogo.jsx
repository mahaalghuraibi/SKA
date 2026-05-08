import skaLogo from "../assets/images/ska-logo.png";

export default function SKALogo({ compact = false, className = "" }) {
  const imageSizeClass = compact ? "h-[62px] md:h-[74px]" : "h-[62px] md:h-[84px]";
  const titleSizeClass = compact ? "text-base sm:text-lg" : "text-lg sm:text-xl";
  const subtitleClass = compact
    ? "text-[10px] md:text-xs"
    : "text-[11px] sm:text-xs";

  return (
    <span
      className={`group inline-flex min-w-0 items-center gap-2.5 transition duration-200 hover:drop-shadow-[0_0_14px_rgba(56,189,248,0.3)] ${className}`}
    >
      <img
        src={skaLogo}
        alt="SKA Smart Kitchen Analytics"
        className={`${imageSizeClass} w-auto max-w-none object-contain drop-shadow-[0_6px_18px_rgba(56,189,248,0.25)] transition duration-200 group-hover:drop-shadow-[0_8px_22px_rgba(56,189,248,0.42)]`}
        loading="eager"
        decoding="async"
      />
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className={`${titleSizeClass} font-extrabold tracking-[0.12em] text-white`}>SKA</span>
        <span className={`${subtitleClass} whitespace-nowrap font-medium uppercase tracking-[0.16em] text-cyan-300/95`}>
          Smart Kitchen Analytics
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-cyan-200/85 sm:text-[11px]">
          الرقابة والتوثيق الذكي للمطابخ
        </span>
      </span>
    </span>
  );
}
