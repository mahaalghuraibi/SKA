import { useEffect, useState } from "react";
import { isRenderableImageSrc } from "../../utils/dishHelpers.js";

export default function StaffProfileAvatar({
  imageUrl,
  initials,
  sizeClass = "h-11 w-11",
  textClass = "text-sm",
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);
  const show = isRenderableImageSrc(imageUrl) && !failed;
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d4ed8]/90 via-brand/80 to-sky-500/70 text-center font-bold text-white shadow-[0_12px_40px_-12px_rgba(37,99,235,0.5)] ring-2 ring-white/25`}
      aria-hidden={show}
    >
      {show ? (
        <img
          alt=""
          src={imageUrl}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span dir="auto" className={`px-0.5 ${textClass} leading-none`}>
          {initials}
        </span>
      )}
    </div>
  );
}
