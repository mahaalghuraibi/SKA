import { useState } from "react";
import { isRenderableImageSrc } from "../../utils/dishHelpers.js";
import { IconDish } from "./icons.jsx";

export default function FoodImageThumb({ src, alt = "", sizeClass = "h-24 w-24" }) {
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
