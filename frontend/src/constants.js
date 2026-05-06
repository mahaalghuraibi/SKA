/** localStorage key for JWT from POST /api/v1/auth/login */
export const ACCESS_TOKEN_KEY = "access_token";
/** localStorage key for current user role from GET /api/v1/users/me (or /me fallback) */
export const USER_ROLE_KEY = "user_role";
export const USER_INFO_KEY = "user_info";

/** Canonical staff current-user API (profile + role). */
export const STAFF_ME_API_URL = "/api/v1/users/me";
/** Older backends: same shape without /users prefix */
export const ME_FALLBACK_URL = "/api/v1/me";
/** Try in order for GET current user after login / dashboard bootstrap */
export const CURRENT_USER_ME_URLS = [STAFF_ME_API_URL, ME_FALLBACK_URL];
