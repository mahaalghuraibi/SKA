/**
 * Live surveillance deck: one logical zone per card (kitchen / storage / prep).
 * Same physical MediaStream can be attached to all previews until RTSP/IP sources are wired per slot.
 */
export default function LiveMonitoringZoneCards({
  zones,
  selectedZoneId,
  onSelectZone,
  slotStates,
  previewRefs,
  liveAutoOn,
  liveTickBusy,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {zones.map((zone, idx) => {
        const selected = selectedZoneId === zone.id;
        const st = slotStates[zone.id];
        const tier = st?.tier || "neutral";
        const border =
          tier === "red"
            ? "border-red-500/60 shadow-[0_0_16px_rgba(239,68,68,0.18)]"
            : tier === "yellow"
              ? "border-amber-400/55 shadow-[0_0_14px_rgba(245,158,11,0.14)]"
              : tier === "green"
                ? "border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
                : "border-white/12";

        return (
          <button
            key={zone.id}
            type="button"
            onClick={() => onSelectZone(zone.id)}
            className={`rounded-xl border-2 bg-[#060d1f]/90 p-3 text-start transition hover:border-white/25 ${
              selected ? "ring-2 ring-sky-400/40" : ""
            } ${border}`}
          >
            <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video
                ref={previewRefs[idx]}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
              {!liveAutoOn ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-slate-300">
                  معاينة
                </span>
              ) : null}
              {liveAutoOn && selected && liveTickBusy ? (
                <span className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
              ) : null}
            </div>
            <p className="text-xs font-semibold text-white">{zone.displayNameAr}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{zone.zoneAr}</p>
            <p className="mt-2 text-[10px] font-medium text-slate-300">
              الحالة:{" "}
              <span
                className={
                  tier === "red"
                    ? "text-red-300"
                    : tier === "yellow"
                      ? "text-amber-200"
                      : tier === "green"
                        ? "text-emerald-300"
                        : "text-slate-500"
                }
              >
                {st?.statusLabel || "—"}
              </span>
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              آخر تحليل: {st?.lastAtLabel || "—"}
            </p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-400">
              المخالفات: {st?.violationsSummary || "—"}
            </p>
            {typeof st?.peopleCount === "number" ? (
              <p className="mt-1 text-[10px] text-slate-500">الأشخاص: {st.peopleCount}</p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
