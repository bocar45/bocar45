import { describe, expect, it } from "vitest";
import { money } from "@sawwa/domain";
import { price, PricingError, tierCost } from "./price.ts";
import type { PlatformRuleSet, PriceRequest, VendorPriceGrid } from "./types.ts";

// Illustrative Dakar workshop grid (FCFA, excl. tax). Real grids come from the pilot workshops.
const grid: VendorPriceGrid = {
  vendorId: "ven_atelier_medina",
  version: 3,
  currency: "XOF",
  blanks: {
    "tee-ivory-M": [
      { minQty: 1, unitCost: 2500 },
      { minQty: 25, unitCost: 2200 },
      { minQty: 50, unitCost: 2000 },
    ],
    "tee-ivory-L": [
      { minQty: 1, unitCost: 2500 },
      { minQty: 25, unitCost: 2200 },
      { minQty: 50, unitCost: 2000 },
    ],
  },
  decorations: [
    { technique: "dtf", zoneKey: "front_center", maxWidthMm: 100, maxHeightMm: 100, tiers: [{ minQty: 1, unitCost: 1000 }, { minQty: 25, unitCost: 800 }] },
    { technique: "dtf", zoneKey: "front_center", maxWidthMm: 280, maxHeightMm: 350, tiers: [{ minQty: 1, unitCost: 2000 }, { minQty: 25, unitCost: 1700 }, { minQty: 50, unitCost: 1400 }] },
    { technique: "dtf", zoneKey: "back_center", maxWidthMm: 280, maxHeightMm: 350, tiers: [{ minQty: 1, unitCost: 2000 }, { minQty: 50, unitCost: 1400 }] },
    { technique: "embroidery", zoneKey: "chest_left", maxWidthMm: 80, maxHeightMm: 80, maxColors: 8, setupFee: 5000, tiers: [{ minQty: 1, unitCost: 1500 }, { minQty: 25, unitCost: 1200 }, { minQty: 50, unitCost: 1000 }] },
    { technique: "screen_print", zoneKey: "front_center", maxWidthMm: 280, maxHeightMm: 350, minQty: 30, maxColors: 4, setupFee: 8000, extraColorUnitCost: 300, tiers: [{ minQty: 30, unitCost: 700 }] },
  ],
};

const rules: PlatformRuleSet = {
  version: 1,
  currency: "XOF",
  defaultMarginBps: 3500,
  minMarginPerUnit: 500,
  vatBps: 1800,
  priceStep: 50,
  deposit: { thresholdTotal: 150_000, bps: 5000 },
};

const single: PriceRequest = {
  category: "tshirt",
  lines: [{ variantId: "tee-ivory-M", quantity: 1 }],
  decorations: [{ zoneKey: "front_center", technique: "dtf", widthMm: 250, heightMm: 300 }],
};

describe("tierCost", () => {
  it("picks the highest tier reached", () => {
    const tiers = [{ minQty: 1, unitCost: 10 }, { minQty: 25, unitCost: 8 }, { minQty: 50, unitCost: 6 }];
    expect(tierCost(tiers, 1)).toBe(10);
    expect(tierCost(tiers, 49)).toBe(8);
    expect(tierCost(tiers, 500)).toBe(6);
    expect(tierCost([{ minQty: 30, unitCost: 7 }], 10)).toBeNull();
  });
});

describe("price — single custom t-shirt", () => {
  const q = price(single, rules, grid);

  it("computes the public TTC unit price from vendor cost, margin, VAT and step", () => {
    // cost 2500 + 2000 = 4500 → ×1.35 = 6075 → ×1.18 = 7168.5 → up 7169 → step 50 → 7200
    expect(q.lines[0]?.vendorUnitCost.amount).toBe(4500);
    expect(q.lines[0]?.unitPrice.amount).toBe(7200);
    expect(q.total.amount).toBe(7200);
  });

  it("splits total into excl. tax + VAT exactly", () => {
    expect(q.totalExclTax.amount + q.tax.amount).toBe(q.total.amount);
    expect(q.totalExclTax.amount).toBe(6102);
  });

  it("records the margin and the snapshot", () => {
    expect(q.margin.amount).toBe(6102 - 4500);
    expect(q.snapshot).toMatchObject({ ruleSetVersion: 1, vendorId: "ven_atelier_medina", vendorGridVersion: 3 });
    expect(q.depositDue).toBeNull();
  });

  it("chooses the smallest print size that fits", () => {
    const small = price({ ...single, decorations: [{ zoneKey: "front_center", technique: "dtf", widthMm: 90, heightMm: 90 }] }, rules, grid);
    expect(small.decorations[0]?.vendorUnitCost.amount).toBe(1000);
  });
});

