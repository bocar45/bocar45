/**
 * Where to send someone after signing in: only a path of this site. Refuses `//host`, `/\\host` (browsers read a
 * backslash as a slash), schemes, control characters and anything that resolves to another origin.
 */
export function safeNext(next: unknown, fallback = "/compte"): string {
  if (typeof next !== "string" || next.length > 500 || !next.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(next) || next.startsWith("//")) return fallback;
  try {
    const u = new URL(next, "https://sawwa.invalid");
    return u.origin === "https://sawwa.invalid" ? `${u.pathname}${u.search}${u.hash}` : fallback;
  } catch {
    return fallback;
  }
}
