/**
 * E24a — HTTP security headers. The Content-Security-Policy allows exactly what SAWWA uses: its own scripts (Next.js
 * inline bootstrap), WebAssembly (in-browser background removal), blob:/data: images (studio), Supabase (API, storage,
 * realtime). No third-party script, no framing.
 */
export function securityHeaders(opts: { supabaseUrl?: string | undefined; dev?: boolean }) {
  let supabase = "";
  try { if (opts.supabaseUrl) { const u = new URL(opts.supabaseUrl); supabase = `${u.origin} wss://${u.host}`; } } catch { /* not configured */ }
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${opts.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase ? ` ${supabase.split(" ")[0]}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self' blob: data:${supabase ? ` ${supabase}` : ""}${opts.dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(opts.dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