describe("price — team order", () => {
  const team: PriceRequest = {
    category: "tshirt",
    lines: [
      { variantId: "tee-ivory-M", quantity: 30 },
      { variantId: "tee-ivory-L", quantity: 20 },
    ],
    decorations: [{ zoneKey: "chest_left", technique: "embroidery", widthMm: 70, heightMm: 70, colors: 3 }],
  };
  const q = price(team, rules, grid);

  it("uses the total quantity for tiers across sizes", () => {
    expect(q.totalQuantity).toBe(50);
    expect(q.lines[0]?.vendorUnitCost.amount).toBe(3000); // 2000 + 1000
    expect(q.lines[0]?.unitPrice.amount).toBe(4800); // 3000×1.35=4050 → ×1.18=4779 → 4800
  });

  it("adds the embroidery setup fee once", () => {
    expect(q.setupFee.amount).toBe(8000); // 5000×1.35=6750 → ×1.18=7965 → 8000
    expect(q.goodsSubtotal.amount).toBe(50 * 4800 + 8000);
    expect(q.vendorCost.amount).toBe(50 * 3000 + 5000);
  });

  it("asks for a 50 % deposit above the threshold", () => {
    expect(q.depositDue?.amount).toBe(124_000);
  });
});

describe("price — rules and errors", () => {
  it("refuses screen printing below its minimum quantity", () => {
    const req: PriceRequest = { ...single, decorations: [{ zoneKey: "front_center", technique: "screen_print", widthMm: 200, heightMm: 200, colors: 2 }] };
    expect(() => price(req, rules, grid)).toThrow(PricingError);
  });

  it("charges extra screen-print colours", () => {
    const req: PriceRequest = { category: "tshirt", lines: [{ variantId: "tee-ivory-M", quantity: 40 }], decorations: [{ zoneKey: "front_center", technique: "screen_print", widthMm: 200, heightMm: 200, colors: 3 }] };
    expect(price(req, rules, grid).decorations[0]?.vendorUnitCost.amount).toBe(700 + 2 * 300);
  });

  it("refuses too many embroidery colours", () => {
    const req: PriceRequest = { ...single, decorations: [{ zoneKey: "chest_left", technique: "embroidery", widthMm: 50, heightMm: 50, colors: 12 }] };
    expect(() => price(req, rules, grid)).toThrow(/colours/);
  });

  it("refuses a print larger than any offer", () => {
    const req: PriceRequest = { ...single, decorations: [{ zoneKey: "front_center", technique: "dtf", widthMm: 400, heightMm: 300 }] };
    try {
      price(req, rules, grid);
      expect.unreachable();
    } catch (e) {
      expect((e as PricingError).code).toBe("DECORATION_NOT_OFFERED");
    }
  });

  it("refuses unknown variants, empty orders and currency mismatches", () => {
    expect(() => price({ ...single, lines: [{ variantId: "nope", quantity: 1 }] }, rules, grid)).toThrow(/not offered/);
    expect(() => price({ ...single, lines: [] }, rules, grid)).toThrow(/no items/);
    expect(() => price(single, { ...rules, currency: "EUR" }, grid)).toThrow(/vendor grid/);
    expect(() => price({ ...single, lines: [{ variantId: "tee-ivory-M", quantity: 0 }] }, rules, grid)).toThrow(/quantity/);
  });

  it("applies category margins", () => {
    const q = price(single, { ...rules, marginByCategoryBps: { tshirt: 5000 } }, grid);
    expect(q.lines[0]?.unitPrice.amount).toBe(8000); // 4500×1.5=6750 → 7965 → 8000
  });

  it("adds shipping after discount", () => {
    const q = price({ ...single, shipping: money(1500, "XOF"), discount: { kind: "amount", amount: 200 } }, rules, grid);
    expect(q.total.amount).toBe(7200 - 200 + 1500);
  });
});

describe("price — invariants (never a negative margin)", () => {
  // Deterministic pseudo-random generator so failures are reproducible.
  let seed = 42;
  const rnd = (n: number) => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed % n;
  };

  it("holds for 2 000 random orders and discounts", () => {
    for (let i = 0; i < 2000; i++) {
      const qM = 1 + rnd(80);
      const qL = rnd(40);
      const req: PriceRequest = {
        category: "tshirt",
        lines: [{ variantId: "tee-ivory-M", quantity: qM }, ...(qL > 0 ? [{ variantId: "tee-ivory-L", quantity: qL }] : [])],
        decorations: [
          { zoneKey: "front_center", technique: "dtf", widthMm: 50 + rnd(230), heightMm: 50 + rnd(300) },
          ...(rnd(2) ? [{ zoneKey: "chest_left", technique: "embroidery" as const, widthMm: 60, heightMm: 60, colors: 1 + rnd(8) }] : []),
        ],
        discount: rnd(2) ? { kind: "percent", bps: rnd(9000) } : { kind: "amount", amount: rnd(500_000) },
        shipping: money(rnd(3000), "XOF"),
      };
      const q = price(req, rules, grid);
      const qty = qM + qL;
      expect(q.margin.amount).toBeGreaterThanOrEqual(rules.minMarginPerUnit * qty);
      expect(q.totalExclTax.amount + q.tax.amount).toBe(q.total.amount);
      expect(q.total.amount).toBe(q.goodsSubtotal.amount - q.discount.amount + q.shipping.amount);
      expect(q.discount.amount).toBeGreaterThanOrEqual(0);
      for (const l of q.lines) expect(l.unitPrice.amount % rules.priceStep).toBe(0);
    }
  });

  it("is deterministic", () => {
    expect(price(single, rules, grid)).toEqual(price(single, rules, grid));
  });
});
