import { useCallback, useState } from "react";
import { deleteDishRecord, fetchDishRecords, saveDishRecord, updateDishRecord } from "../services/dishRecordService.js";

export function useDishRecords({
  accessTokenKey,
  committedBlobUrlsRef,
  toStaffRecord,
  formatSaudiTimeLine,
  dishSaveErrorMessage,
  setToast,
  setDishNotice,
  setHighlightRawId,
  setEditingRecord,
  setDeleteTarget,
}) {
  const [staffRecords, setStaffRecords] = useState([]);
  const [staffRecordsLoading, setStaffRecordsLoading] = useState(false);
  const [staffRecordsLastUpdated, setStaffRecordsLastUpdated] = useState("");
  const [staffCount, setStaffCount] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const reloadStaffDishes = useCallback(async () => {
    const token = localStorage.getItem(accessTokenKey);
    if (!token) return;
    setStaffRecordsLoading(true);
    try {
      const result = await fetchDishRecords({ token });
      if (!result.ok) return;
      committedBlobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      committedBlobUrlsRef.current.clear();
      const mapped = result.data.map((row) => toStaffRecord(row));
      setStaffRecords(mapped);
      setStaffCount(mapped.length);
      setStaffRecordsLastUpdated(formatSaudiTimeLine(new Date()));
    } catch {
      /* ignore */
    } finally {
      setStaffRecordsLoading(false);
    }
  }, [accessTokenKey, committedBlobUrlsRef, formatSaudiTimeLine, toStaffRecord]);

  const saveDishEntry = useCallback(
    async ({
      imageDataUrl,
      predictedFromAi,
      confirmed,
      quantityValue,
      sourceEntity,
      staffMe,
      onSaved,
      onNetworkError,
    }) => {
      const token = localStorage.getItem(accessTokenKey);
      if (!token) return;
      setSaveLoading(true);
      setDishNotice(null);
      try {
        const saveResult = await saveDishRecord({
          token,
          imageDataUrl,
          predictedFromAi,
          confirmed,
          quantityValue,
          sourceEntity,
          staffMe,
        });
        if (!saveResult.ok) {
          console.error("[dish save] failed", {
            status: saveResult.status,
            payload: saveResult.payload,
            responseBody: saveResult.body,
          });
          setDishNotice({ type: "error", text: dishSaveErrorMessage(saveResult.status, saveResult.body) });
          return;
        }
        setToast({
          type: "success",
          text: "تم حفظ الطبق وإرساله للمراجعة",
        });
        setDishNotice(null);
        const savedId = saveResult.data?.id;
        await reloadStaffDishes();
        if (savedId != null) {
          setHighlightRawId(savedId);
          requestAnimationFrame(() => {
            document.getElementById(`dish-row-${savedId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          });
        }
        if (typeof onSaved === "function") onSaved();
      } catch (err) {
        if (typeof onNetworkError === "function") {
          onNetworkError(err);
        }
      } finally {
        setSaveLoading(false);
      }
    },
    [
      accessTokenKey,
      dishSaveErrorMessage,
      reloadStaffDishes,
      setDishNotice,
      setHighlightRawId,
      setToast,
    ]
  );

  const saveEditedDishRecord = useCallback(
    async ({ editingRecord, editForm, quantityValue }) => {
      if (!editingRecord) return;
      const token = localStorage.getItem(accessTokenKey);
      if (!token) return;
      setEditSaving(true);
      try {
        const result = await updateDishRecord({
          token,
          rawId: editingRecord.rawId,
          confirmedLabel: editForm.label,
          quantityValue,
          sourceEntity: editForm.source,
        });
        if (!result.ok) {
          setToast({ type: "error", text: dishSaveErrorMessage(result.status, result.body) });
          return;
        }
        const updated = toStaffRecord(result.body, {
          localPreviewUrl: editingRecord.localPreviewUrl,
          confidenceRatio: editingRecord.confidenceRatio,
        });
        setStaffRecords((prev) => prev.map((r) => (r.rawId === updated.rawId ? updated : r)));
        setToast({ type: "success", text: "تم تحديث السجل." });
        setEditingRecord(null);
      } catch {
        setToast({ type: "error", text: "تعذر تحديث السجل." });
      } finally {
        setEditSaving(false);
      }
    },
    [accessTokenKey, dishSaveErrorMessage, setEditingRecord, setToast, toStaffRecord]
  );

  const confirmDeleteDishRecord = useCallback(
    async ({ recordOverride, deleteTarget }) => {
      const target = recordOverride ?? deleteTarget;
      if (!target) return;
      if (target.reviewStatus === "approved") return;
      const token = localStorage.getItem(accessTokenKey);
      if (!token) return;
      setDeleteLoading(true);
      try {
        const result = await deleteDishRecord({ token, rawId: target.rawId });
        if (!result.ok) {
          setToast({ type: "error", text: dishSaveErrorMessage(result.status, result.body) });
          return;
        }
        if (target.localPreviewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(target.localPreviewUrl);
          committedBlobUrlsRef.current.delete(target.localPreviewUrl);
        }
        setStaffRecords((prev) => prev.filter((r) => r.rawId !== target.rawId));
        setStaffCount((c) => Math.max(0, c - 1));
        setToast({ type: "success", text: "تم حذف السجل." });
        setDeleteTarget(null);
      } catch {
        setToast({ type: "error", text: "تعذر حذف السجل." });
      } finally {
        setDeleteLoading(false);
      }
    },
    [accessTokenKey, committedBlobUrlsRef, dishSaveErrorMessage, setDeleteTarget, setToast]
  );

  return {
    staffRecords,
    staffRecordsLoading,
    staffRecordsLastUpdated,
    staffCount,
    saveLoading,
    editSaving,
    deleteLoading,
    reloadStaffDishes,
    saveDishEntry,
    saveEditedDishRecord,
    confirmDeleteDishRecord,
  };
}
