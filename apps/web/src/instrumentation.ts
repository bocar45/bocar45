import type { Instrumentation } from "next";

/**
 * Every unhandled server error is logged as one structured JSON line (visible in Vercel logs).
 * An error-tracking service (e.g. Sentry) plugs in here once SAWWA has an account (E14, action du porteur).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const e = error as Error & { digest?: string };
  console.error(JSON.stringify({
    level: "error",
    event: "request_error",
    message: e.message,
    digest: e.digest,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    route: context.routePath,
    at: new Date().toISOString(),
  }));
};
