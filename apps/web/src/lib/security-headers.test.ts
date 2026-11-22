import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

const csp = (o: Parameters<typeof securityHeaders>[0]) => securityHeaders(o).find((h) => h.key === "Content-Security-Policy")!.value;

describe("security headers (E24a)", () => {
  it("allows Supabase and WebAssembly, forbids framing and third-party scripts", () => {
    const v = csp({ supabaseUrl: "https://abcd.supabase.co" });
    expect(v).toContain("connect-src 'self' blob: data: https://abcd.supabase.co wss://abcd.supabase.co");
    expect(v).toContain("img-src 'self' data: blob: https://abcd.supabase.co");
    expect(v).toContain("'wasm-unsafe-eval'");
    expect(v).not.toContain("'unsafe-eval'");
    expect(v).toContain("frame-ancestors 'none'");
    expect(v).toContain("object-src 'none'");
  });
  it("stays valid when Supabase is not configured, and relaxes eval only in development", () => {
    expect(csp({})).not.toContain("undefined");
    expect(csp({ dev: true })).toContain("'unsafe-eval'");
    expect(securityHeaders({}).map((h) => h.key)).toContain("Strict-Transport-Security");
  });
});
