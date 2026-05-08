from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401 - register ORM mappers before routes import User
from app.api.router import api_router
from app.core.config import settings
from app.db.session import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # ── Key source resolution ──────────────────────────────────────────────────
    _mon_dedicated = bool((os.getenv("MONITORING_GEMINI_API_KEY") or "").strip())
    _dish_dedicated = bool((os.getenv("DISH_GEMINI_API_KEY") or "").strip())
    _legacy_set = bool((os.getenv("GEMINI_API_KEY") or "").strip())

    monitoring_key_set = bool((settings.MONITORING_GEMINI_API_KEY or "").strip())
    dish_key_set = bool((settings.DISH_GEMINI_API_KEY or "").strip())
    monitoring_key_src = "dedicated" if _mon_dedicated else ("legacy-fallback" if _legacy_set else "MISSING")
    dish_key_src = "dedicated" if _dish_dedicated else ("legacy-fallback" if _legacy_set else "MISSING")

    monitoring_model = (settings.MONITORING_GEMINI_MODEL or settings.GEMINI_VISION_MODEL or "").strip()
    dish_model = (settings.DISH_GEMINI_MODEL or settings.GEMINI_VISION_MODEL or "").strip()
    demo_mode = settings.MONITORING_AI_DEMO_MODE

    startup_lines = [
        f"  MONITORING_GEMINI_API_KEY_set={monitoring_key_set}  source={monitoring_key_src}",
        f"  MONITORING_GEMINI_MODEL={monitoring_model or '(none)'}",
        f"  DISH_GEMINI_API_KEY_set={dish_key_set}  source={dish_key_src}",
        f"  DISH_GEMINI_MODEL={dish_model or '(none)'}",
        f"  MONITORING_AI_DEMO_MODE={demo_mode}",
        f"  ROBOFLOW_KEY_set={bool(settings.ROBOFLOW_API_KEY.strip())}",
    ]
    for line in startup_lines:
        print(line, flush=True)
        logger.info(line.strip())

    init_db()
    yield


app = FastAPI(title="SKA Backend", lifespan=lifespan)
# Swagger UI handles form-urlencoded request bodies more reliably with OpenAPI 3.0.x.
app.openapi_version = "3.0.2"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5178",
        "http://127.0.0.1:5178",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "SKA Backend Running"}
