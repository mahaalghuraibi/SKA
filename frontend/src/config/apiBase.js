/**
 * Production: static frontend on Render (or CDN) calls API on another host.
 * Set at build time: VITE_API_BASE_URL=https://taeen-quality-platform.onrender.com
 * Dev: omit — Vite proxies `/api` to the backend (see vite.config.js).
 */
function normalizeBase(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBase(import.meta.env.VITE_API_BASE_URL);

/**
 * @param {string} path - Absolute path starting with `/` or full `http(s)://`, `blob:`, `data:` URL.
 */
export function apiUrl(path) {
  const s = String(path ?? "").trim();
  if (!s) return s;
  if (/^(https?:|blob:|data:)/i.test(s)) return s;
  const p = s.startsWith("/") ? s : `/${s}`;
  if (!API_BASE_URL) return p;
  return `${API_BASE_URL}${p}`;
}
