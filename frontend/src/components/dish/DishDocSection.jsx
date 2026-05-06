import Spinner from "../shared/Spinner.jsx";
import FoodImageThumb from "../shared/FoodImageThumb.jsx";
import CaptureModal from "./CaptureModal.jsx";
import DetectResultCard from "./DetectResultCard.jsx";

export default function DishDocSection({
  staffCount,
  selectedImage,
  selectedPreviewUrl,
  detecting,
  detectResult,
  manualDish,
  setManualDish,
  selectedAlternative,
  setSelectedAlternative,
  quantity,
  setQuantity,
  sourceEntity,
  setSourceEntity,
  saveLoading,
  dishNotice,
  captureModalOpen,
  videoRef,
  cameraLoading,
  cameraError,
  dishFileInputRef,
  onOpenCapture,
  onCloseCapture,
  onCapturePhoto,
  onFileSelected,
  onRetakeImage,
  onDetectDish,
  onSave,
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[rgba(15,23,42,0.72)] shadow-glass backdrop-blur-xl transition duration-300 hover:border-white/15 hover:shadow-glass-lg overflow-hidden p-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div>
          <h3 className="text-lg font-bold text-white">توثيق الأطباق</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            إجمالي المسجّل:{" "}
            <span className="font-semibold text-accent-green">{staffCount}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-3 py-1 text-xs font-medium text-brand-sky">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-sky" />
          مدعوم بالذكاء الاصطناعي
        </span>
      </div>

      {/* Step Flow Indicator */}
      <div className="border-b border-white/10 bg-[#060d1f]/60 px-4 py-3 sm:px-6">
        <div className="flex items-start">
          {[
            {
              num: 1,
              label: "التقاط الصورة",
              active: !selectedImage && !detecting,
              done: !!selectedImage || detecting,
            },
            {
              num: 2,
              label: "تحليل الذكاء الاصطناعي",
              active: detecting,
              done: !!selectedImage && !detecting,
            },
            {
              num: 3,
              label: "تأكيد وحفظ",
              active: !!selectedImage && !detecting,
              done: false,
            },
          ].map((step, i) => (
            <div key={step.num} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    step.active
                      ? "bg-brand-sky text-white shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                      : step.done
                      ? "bg-emerald-500 text-white"
                      : "bg-white/10 text-slate-500"
                  }`}
                >
                  {step.done && !step.active ? "✓" : step.num}
                </div>
                {i < 2 && (
                  <div
                    className={`h-px flex-1 transition ${step.done ? "bg-emerald-500/40" : "bg-white/10"}`}
                  />
                )}
              </div>
              <p
                className={`mt-1.5 text-center text-[10px] font-medium leading-tight ${
                  step.active
                    ? "text-brand-sky"
                    : step.done
                    ? "text-emerald-400"
                    : "text-slate-600"
                }`}
              >
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {/* Hidden file input */}
        <input
          ref={dishFileInputRef}
          type="file"
          accept="image/*"
          disabled={detecting || saveLoading}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (file) onFileSelected(file);
          }}
        />

        {/* Step 1: Camera button */}
        {!selectedImage && !detecting ? (
          <button
            type="button"
            disabled={saveLoading}
            onClick={onOpenCapture}
            className="w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-sky py-10 text-white shadow-xl shadow-brand/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex flex-col items-center gap-3">
              <span className="text-5xl leading-none" aria-hidden>📸</span>
              <span className="text-xl font-bold tracking-tight">التقاط صورة الطبق</span>
              <span className="text-sm text-white/70">اضغط لفتح الكاميرا</span>
            </div>
          </button>
        ) : null}

        {/* Step 2: Detecting spinner */}
        {detecting ? (
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-brand-sky/20 bg-brand-sky/5 py-14">
            <Spinner className="h-12 w-12 border-4 border-brand-sky/20 border-t-brand-sky" />
            <div className="text-center">
              <p className="text-base font-semibold text-brand-sky">جاري تحليل الصورة…</p>
              <p className="mt-1 text-sm text-slate-500">الذكاء الاصطناعي يتعرف على الطبق</p>
            </div>
          </div>
        ) : null}

        {/* Image preview + retake */}
        {selectedImage && !detecting ? (
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#060d1f]/80 p-4">
            <FoodImageThumb
              src={selectedPreviewUrl}
              alt="معاينة الطبق"
              sizeClass="h-20 w-20 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white" dir="auto">
                {selectedImage.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">الصورة جاهزة</p>
              <button
                type="button"
                disabled={saveLoading || detecting}
                onClick={onRetakeImage}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-brand-sky/40 hover:text-white disabled:opacity-40"
              >
                🔄 إعادة التقاط
              </button>
            </div>
          </div>
        ) : null}

        {/* Step 3A: AI result card */}
        {selectedImage && !detecting && detectResult ? (
          <DetectResultCard
            detectResult={detectResult}
            manualDish={manualDish}
            setManualDish={setManualDish}
            selectedAlternative={selectedAlternative}
            setSelectedAlternative={setSelectedAlternative}
            quantity={quantity}
            setQuantity={setQuantity}
            sourceEntity={sourceEntity}
            setSourceEntity={setSourceEntity}
            saveLoading={saveLoading}
            detecting={detecting}
            selectedImage={selectedImage}
            onSave={onSave}
            onReanalyze={() => onDetectDish(selectedImage, { preserveManual: true })}
          />
        ) : null}

        {/* Step 3B: No AI result (manual fallback) */}
        {selectedImage && !detecting && !detectResult ? (
          <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-950/25 p-5">
            <div className="flex items-start gap-3">
              <span className="shrink-0 text-xl leading-none" aria-hidden>⚠️</span>
              <div>
                <p className="font-semibold text-amber-100">التعرف التلقائي غير متاح</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-100/80">
                  يمكنك المتابعة يدويًا: اكتب اسم الطبق ثم اضغط «حفظ الطبق».
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400">اسم الطبق (مطلوب)</label>
              <input
                type="text"
                value={manualDish}
                onChange={(e) => setManualDish(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (saveLoading || detecting || !selectedImage) return;
                  e.preventDefault();
                  onSave();
                }}
                placeholder="مثال: كباب مشوي، مندي دجاج…"
                className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-brand-sky/60 focus:ring-2 focus:ring-brand-sky/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400">الكمية</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-4 py-3 text-sm text-slate-100 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400">المصدر</label>
                <input
                  type="text"
                  value={sourceEntity}
                  onChange={(e) => setSourceEntity(e.target.value)}
                  placeholder="بوفيه A"
                  className="w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-4 py-3 text-sm text-slate-100 outline-none"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onDetectDish(selectedImage, { preserveManual: true })}
                disabled={saveLoading}
                className="rounded-xl border border-brand-sky/40 bg-brand-sky/15 px-4 py-2.5 text-sm font-semibold text-brand-sky transition hover:bg-brand-sky/25 disabled:opacity-50"
              >
                إعادة محاولة التعرف
              </button>
              <button
                type="button"
                disabled={saveLoading || detecting || !selectedImage}
                onClick={onSave}
                className="flex-1 rounded-2xl bg-gradient-to-r from-brand to-brand-sky py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:brightness-110 disabled:opacity-50"
              >
                {saveLoading ? "جاري الحفظ…" : "حفظ الطبق"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Global notice */}
        {dishNotice ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              dishNotice.type === "error"
                ? "border-accent-red/40 bg-accent-red/10 text-red-200"
                : dishNotice.type === "success"
                ? "border-accent-green/40 bg-accent-green/10 text-green-200"
                : dishNotice.type === "warning"
                ? "border-accent-amber/45 bg-accent-amber/10 text-amber-100"
                : "border-brand-sky/35 bg-brand-sky/10 text-brand-sky"
            }`}
          >
            {dishNotice.text}
          </div>
        ) : null}
      </div>

      {/* Camera modal */}
      {captureModalOpen ? (
        <CaptureModal
          videoRef={videoRef}
          cameraLoading={cameraLoading}
          cameraError={cameraError}
          onClose={onCloseCapture}
          onCapture={onCapturePhoto}
        />
      ) : null}
    </article>
  );
}
