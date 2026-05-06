import Spinner from "./Spinner.jsx";

export default function DeleteConfirmModal({ deleteTarget, onCancel, onConfirm, isDeleting }) {
  if (!deleteTarget) return null;
  return (
    <div
      className="fixed inset-0 z-[185] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="max-h-[min(90dvh,28rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0F172A] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-lg font-bold text-white">تأكيد الحذف</h4>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          هل أنت متأكد من حذف السجل{" "}
          <span className="font-semibold text-brand-sky">{deleteTarget.label}</span>؟ لا يمكن التراجع عن
          هذا الإجراء.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => void onConfirm()}
            className="inline-flex items-center gap-2 rounded-xl border border-accent-red/50 bg-accent-red/20 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-accent-red/30 disabled:opacity-50"
          >
            {isDeleting ? <Spinner className="h-4 w-4 border-2 border-red-200/30 border-t-red-100" /> : null}
            حذف نهائي
          </button>
        </div>
      </div>
    </div>
  );
}
