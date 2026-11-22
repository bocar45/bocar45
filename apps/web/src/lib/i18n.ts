/**
 * E24d — French first, English second (CLAUDE.md). No dependency: the language lives in a cookie (default: the
 * browser's preference, else French) and texts are written in place as French/English pairs, next to their use.
 */
export type Lang = "fr" | "en";
export const LANG_COOKIE = "sawwa_lang";

/** Language from the cookie, else from the browser's Accept-Language, else French. */
export function pickLang(cookie?: string | null, acceptLanguage?: string | null): Lang {
  if (cookie === "fr" || cookie === "en") return cookie;
  const prefs = (acceptLanguage ?? "").split(",").map((p) => {
    const [tag, q] = p.trim().split(";q=");
    return { tag: (tag ?? "").toLowerCase(), q: q ? Number(q) : 1 };
  }).filter((p) => p.tag).sort((a, b) => b.q - a.q);
  for (const p of prefs) {
    if (p.tag.startsWith("fr")) return "fr";
    if (p.tag.startsWith("en")) return "en";
  }
  return "fr";
}

/** The text in the reader's language. */
export const l = (lang: Lang, fr: string, en: string) => (lang === "en" ? en : fr);

/** A catalogue text stored as { fr, en } (English falls back to French until translated). */
export function loc(v: unknown, lang: Lang): string {
  if (!v || typeof v !== "object") return typeof v === "string" ? v : "";
  const o = v as { fr?: unknown; en?: unknown };
  const en = typeof o.en === "string" && o.en.trim() ? o.en : null;
  return String(lang === "en" && en ? en : o.fr ?? "");
}

/** Numbers and amounts in the reader's language (FCFA has no decimals). */
export const fcfaIn = (lang: Lang, n: number) => `${n.toLocaleString(lang === "en" ? "en-GB" : "fr-FR")} FCFA`;
