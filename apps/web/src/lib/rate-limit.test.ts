import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("./supabase/server", () => ({ createServiceClient: () => ({ rpc: async () => ({ data: null, error: { message: "down" } }) }) }));

describe("rate limit helpers", async () => {
  const { clientIpFrom, rateLimit } = await import("./rate-limit");
  it("reads the client address set by the hosting proxy", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "41.82.10.5, 10.0.0.1" }))).toBe("41.82.10.5");
    expect(clientIpFrom(new Headers({ "x-real-ip": "41.82.10.6" }))).toBe("41.82.10.6");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
  it("lets requests through (and logs) when the counter is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await rateLimit("quotePerIp", "1.2.3.4")).toBe(true);
    expect(log).toHaveBeenCalled();
  });
});
