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
    has_roboflow_key = bool(settings.ROBOFLOW_API_KEY.strip())
    print(f"Roboflow key loaded: {'yes' if has_roboflow_key else 'no'}")
    logger.info("Roboflow key loaded: %s", "yes" if has_roboflow_key else "no")
    logger.info("Database URL in use: %s", settings.DATABASE_URL)
    demo_raw = os.getenv("MONITORING_AI_DEMO_MODE", "<unset>")
    print(
        "Monitoring AI: "
        f"MONITORING_AI_DEMO_MODE(raw)={demo_raw!r} "
        f"parsed={settings.MONITORING_AI_DEMO_MODE} "
        f"GEMINI_API_KEY_set={bool((settings.GEMINI_API_KEY or '').strip())}"
    )
    logger.info(
        "Monitoring AI: MONITORING_AI_DEMO_MODE(raw)=%r parsed=%s GEMINI_API_KEY_set=%s",
        demo_raw,
        settings.MONITORING_AI_DEMO_MODE,
        bool((settings.GEMINI_API_KEY or "").strip()),
    )
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
