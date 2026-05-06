import Spinner from "../shared/Spinner.jsx";

export default function CaptureModal({
  videoRef,
  cameraLoading,
  cameraError,
  onClose,
  onCapture,
}) {
  return (
    <div
      className="fixed inset-0 z-[195] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <h4 className="text-lg font-bold text-white">📸 التقاط صورة الطبق</h4>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#020617]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full object-cover"
            />
          </div>
          {cameraError ? (
            <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-red-100">
              {cameraError}
            </div>
          ) : null}
          {cameraLoading ? (
            <div className="inline-flex items-center gap-2 text-sm text-brand-sky">
              <Spinner className="h-4 w-4 border-2 border-brand-sky/30 border-t-brand-sky" />
              <span>جاري تشغيل الكاميرا…</span>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              إغلاق
            </button>
            <button
              type="button"
              disabled={cameraLoading}
              onClick={onCapture}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
            >
              <span>التقاط الصورة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
