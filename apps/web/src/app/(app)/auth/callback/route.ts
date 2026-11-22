import { safeNext } from "@/lib/safe-next";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Landing point of e-mail login links. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("suite") ?? "/compte";
  const target = safeNext(next);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(target, request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
}
