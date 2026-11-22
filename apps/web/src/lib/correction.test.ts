import { describe, expect, it } from "vitest";
import { price, type PlatformRuleSet, type VendorPriceGrid } from "@sawwa/pricing";
import { correctionPricing, planCorrection } from "./correction";

describe("correction pricing", () => {
  it("accepts a correction that costs the same or less, with no refund of the difference", () => {
    expect(correctionPricing(21600, 21600, null)).toEqual({ ok: true, surcharge: 0 });
    expect(correctionPricing(21600, 18000, null)).toEqual({ ok: true, surcharge: 0 });
  });
  it("asks for an explicit agreement on the exact surcharge", () => {
    expect(correctionPricing(21600, 24000, null)).toMatchObject({ ok: false, surcharge: 2400 });
    expect(correctionPricing(21600, 24000, 2000)).toMatchObject({ ok: false, surcharge: 2400 });
    expect(correctionPricing(21600, 24000, 2400)).toEqual({ ok: true, surcharge: 2400 });
  });
  it("rejects non-integer amounts", () => {
    expect(() => correctionPricing(10.5, 11, null)).toThrow();
  });
});

describe("correction plan with the assigned workshop", () => {
  const rules: PlatformRuleSet = { version: 1, currency: "XOF", defaultMarginBps: 3500, minMarginPerUnit: 500, vatBps: 1800, priceStep: 50 };
  // The assigned workshop prints the front in DTF only; it does not embroider.
  const assigned: VendorPriceGrid = {
    vendorId: "assigned", version: 1, currency: "XOF", blanks: { m: [{ minQty: 1, unitCost: 2500 }] },
    decorations: [
      { technique: "dtf", zoneKey: "front", maxWidthMm: 100, maxHeightMm: 100, tiers: [{ minQty: 1, unitCost: 1000 }] },
      { technique: "dtf", zoneKey: "front", maxWidthMm: 280, maxHeightMm: 350, tiers: [{ minQty: 1, unitCost: 2000 }] },
    ],
  };
  const total = (decorations: { zoneKey: string; technique: "dtf" | "embroidery"; widthMm: number; heightMm: number }[]) => {
    try { return price({ category: "vetements", lines: [{ variantId: "m", quantity: 10 }], decorations }, rules, assigned).total.amount; } catch { return null; }
  };
  const small = [{ zoneKey: "front", technique: "dtf" as const, widthMm: 90, heightMm: 90 }];
  const large = [{ zoneKey: "front", technique: "dtf" as const, widthMm: 250, heightMm: 300 }];

  it("charges nothing for a correction that keeps the same print size, whatever the original price was", () => {
    // The order was priced with a cheaper workshop (50 000) but SAWWA assigned this one: no surcharge for the customer.
    expect(planCorrection({ agreedTotal: 50000, before: total(small), after: total(small), acceptedSurcharge: null })).toMatchObject({ ok: true, surcharge: 0 });
  });
  it("charges only the effect of a bigger print, with the assigned workshop's prices", () => {
    const plan = planCorrection({ agreedTotal: 50000, before: total(small), after: total(large), acceptedSurcharge: null });
    expect(plan).toMatchObject({ ok: false, surcharge: total(large)! - total(small)! });
  });
  it("refuses a correction the assigned workshop cannot make, even if another workshop could", () => {
    const after = total([{ zoneKey: "chest", technique: "embroidery", widthMm: 60, heightMm: 60 }]);
    expect(after).toBeNull();
    expect(planCorrection({ agreedTotal: 50000, before: total(small), after, acceptedSurcharge: null })).toMatchObject({ ok: false });
  });
  it("falls back on the agreed amount when the original can no longer be priced", () => {
    expect(planCorrection({ agreedTotal: 70000, before: null, after: 65000, acceptedSurcharge: null })).toMatchObject({ ok: true, surcharge: 0, priceBefore: 70000 });
  });
});
