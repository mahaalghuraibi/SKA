import Spinner from "../shared/Spinner.jsx";

export default function EditRecordModal({
  editingRecord,
  editForm,
  setEditForm,
  onCancel,
  onSave,
  isSaving,
}) {
  if (!editingRecord) return null;
  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onCancel();
      }}
    >
      <div
        className="max-h-[min(90dvh,28rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0F172A] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="text-lg font-bold text-white">تعديل السجل</h4>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs text-slate-400">اسم الطبق</label>
            <input
              type="text"
              value={editForm.label}
              onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">الكمية</label>
            <input
              type="number"
              min="1"
              value={editForm.quantity}
              onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">المصدر</label>
            <input
              type="text"
              value={editForm.source}
              onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#0B1327]/80 px-3 py-2 text-sm text-white outline-none focus:border-brand-sky/50"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void onSave()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? <Spinner className="h-4 w-4 border-2 border-white/30 border-t-white" /> : null}
            حفظ التعديلات
          </button>
        </div>
      </div>
    </div>
  );
}
