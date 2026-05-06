export default function Toast({ toast }) {
  if (!toast) return null;
  const colorClass =
    toast.type === "success"
      ? "border-accent-green/40 bg-emerald-950/90 text-emerald-100"
      : toast.type === "error"
        ? "border-accent-red/40 bg-red-950/90 text-red-100"
        : "border-brand-sky/40 bg-[#0B1327]/95 text-brand-sky";
  return (
    <div
      className={`pointer-events-none fixed start-3 end-3 top-20 z-[200] rounded-xl border px-3 py-3 text-sm font-medium shadow-xl backdrop-blur-md sm:start-4 sm:end-auto sm:top-24 sm:max-w-sm ${colorClass}`}
      role="status"
    >
      {toast.text}
    </div>
  );
}
