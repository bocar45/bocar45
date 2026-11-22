import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE } from "@/lib/i18n";
import { safeNext } from "@/lib/safe-next";

/** E24d: /langue?l=en&suite=/catalogue — remembers the language for a year and goes back (same-site paths only). */
export function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get("l") === "en" ? "en" : "fr";
  const res = NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("suite"), "/"), request.url));
  res.cookies.set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false, secure: request.nextUrl.protocol === "https:" });
  return res;
}
