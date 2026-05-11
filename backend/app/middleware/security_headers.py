"""Security-related HTTP response headers (API + reverse-proxy friendly)."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    OWASP-oriented defaults for JSON APIs behind HTTPS terminators.
    HSTS is optional — enable only when the API is served only over HTTPS.
    """

    def __init__(
        self,
        app,
        *,
        enable_hsts: bool = False,
        hsts_max_age: int = 63072000,
    ) -> None:
        super().__init__(app)
        self._enable_hsts = enable_hsts
        self._hsts_max_age = hsts_max_age

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-XSS-Protection", "1; mode=block")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "accelerometer=(), camera=(), geolocation=(), microphone=(), payment=()",
        )
        if self._enable_hsts:
            response.headers.setdefault(
                "Strict-Transport-Security",
                f"max-age={self._hsts_max_age}; includeSubDomains; preload",
            )
        return response
