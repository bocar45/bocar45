import { describe, expect, it } from "vitest";
import { catalogPrice } from "./catalog-prices.ts";
import type { PlatformRuleSet, VendorPriceGrid } from "./types.ts";

const rules: PlatformRuleSet = { version: 1, currency: "XOF", defaultMarginBps: 3500, minMarginPerUnit: 500, vatBps: 1800, priceStep: 50 };
const gridA: VendorPriceGrid = {
  vendorId: "a", version: 1, currency: "XOF",
  blanks: { v1: [{ minQty: 1, unitCost: 2500 }, { minQty: 50, unitCost: 2000 }] },
  decorations: [
    { technique: "dtf", zoneKey: "front", maxWidthMm: 280, maxHeightMm: 350, tiers: [{ minQty: 1, unitCost: 2000 }, { minQty: 50, unitCost: 1400 }] },
    { technique: "dtf", zoneKey: "chest", maxWidthMm: 100, maxHeightMm: 100, tiers: [{ minQty: 1, unitCost: 1000 }] },
  ],
};
const gridB: VendorPriceGrid = {
  vendorId: "b", version: 4, currency: "XOF",
  blanks: { v1: [{ minQty: 25, unitCost: 1800 }] },
  minOrderQty: 25,
  decorations: [{ technique: "screen_print", zoneKey: "front", maxWidthMm: 280, maxHeightMm: 350, minQty: 25, setupFee: 8000, tiers: [{ minQty: 25, unitCost: 500 }] }],
};

describe("catalogPrice", () => {
  it("returns the lowest public price for one piece and the best price per quantity", () => {
    const p = catalogPrice([{ grid: gridA, minQty: 1, leadTimeDays: 5 }, { grid: gridB, minQty: 25, leadTimeDays: 3 }], rules, "tshirt")!;
    // A, chest DTF, 1 pc: 2500 + 1000 = 3500 → ×1.35 = 4725 → ×1.18 = 5576 → 5600
    expect(p).toMatchObject({ fromUnitPrice: 5600, fromQuantity: 1, leadTimeDays: 3, offerCount: 2 });
    expect([...p.techniques].sort()).toEqual(["dtf", "screen_print"]);
    // B at 25 pc: 1800 + 500 = 2300 → 3105 → 3664 → 3700 (cheaper than A at 25: 5600)
    expect(p.byQuantity.find((r) => r.quantity === 25)?.unitPrice).toBe(3700);
    expect(p.byQuantity.find((r) => r.quantity === 1)?.unitPrice).toBe(5600);
    expect(p.bestVolume).toEqual({ unitPrice: 3700, quantity: 25 });
  });

  it("returns null when no offer can be priced", () => {
    expect(catalogPrice([], rules, "tshirt")).toBeNull();
    expect(catalogPrice([{ grid: { ...gridA, blanks: {} }, minQty: 1, leadTimeDays: 5 }], rules, "tshirt")).toBeNull();
  });

  it("respects a workshop minimum quantity", () => {
    const p = catalogPrice([{ grid: gridB, minQty: 25, leadTimeDays: 3 }], rules, "tshirt")!;
    expect(p.fromQuantity).toBe(25);
    expect(p.byQuantity.find((r) => r.quantity === 1)?.unitPrice).toBeNull();
  });
});
