import { useCallback } from "react";
import { detectDish, UNKNOWN_DISH_TEXT } from "../services/detectDishService.js";

/**
 * Detect-dish orchestration: loading, dish notices, normalized result, autofill.
 * API: detectDishService; UI state setters are passed from the page.
 */
export function useDetectDish({
  accessTokenKey,
  setDetecting,
  setDishNotice,
  setDetectResult,
  setSelectedAlternative,
  setManualDish,
}) {
  const handleDetectDish = useCallback(
    async (file, opts = {}) => {
      const preserveManual = Boolean(opts.preserveManual);
      const token = localStorage.getItem(accessTokenKey);
      if (!token || !file) return;
      setDetecting(true);
      setDishNotice({ type: "info", text: "جاري تحليل الصورة باستخدام الذكاء الاصطناعي..." });
      setDetectResult(null);
      setSelectedAlternative("");
      if (!preserveManual) setManualDish("");
      try {
        const result = await detectDish(token, file);
        if (!result.ok) {
          console.error("detect-dish failed:", { status: result.status, body: result.body });
          if (result.status === 401) {
            setDishNotice({ type: "error", text: "انتهت الجلسة — سجّل الدخول مجددًا ثم أعد المحاولة." });
          } else {
            setDishNotice({ type: "error", text: "تعذر التعرف على الطبق، يرجى الاختيار يدويًا" });
          }
          return;
        }
        const normalized = result.normalized;
        const autofillDishName =
          normalized.suggestions[0]?.name ||
          (normalized.detected === UNKNOWN_DISH_TEXT && normalized.suggestedName
            ? normalized.suggestedName
            : normalized.alternatives[0] || normalized.detected);
        setDetectResult(normalized);
        const skipAutofill = normalized.proteinConflict || normalized.needsReviewLowConf;
        if (skipAutofill) {
          setSelectedAlternative("");
          setManualDish("");
          setDishNotice({
            type: "warning",
            text: normalized.proteinConflict
              ? "تعارض بين الاقتراحات (مثل سمك ولحم أو سمك ودجاج). اختر أحد الخيارات أو اكتب الاسم يدويًا — لم يُملأ الحقل تلقائيًا."
              : "ثقة الاقتراح أقل من 75%. اختر أحد الخيارات أو اكتب اسم الطبق يدويًا — لم يُملأ الحقل تلقائيًا.",
          });
        } else {
          setSelectedAlternative(autofillDishName);
          setManualDish(autofillDishName);
          setDishNotice({
            type: "success",
            text: `تم التعرف على الطبق: ${autofillDishName}`,
          });
        }
      } catch (err) {
        console.error("detect-dish request error:", err);
        setDishNotice({ type: "error", text: "تعذر التعرف على الطبق، يرجى الاختيار يدويًا" });
      } finally {
        setDetecting(false);
      }
    },
    [
      accessTokenKey,
      setDetecting,
      setDishNotice,
      setDetectResult,
      setSelectedAlternative,
      setManualDish,
    ]
  );

  return { handleDetectDish };
}
