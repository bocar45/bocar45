import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, pickLang, type Lang } from "./i18n";

/** The reader's language on the server (cookie, else browser preference, else French). */
export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}
