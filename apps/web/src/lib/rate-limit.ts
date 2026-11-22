import "server-only";
import { headers } from "next/headers";
import { logError } from "./log";
import { createServiceClient } from "./supabase/server";

/** Limits per key and window. Tuned for the pilot; adjust here. */
export const LIMITS = {
  otpPerPhone: { limit: 5, windowSeconds: 3600 },
  otpPerIp: { limit: 20, windowSeconds: 3600 },
  quotePerIp: { limit: 120, windowSeconds: 60 },
  saveDesignPerUser: { limit: 30, windowSeconds: 60 },
  orderPerUser: { limit: 10, windowSeconds: 600 },
  productionPerUser: { limit: 60, windowSeconds: 600 },
  vendorApplyPerUser: { limit: 5, windowSeconds: 3600 },
} as const;
export type LimitName = keyof typeof LIMITS;

/** First address of x-forwarded-for (set by Vercel), else x-real-ip, else "unknown". */
export function clientIpFrom(h: Pick<Headers, "get">): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/**
 * true = allowed. Counted in Postgres (shared by all server instances). If the limiter itself is unavailable,
 * the request is allowed and the incident logged: an outage of the counter must not block customers.
 */
export async function rateLimit(name: LimitName, subject: string): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[name];
  try {
    const { data, error } = await createServiceClient().rpc("rate_limit_hit", { p_key: `${name}:${subject}`, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) throw error;
    return data === true;
  } catch (e) {
    // Any failure of the counter (database down, configuration missing, network) lets the request through.
    logError("rate_limit_unavailable", e, { name });
    return true;
  }
}

export const TOO_MANY = "Trop de tentatives en peu de temps. Patientez quelques minutes puis réessayez.";
