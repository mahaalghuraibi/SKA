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
      className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand/50 to-brand-sky/40 text-center font-bold text-white ring-2 ring-white/15`}
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
