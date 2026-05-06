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
    <div className="border-b border-white/10 bg-[#060d1f]/60 px-4 py-3 sm:px-6">
      <div className="flex items-start">
        {steps.map((step, i) => (
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
                step.active ? "text-brand-sky" : step.done ? "text-emerald-400" : "text-slate-600"
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
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-brand-sky/20 bg-brand-sky/5 py-14">
      <Spinner className="h-12 w-12 border-4 border-brand-sky/20 border-t-brand-sky" />
      <div className="text-center">
        <p className="text-base font-semibold text-brand-sky">جاري تحليل الصورة…</p>
        <p className="mt-1 text-sm text-slate-500">الذكاء الاصطناعي يتعرف على الطبق</p>
      </div>
    </div>
  );
}
