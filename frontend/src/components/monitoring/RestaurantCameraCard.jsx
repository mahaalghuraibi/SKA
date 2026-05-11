import { memo, useEffect, useMemo, useState } from "react";

import {
  CONNECTION_TYPE_LABELS_AR,
  RESTAURANT_CONNECTION_TYPES,
  buildRtspUrlFromParts,
  getEffectiveRtspUrl,
  maskIpv4Display,
  maskRtspUrlForDisplay,
  resolveStoredPassword,
  validateRestaurantCameraDraft,
} from "../../lib/restaurantCameraStorage.js";

function tierBorderClass({ connected, riskTier }) {
  if (!connected) return "border-slate-600/70 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.15)]";
  const t = riskTier || "neutral";
  if (t === "red") return "border-red-500/55 shadow-[0_0_20px_-8px_rgba(239,68,68,0.45)]";
  if (t === "yellow") return "border-amber-400/55 shadow-[0_0_18px_-10px_rgba(245,158,11,0.35)]";
  if (t === "green") return "border-emerald-500/45 shadow-[0_0_16px_-12px_rgba(16,185,129,0.28)]";
  return "border-emerald-500/35";
}

function emptyDraftFromConfig(cfg) {
  return {
    cameraName: cfg.cameraName || "",
    ipAddress: cfg.ipAddress || "",
    port: cfg.port != null ? String(cfg.port) : "554",
    username: cfg.username || "",
    passwordDraft: "",
    streamPath: cfg.streamPath || "/stream1",
    connectionType: cfg.connectionType || RESTAURANT_CONNECTION_TYPES.IP_CAMERA,
    rtspUrl: cfg.rtspUrl || "",
  };
}

/**
 * Professional restaurant IP / RTSP / webcam camera card (UI + config only).
 */
