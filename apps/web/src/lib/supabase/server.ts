import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "../env";

/** Supabase client acting as the signed-in user: every query goes through RLS. */
export async function createClient() {
  const cookieStore = await cookies(); // first: marks the route as dynamic (per-request)
  const { url, anonKey } = publicEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client: bypasses RLS. Server only, for writes the user may not do directly
 * (audit log). Always check permissions in code before using it.
 */
export function createServiceClient() {
  const { url } = publicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant (serveur uniquement).");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
