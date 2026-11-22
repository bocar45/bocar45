/** One structured JSON line per server error (same format as instrumentation.ts), never shown to users. */
export function logError(event: string, error: unknown, context: Record<string, unknown> = {}): void {
  const e = error as { message?: string; code?: string; details?: string } | null;
  console.error(JSON.stringify({
    level: "error",
    event,
    message: error instanceof Error ? error.message : (e?.message ?? String(error)),
    code: e?.code,
    details: e?.details,
    ...context,
    at: new Date().toISOString(),
  }));
}

export const TRY_AGAIN = "Cette action n'a pas pu aboutir. Réessayez dans un instant ; si le problème continue, contactez l'équipe SAWWA.";
export const READ_FAILED = "Ces informations ne peuvent pas être affichées pour le moment. Rechargez la page dans un instant.";
