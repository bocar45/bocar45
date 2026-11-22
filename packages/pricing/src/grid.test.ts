import { describe, expect, it } from "vitest";
import { buildVendorGrid, parseFcfa, validateVendorGrid, type GridForm } from "./grid.ts";
import { price } from "./price.ts";

const form: GridForm = {
  vendorId: "ven_a",
  version: 1,
  breakpoints: [1, 10, 25, 50, 100],
  variantIds: ["v_m", "v_l"],
  blankCosts: [2500, null, 2200, 2000, null],
  decorations: [
    { zoneKey: "front_center", technique: "dtf", maxWidthMm: 280, maxHeightMm: 350, costs: [2000, 1800, 1700, 1400, null] },
    { zoneKey: "chest_left", technique: "embroidery", maxWidthMm: 80, maxHeightMm: 80, maxColors: 8, costs: [1500, null, 1200, 1000, 900], setupFee: 5000 },
  ],
};

describe("vendor price grid from the workshop form", () => {
  const grid = buildVendorGrid(form);

  it("turns filled cells into tiers and skips blanks", () => {
    expect(grid.blanks.v_m).toEqual([{ minQty: 1, unitCost: 2500 }, { minQty: 25, unitCost: 2200 }, { minQty: 50, unitCost: 2000 }]);
    expect(grid.blanks.v_l).toEqual(grid.blanks.v_m);
    expect(grid.decorations[1]).toMatchObject({ setupFee: 5000, maxColors: 8 });
    expect(validateVendorGrid(grid)).toEqual([]);
  });

  it("is directly usable by the pricing engine", () => {
    const q = price(
      { category: "tshirt", lines: [{ variantId: "v_m", quantity: 30 }], decorations: [{ zoneKey: "front_center", technique: "dtf", widthMm: 250, heightMm: 300 }] },
      { version: 1, currency: "XOF", defaultMarginBps: 3500, minMarginPerUnit: 500, vatBps: 1800, priceStep: 50 },
      grid,
    );
    expect(q.lines[0]?.vendorUnitCost.amount).toBe(2200 + 1700);
  });

  it("reports missing and invalid prices in plain French", () => {
    const bad = buildVendorGrid({ ...form, variantIds: [], blankCosts: [null, null, 2200, null, null], decorations: [] });
    expect(validateVendorGrid(bad)).toEqual([
      "Choisissez au moins une couleur/taille disponible.",
      "Activez au moins une zone et une technique.",
    ]);
    const noFirstTier = buildVendorGrid({ ...form, blankCosts: [null, null, 2200, null, null] });
    expect(validateVendorGrid(noFirstTier)).toContain("Produit vierge : il manque un prix pour 1 pièce.");
    const negative = buildVendorGrid({ ...form, blankCosts: [-5, null, null, null, null] });
    expect(validateVendorGrid(negative)[0]).toMatch(/prix invalide/);
  });

  it("respects the workshop minimum quantity", () => {
    const g = buildVendorGrid({ ...form, minOrderQty: 25, blankCosts: [null, null, 2200, null, null], decorations: [{ ...form.decorations[0]!, costs: [null, null, 1700, null, null] }] });
    expect(validateVendorGrid(g)).toEqual([]);
  });
});

describe("parseFcfa", () => {
  it("reads amounts typed by people", () => {
    expect(parseFcfa("2 500")).toBe(2500);
    expect(parseFcfa("2500 F")).toBe(2500);
    expect(parseFcfa("1 200 FCFA")).toBe(1200);
    expect(parseFcfa("")).toBeNull();
    expect(parseFcfa("12,5")).toBeNaN();
  });
});
