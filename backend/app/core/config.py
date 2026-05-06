import os
from pathlib import Path

from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parents[2]

load_dotenv(_backend_dir / ".env", override=True)


def _parse_bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    s = str(raw).strip().lower()
    if s in ("1", "true", "yes", "on"):
        return True
    if s in ("0", "false", "no", "off", ""):
        return False
    return default


class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "SKA Backend")
    _default_sqlite_path: str = (_backend_dir / "test.db").resolve().as_posix()
    _raw_database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{_default_sqlite_path}",
    )
    if _raw_database_url.startswith("sqlite:///./"):
        _rel = _raw_database_url.removeprefix("sqlite:///./")
        DATABASE_URL: str = f"sqlite:///{(_backend_dir / _rel).resolve().as_posix()}"
    else:
        DATABASE_URL: str = _raw_database_url
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    DEV_AUTH_BYPASS: bool = _parse_bool_env("DEV_AUTH_BYPASS", False)
    # SQLite only: create first admin if DB has zero users (local dev convenience).
    SEED_DEV_ADMIN: bool = _parse_bool_env("SEED_DEV_ADMIN", True)
    SEED_DEV_SUPERVISOR: bool = _parse_bool_env("SEED_DEV_SUPERVISOR", True)
    SEED_ADMIN_EMAIL: str = os.getenv("SEED_ADMIN_EMAIL", "admin@test.com")
    SEED_ADMIN_PASSWORD: str = os.getenv("SEED_ADMIN_PASSWORD", "admin123")
    SEED_SUPERVISOR_USERNAME: str = os.getenv("SEED_SUPERVISOR_USERNAME", "supervisor")
    SEED_SUPERVISOR_EMAIL: str = os.getenv("SEED_SUPERVISOR_EMAIL", "xjo21000@gmail.com")
    SEED_SUPERVISOR_EMAIL_ALT: str = os.getenv("SEED_SUPERVISOR_EMAIL_ALT", "xjojo2000@outlook.com")
    SEED_SUPERVISOR_EMAIL_ALT2: str = os.getenv("SEED_SUPERVISOR_EMAIL_ALT2", "xhoor2000@outlook.com")
    SEED_SUPERVISOR_PASSWORD: str = os.getenv("SEED_SUPERVISOR_PASSWORD", "123456")
    GOOGLE_VISION_API_KEY: str = os.getenv("GOOGLE_VISION_API_KEY", "")
    ROBOFLOW_API_KEY: str = os.getenv("ROBOFLOW_API_KEY", "")
    ROBOFLOW_API_URL: str = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
    ROBOFLOW_MODEL_ID: str = os.getenv("ROBOFLOW_MODEL_ID", "food-types-po0yz/2")
    ROBOFLOW_FOOD_TYPES_URL: str = os.getenv(
        "ROBOFLOW_FOOD_TYPES_URL",
        "https://serverless.roboflow.com/food-types-po0yz/2",
    )
    # Professional vision stack (image-only; no filename heuristics in classifier)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_VISION_MODEL: str = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_VISION_MODEL: str = os.getenv("GEMINI_VISION_MODEL", "gemini-1.5-flash")
    YOLO_MODEL_PATH: str = os.getenv("YOLO_MODEL_PATH", "")
    YOLO_CONF_THRESHOLD: float = float(os.getenv("YOLO_CONF_THRESHOLD", "0.35"))
    FOOD101_HF_MODEL_ID: str = os.getenv("FOOD101_HF_MODEL_ID", "nateraw/vit-base-food101")
    # Optional on-prem 9-class ResNet18 (see ml/custom_food/README.md). Inference only; no auto-train.
    SKA_CUSTOM_FOOD_MODEL_PATH: str = os.getenv("SKA_CUSTOM_FOOD_MODEL_PATH", "")
    SKA_CUSTOM_FOOD_LABEL_MAP_PATH: str = os.getenv("SKA_CUSTOM_FOOD_LABEL_MAP_PATH", "")
    # Persisted dish photos (data URLs from clients are written here on create).
    DISH_MEDIA_DIR: Path = Path(
        os.getenv("DISH_MEDIA_DIR", str(_backend_dir / "media" / "dish_images")),
    ).resolve()
    # Camera monitoring AI (separate from dish Roboflow serverless URL)
    ROBOFLOW_MONITORING_MODEL_URL: str = os.getenv("ROBOFLOW_MONITORING_MODEL_URL", "").strip()
    MONITORING_AI_DEMO_MODE: bool = _parse_bool_env("MONITORING_AI_DEMO_MODE", False)
    MONITORING_IMAGE_DATA_URL_MAX_CHARS: int = int(os.getenv("MONITORING_IMAGE_DATA_URL_MAX_CHARS", "400000"))
    # Production AI mode: stricter validation, real photos only, no demo paths.
    PRODUCTION_AI_MODE: bool = _parse_bool_env("PRODUCTION_AI_MODE", False)


settings = Settings()
