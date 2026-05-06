/**
 * Two-character avatar label: username first, then email local-part.
 * Never returns "؟" for a logged-in user that has username/email.
 * @param {string | null | undefined} username
 * @param {string | null | undefined} email
 */
export function staffAvatarInitials(username, email) {
  const emailStr = String(email || "").trim();
  const localFromEmail = emailStr.includes("@") ? emailStr.split("@")[0].trim() : "";
  const usernameStr = String(username || "").trim();
  const uname = usernameStr.replace(/\s+/g, "");
  if (uname.length >= 2) return [...uname].slice(0, 2).join("");
  if (uname.length === 1) return `${uname}${uname}`;

  const local = localFromEmail || "";
  const cleaned = local.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "");
  const src = cleaned.length >= 2 ? cleaned : local;
  const out = [...src].slice(0, 2).join("");
  if (out.length >= 2) return out;
  if (out.length === 1) return `${out}${out}`;
  if (local.length >= 2) return [...local].slice(0, 2).join("");
  if (local.length === 1) return `${local}${local}`;

  // Any non-empty email local-part (even if symbols-only): never "؟" when @ exists.
  const rawLocal = emailStr.includes("@") ? emailStr.split("@")[0].trim() : "";
  if (rawLocal) {
    const g = [...rawLocal].slice(0, 2).join("");
    if (g.length >= 2) return g;
    if (g.length === 1) return `${g}${g}`;
  }
  return "؟";
}

/**
 * Short name for greeting: username, then full_name, then email local part.
 */
export function staffGreetingName(username, fullName, email) {
  const u = String(username || "").trim();
  if (u) return u;
  const n = String(fullName || "").trim();
  if (n) {
    const first = n.split(/\s+/)[0];
    return first || n;
  }
  const local = String(email || "")
    .split("@")[0]
    ?.trim();
  if (local) return local;
  return "ضيف";
}

/**
 * Welcome headline: username, full name, then email local part.
 * "ضيف" only when there is no usable email.
 */
export function staffWelcomeDisplayName(username, fullName, email) {
  const u = String(username || "").trim();
  if (u) return u;
  const n = String(fullName || "").trim();
  if (n) return n;
  const local = String(email || "")
    .split("@")[0]
    ?.trim();
  if (local) return local;
  return "ضيف";
}
