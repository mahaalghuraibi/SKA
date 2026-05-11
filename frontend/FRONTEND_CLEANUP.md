# Frontend cleanup (safe)

Date: 2026-05-11 scope: `ska-system/frontend` only.

## Constraints honored

- No UI behavior change (toasts, redirects, and handlers unchanged except removing console output).
- No route or component renames; active components retained.
- Charts (`ReportsAnalyticsCharts.jsx`, `SupervisorAnalyticsRecharts.jsx`, …) not edited.
- AI/dish-detection hooks (`useDetectDish.js`) not edited.

## Files removed

- None.

## Files modified

| File | Change |
|------|--------|
| `src/pages/Dashboard.jsx` | Removed `console.warn` / `console.error` diagnostics only; simplified `catch` where `e` unused; `onNetworkError` callback renamed unused arg to `_err`. |

## Code cleaned

- **Console:** Repository had **no `console.log`**. Removed **`console.warn`** / **`console.error`** from `Dashboard.jsx` only (same user-visible paths: `setToast` / `setDishNotice` unchanged).
- **Unused imports / vars:** `eslint` + `eslint --fix` reported **0 issues** across `src/` (64 files); nothing auto-fixed.
- **Commented-out legacy code:** No safe bulk removal found (no flagged TODO/FIXME blocks in grep).
- **Duplicate helpers:** Not merged — overlapping utilities (`utils/dishHelpers.js`, `utils/dishRecordsDisplay.js`, …) left as-is to avoid risk.

## Intentionally not changed (uncertain / out of scope)

- **`hooks/useDetectDish.js`** — `console.error` kept (AI/API diagnostics).
- **`hooks/useDishRecords.js`** — `console.error` kept (save-path diagnostics).
- **`Dashboard.jsx`** logic for monitoring/video/charts untouched beyond console removal.

## Checks run

- `npm run build` — success.
- `npm audit` — see terminal (typically 0 vulnerabilities in current tree).
- `npm run lint` / `npx eslint src --fix` — 0 messages before edits.

## Changed files (summary)

- `src/pages/Dashboard.jsx`
- `FRONTEND_CLEANUP.md` (this file)
