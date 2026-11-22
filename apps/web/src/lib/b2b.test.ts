import { describe, expect, it } from "vitest";
import { fitsQuote, isQuoteValid } from "./b2b-rules";

describe("B2B quotes (E17)", () => {
  const quoted = [{ zoneKey: "front", technique: "dtf", widthMm: 250, heightMm: 300, colors: 4 }, { zoneKey: "chest", technique: "embroidery", widthMm: 90, heightMm: 90, colors: 3 }];
  it("accepts a design within the quoted zones, sizes and colours", () => {
    expect(fitsQuote([{ zoneKey: "front", technique: "dtf", widthMm: 251, heightMm: 200, colors: 2 }], quoted)).toEqual([]);
  });
  it("refuses another zone or technique, a larger print or more colours", () => {
    expect(fitsQuote([
      { zoneKey: "back", technique: "dtf", widthMm: 100, heightMm: 100, colors: 1 },
      { zoneKey: "chest", technique: "dtf", widthMm: 80, heightMm: 80, colors: 1 },
      { zoneKey: "front", technique: "dtf", widthMm: 260, heightMm: 300, colors: 1 },
      { zoneKey: "chest", technique: "embroidery", widthMm: 80, heightMm: 80, colors: 5 },
    ], quoted)).toHaveLength(4);
  });
  it("is valid while sent and not expired", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(isQuoteValid({ status: "sent", valid_until: "2026-12-22T12:00:00Z" }, now)).toBe(true);
    expect(isQuoteValid({ status: "sent", valid_until: "2026-11-22T11:59:00Z" }, now)).toBe(false);
    expect(isQuoteValid({ status: "accepted", valid_until: "2026-12-22T12:00:00Z" }, now)).toBe(false);
  });
});
