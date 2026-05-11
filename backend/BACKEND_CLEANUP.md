# Backend cleanup (safe, `app/` only)

Date: 2026-05-11 · Scope: `ska-system/backend/app`

## Constraints honored

- Auth, security middleware, JWT, rate limiting, CORS, exception handlers: **unchanged** (only duplicate stdout removed).
- AI/camera/monitoring startup diagnostics: **still logged** via `logging` (same lines as before, without duplicate `print` to stdout).
- Database session/init (`init_db`): **unchanged**.
- Architecture, routers, env/model paths: **not refactored**.

## Files removed

- None.

## Files modified

| File | Change |
|------|--------|
| `app/main.py` | Removed redundant **`print(...)`** during lifespan startup; retained **`logger.info`** / **`logger.warning`** for the same messages (no logic change). |
| `app/api/routes/supervisor_dashboard.py` | Merged duplicate **`from fastapi import`** lines into one import (style only). |

## Not changed (deliberate)

- **`ml/`**, **`scripts/`**: standalone tooling scripts still use `print` for CLI UX — out of `app/` scope.
- **Unused imports**: No automated `ruff`/flake pass added to requirements; quick scan showed only the duplicate FastAPI import above.

## Checks run

- `pip check` — OK (`No broken requirements found.`).
- `python -m compileall -q app` — OK.
- `python -c "from app.main import app"` — OK.

## Changed files (summary)

- `app/main.py`
- `app/api/routes/supervisor_dashboard.py`
- `BACKEND_CLEANUP.md` (this file)
