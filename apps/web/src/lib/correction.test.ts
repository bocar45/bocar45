import { describe, expect, it } from "vitest";
import { correctionPricing } from "./correction";

describe("correction pricing", () => {
  it("accepts a correction that costs the same or less, with no refund of the difference", () => {
    expect(correctionPricing(21600, 21600, null)).toEqual({ ok: true, surcharge: 0 });
    expect(correctionPricing(21600, 18000, null)).toEqual({ ok: true, surcharge: 0 });
  });
  it("asks for an explicit agreement on the exact surcharge", () => {
    const r = correctionPricing(21600, 24000, null);
    expect(r).toMatchObject({ ok: false, surcharge: 2400 });
    expect(correctionPricing(21600, 24000, 2000)).toMatchObject({ ok: false, surcharge: 2400 });
    expect(correctionPricing(21600, 24000, 2400)).toEqual({ ok: true, surcharge: 2400 });
  });
  it("rejects non-integer amounts", () => {
    expect(() => correctionPricing(10.5, 11, null)).toThrow();
  });
});