function RestaurantCameraCard({
  zone,
  config,
  /** red | yellow | green | neutral */
  riskTier,
  connected,
  liveAnalyzing = false,
  connectionStatusLabel,
  lastConnectionTestLabel,
  lastAnalysisLabel,
  riskLevelLabel,
  activeViolationsCount,
  peopleCount,
  streamPreviewRef,
  onSave,
  onTestConnection,
  onStartLiveMonitoring,
  onStopMonitoring,
  onGoToUploadedVideoTest,
  testBusy,
  saveBusy,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraftFromConfig(config));

  useEffect(() => {
    if (!settingsOpen) setDraft(emptyDraftFromConfig(config));
  }, [config, settingsOpen]);

  const generatedRtsp = useMemo(() => {
    if (draft.connectionType !== RESTAURANT_CONNECTION_TYPES.IP_CAMERA) return "";
    const pass =
      String(draft.passwordDraft || "").trim() ||
      resolveStoredPassword(config.passwordEnc);
    return buildRtspUrlFromParts({
      ipAddress: draft.ipAddress,
      port: Number.parseInt(String(draft.port || "554"), 10) || 554,
      username: draft.username,
      password: pass,
      streamPath: draft.streamPath,
    });
  }, [draft, config.passwordEnc]);

  const effectiveRtspSaved = useMemo(() => getEffectiveRtspUrl(config, ""), [config]);

  const showBackendNotice =
    draft.connectionType === RESTAURANT_CONNECTION_TYPES.IP_CAMERA ||
    draft.connectionType === RESTAURANT_CONNECTION_TYPES.RTSP_URL;

  const backendRtspNotice =
    "تم تجهيز اتصال كاميرات IP و RTSP في الواجهة. لتفعيل البث الفعلي من الكاميرا يُطلَب تشغيل خدمة بث في الخادم (Backend streaming service).";

  const validationErrors = validateRestaurantCameraDraft(draft);
  const canSave = validationErrors.length === 0;

  let connectionLedLine = "🔴 غير متصل";
  if (connected && liveAnalyzing) connectionLedLine = "🟡 جاري التحليل";
  else if (connected) connectionLedLine = "🟢 متصل";

  const maskedSavedRtsp =
    config.connectionType === RESTAURANT_CONNECTION_TYPES.RTSP_URL && config.rtspUrl
      ? maskRtspUrlForDisplay(config.rtspUrl)
      : effectiveRtspSaved
        ? maskRtspUrlForDisplay(effectiveRtspSaved)
        : "";

  return (
    <article
      dir="rtl"
      className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-[#050814] via-[#0a1024] to-[#050814] ${tierBorderClass({ connected, riskTier })}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(56,189,248,0.05)_0%,transparent_45%,rgba(0,0,0,0.55)_100%)]" />

      <header className="relative border-b border-white/10 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold text-sky-200/95" dir="ltr">
              {zone.camCode}
            </p>
            <h4 className="mt-0.5 truncate text-sm font-bold text-white">
              {zone.ownerTitleAr || zone.displayNameAr}
            </h4>
            <p className="truncate text-xs font-semibold text-sky-100/90">
              {config.cameraName?.trim() || zone.displayNameAr}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">{zone.zoneAr}</p>
            {!settingsOpen &&
            config.connectionType === RESTAURANT_CONNECTION_TYPES.IP_CAMERA &&
            String(config.ipAddress || "").trim() ? (
              <p className="mt-1 font-mono text-[10px] text-slate-500" dir="ltr">
                IP (مخفّى): {maskIpv4Display(config.ipAddress)}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[11px] font-semibold text-slate-200">{connectionLedLine}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                connected
                  ? liveAnalyzing
                    ? "border-amber-500/45 bg-amber-500/12 text-amber-100"
                    : "border-emerald-500/45 bg-emerald-500/15 text-emerald-100"
                  : "border-slate-500/40 bg-slate-800/80 text-slate-300"
              }`}
            >
              {connectionStatusLabel}
            </span>
            <span className="text-[10px] text-slate-500">{lastConnectionTestLabel}</span>
          </div>
        </div>
      </header>

      <div className="relative mx-3 mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
        <div className="aspect-video w-full">
          <video
            ref={streamPreviewRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />
          {!connected ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 px-3 text-center">
              <p className="text-[11px] font-semibold text-slate-400">لا يوجد بث مباشر لهذه البطاقة</p>
              {showBackendNotice ? (
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{backendRtspNotice}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <dl className="relative grid grid-cols-2 gap-2 px-4 py-3 text-[11px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <dt className="text-slate-500">آخر تحليل</dt>
          <dd className="font-medium text-slate-100">{lastAnalysisLabel}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <dt className="text-slate-500">مستوى الخطر الحالي</dt>
          <dd className="font-medium text-slate-100">{riskLevelLabel}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <dt className="text-slate-500">مخالفات نشطة</dt>
          <dd className="font-mono font-semibold text-slate-100">{activeViolationsCount}</dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <dt className="text-slate-500">عدد الأشخاص</dt>
          <dd className="font-mono font-semibold text-slate-100">{peopleCount}</dd>
        </div>
      </dl>

      <div className="relative border-t border-white/10 px-4 py-3">
        <button
          type="button"
          onClick={() =>
            setSettingsOpen((o) => {
              const next = !o;
              if (next) setDraft(emptyDraftFromConfig(config));
              return next;
            })
          }
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-white/15 bg-[#0B1327]/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/25"
        >
          <span>إعدادات اتصال الكاميرا</span>
          <span className="text-slate-500">{settingsOpen ? "−" : "+"}</span>
        </button>

        {settingsOpen ? (
          <div className="space-y-3 text-start">
            {config.savedAt ? (
              <p className="text-[10px] text-slate-500">
                آخر حفظ للإعدادات:{" "}
                <span className="font-mono text-slate-400" dir="ltr">
                  {new Date(config.savedAt).toLocaleString("ar-SA")}
                </span>
              </p>
            ) : null}

            <label className="block text-[11px] text-slate-400">
              اسم الكاميرا
              <input
                value={draft.cameraName}
                onChange={(e) => setDraft((d) => ({ ...d, cameraName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1327]/90 px-3 py-2 text-sm text-white"
                placeholder={zone.displayNameAr}
              />
            </label>

            <label className="block text-[11px] text-slate-400">
              المنطقة
              <input
                value={zone.zoneAr}
                readOnly
                className="mt-1 w-full cursor-not-allowed rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-300"
              />
            </label>

            <label className="block text-[11px] text-slate-400">
              نوع الاتصال
              <select
                value={draft.connectionType}
                onChange={(e) => setDraft((d) => ({ ...d, connectionType: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1327]/90 px-3 py-2 text-sm text-white"
              >
                {Object.entries(CONNECTION_TYPE_LABELS_AR).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {(draft.connectionType === RESTAURANT_CONNECTION_TYPES.IP_CAMERA ||
              draft.connectionType === RESTAURANT_CONNECTION_TYPES.RTSP_URL) && (
              <details className="rounded-xl border border-white/10 bg-black/25">
                <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5">
                  إعدادات متقدمة: الشبكة، RTSP، وبيانات الدخول
                </summary>
                <div className="space-y-3 border-t border-white/10 p-3">
                  {draft.connectionType === RESTAURANT_CONNECTION_TYPES.RTSP_URL ? (
                    <label className="block text-[11px] text-slate-400">
                      رابط RTSP كامل
                      <textarea
                        value={draft.rtspUrl}
                        onChange={(e) => setDraft((d) => ({ ...d, rtspUrl: e.target.value }))}
                        rows={2}
                        dir="ltr"
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1327]/90 px-3 py-2 font-mono text-xs text-sky-100"
                        placeholder="rtsp://user:pass@192.168.1.100:554/stream1"
                      />
                      {maskedSavedRtsp && !draft.rtspUrl ? (
                        <p className="mt-1 font-mono text-[10px] text-slate-500" dir="ltr">
                          المحفوظ: {maskedSavedRtsp}
                        </p>
                      ) : null}
                    </label>
                  ) : null}

                  {draft.connectionType === RESTAURANT_CONNECTION_TYPES.IP_CAMERA ? (
                    <>
                      <label className="block text-[11px] text-slate-400">
                        عنوان IP
                        <input
                          value={draft.ipAddress}
                          onChange={(e) => setDraft((d) => ({ ...d, ipAddress: e.target.value }))}
                          dir="ltr"
                          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1327]/90 px-3 py-2 font-mono text-sm text-sky-100"
                          placeholder="192.168.1.100"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-[11px] text-slate-400">
                          المنفذ (افتراضي 554)
                          <input
                            value={draft.port}
                            onChange={(e) => setDraft((d) => ({ ...d, port: e.target.value }))}
                            dir="ltr"
                            className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1327]/90 px-3 py-2 font-mono text-sm text-sky-100"
                            placeholder="554"
                          />
                        </label>
                        <label className="block text-[11px] text-slate-400">
                          مسار البث (افتراضي /stream1)
                          <input
                            value={draft.streamPath}
                            onChange={(e) => setDraft((d) => ({ ...d, streamPath: e.target.value }))}
                            dir="ltr"
                            className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1327]/90 px-3 py-2 font-mono text-sm text-sky-100"
                            placeholder="/stream1"
                          />
                        </label>
                      </div>

                      <label className="block text-[11px] text-slate-400">
                        اسم المستخدم (اختياري)
                        <input
                          value={draft.username}
                          onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
                          dir="ltr"
                          autoComplete="off"
                          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1327]/90 px-3 py-2 text-sm text-white"
                        />
                      </label>

                      <label className="block text-[11px] text-slate-400">
                        كلمة المرور (اختياري)
                        <input
                          type="password"
                          value={draft.passwordDraft}
                          onChange={(e) => setDraft((d) => ({ ...d, passwordDraft: e.target.value }))}
                          autoComplete="new-password"
                          className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B1327]/90 px-3 py-2 text-sm text-white"
                          placeholder={config.passwordEnc ? "•••••• (محفوظة) — أدخل جديدة للاستبدال" : ""}
                        />
                      </label>
                    </>
                  ) : null}

                  {draft.connectionType === RESTAURANT_CONNECTION_TYPES.IP_CAMERA && generatedRtsp ? (
                    <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2">
                      <p className="text-[10px] font-semibold text-sky-200/90">
                        رابط RTSP المُولَّد داخلياً (مخفي بعد الحفظ)
                      </p>
                      <p className="mt-1 break-all font-mono text-[10px] text-slate-500" dir="ltr">
                        {maskRtspUrlForDisplay(generatedRtsp)}
                      </p>
                    </div>
                  ) : null}

                  {showBackendNotice ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95">
                      تم تجهيز اتصال كاميرات IP / RTSP في الواجهة. لتفعيل البث الفعلي من الكاميرا يُطلب تشغيل خدمة بث في
                      الخادم (Backend streaming service).
                    </div>
                  ) : null}
                </div>
              </details>
            )}

            {draft.connectionType === RESTAURANT_CONNECTION_TYPES.DEVICE_WEBCAM ? (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                يستخدم كاميرا المتصفح / الجهاز الحالي. حقول IP لا تنطبق؛ يمكن البدء بالمراقبة المباشرة بعد الحفظ.
              </p>
            ) : null}

            {draft.connectionType === RESTAURANT_CONNECTION_TYPES.UPLOADED_VIDEO ? (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                لاختبار التحليل على ملف فيديو مسجّل استخدم زر «اختبار فيديو مرفوع» أو انتقل لقسم تحليل الفيديو أدناه.
              </p>
            ) : null}

            {validationErrors.length > 0 ? (
              <ul className="list-inside list-disc text-[11px] text-amber-200/95">
                {validationErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={testBusy || !canSave}
                onClick={() => void onTestConnection(draft)}
                className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-[11px] font-semibold text-sky-100 disabled:opacity-40"
              >
                {testBusy ? "جاري الاختبار…" : "اختبار الاتصال"}
              </button>
              <button
                type="button"
                disabled={saveBusy || !canSave}
                onClick={() => void onSave(draft)}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-[11px] font-semibold text-emerald-100 disabled:opacity-40"
              >
                {saveBusy ? "جاري الحفظ…" : "حفظ الكاميرا"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => void onStartLiveMonitoring()}
            className="rounded-xl border border-violet-500/45 bg-violet-500/15 px-3 py-2 text-[11px] font-semibold text-violet-100"
          >
            بدء المراقبة المباشرة
          </button>
          <button
            type="button"
            onClick={() => void onStopMonitoring()}
            className="rounded-xl border border-white/20 bg-[#0B1327]/80 px-3 py-2 text-[11px] font-semibold text-slate-300"
          >
            إيقاف المراقبة
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(emptyDraftFromConfig(config));
              setSettingsOpen(true);
            }}
            className="rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-[11px] font-semibold text-sky-100"
          >
            تعديل الإعدادات
          </button>
          <button
            type="button"
            onClick={() => void onGoToUploadedVideoTest()}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-300"
          >
            اختبار فيديو مرفوع
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(RestaurantCameraCard);
