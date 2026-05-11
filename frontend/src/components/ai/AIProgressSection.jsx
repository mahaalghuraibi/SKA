import Spinner from "../shared/Spinner.jsx";

/**
 * Staff dish doc: three-step progress strip (capture → AI analysis → confirm/save).
 * Display-only; parent owns selectedImage / detecting state.
 */
export default function AIProgressSection({ selectedImage, detecting }) {
  const steps = [
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
  ];
  return (
    <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(6,13,31,0.92)_0%,rgba(15,23,42,0.55)_100%)] px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-1">
        {steps.map((step, i) => (
          <div key={step.num} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  step.active
                    ? "bg-brand-sky text-white shadow-[0_0_14px_rgba(56,189,248,0.55)] ring-2 ring-brand-sky/30"
                    : step.done
                      ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(34,197,94,0.35)]"
                      : "bg-white/[0.08] text-slate-500 ring-1 ring-white/10"
                }`}
              >
                {step.done && !step.active ? "✓" : step.num}
              </div>
              {i < 2 ? (
                <div className="mx-1 h-[3px] min-h-[3px] flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      step.done ? "w-full bg-gradient-to-l from-emerald-500 to-brand-sky/90" : "w-0"
                    }`}
                  />
                </div>
              ) : null}
            </div>
            <p
              className={`mt-2 max-w-[6.5rem] text-center text-[10px] font-semibold leading-snug sm:max-w-none sm:text-[11px] ${
                step.active ? "text-brand-sky" : step.done ? "text-emerald-400/95" : "text-slate-500"
              }`}
            >
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline “analyzing image” panel shown while detecting is true. */
export function AIAnalyzingProgressPanel({ detecting }) {
  if (!detecting) return null;
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-brand-sky/25 bg-brand-sky/[0.07] py-14 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <Spinner className="h-12 w-12 border-4 border-brand-sky/20 border-t-brand-sky" />
      <div className="text-center">
        <p className="text-base font-semibold text-brand-sky">جاري تحليل الصورة…</p>
        <p className="mt-1 text-sm text-slate-500">الذكاء الاصطناعي يتعرف على الطبق</p>
      </div>
    </div>
  );
}
