import { describe, expect, it } from "vitest";
import { price } from "@sawwa/pricing";
import { offerField, parseOfferForm, type OfferZone } from "./offer-form";

const zones: OfferZone[] = [
  { id: "z1", key: "front_center", max_width_mm: 300, max_height_mm: 400, allowed_techniques: ["dtf", "dtg"] },
  { id: "z2", key: "chest_left", max_width_mm: 100, max_height_mm: 100, allowed_techniques: ["embroidery"] },
];
const ctx = { vendorId: "ven_a", version: 2, variantIds: ["v1", "v2", "v3"], zones };

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

const dtf = offerField.key("z1", "dtf");
const emb = offerField.key("z2", "embroidery");
const filled = {
  active: "on", min_qty: "1", lead_time_days: "4",
  [offerField.variant("v1")]: "on", [offerField.variant("v2")]: "on",
  [offerField.blank(0)]: "2 500", [offerField.blank(2)]: "2200",
  [offerField.cap(dtf)]: "on", [offerField.width(dtf)]: "280", [offerField.height(dtf)]: "350",
  [offerField.cost(dtf, 0)]: "2000", [offerField.cost(dtf, 3)]: "1400",
  [offerField.cap(emb)]: "on", [offerField.colors(emb)]: "8", [offerField.setup(emb)]: "5 000",
  [offerField.cost(emb, 0)]: "1500",
};

describe("workshop offer form", () => {
  it("turns the editor fields into offer rows and a usable price grid", () => {
    const r = parseOfferForm(form(filled), ctx);
    expect(r.errors).toEqual([]);
    expect(r).toMatchObject({ status: "active", minQty: 1, leadTimeDays: 4, variantIds: ["v1", "v2"] });
    expect(r.capabilities).toEqual([
      { zone_id: "z1", technique: "dtf", max_width_mm: 280, max_height_mm: 350, max_colors: null },
      { zone_id: "z2", technique: "embroidery", max_width_mm: 100, max_height_mm: 100, max_colors: 8 },
    ]);
    expect(r.grid.blanks.v1).toEqual([{ minQty: 1, unitCost: 2500 }, { minQty: 25, unitCost: 2200 }]);
    const q = price(
      { category: "tshirt", lines: [{ variantId: "v2", quantity: 50 }], decorations: [{ zoneKey: "front_center", technique: "dtf", widthMm: 250, heightMm: 300 }] },
      { version: 1, currency: "XOF", defaultMarginBps: 3500, minMarginPerUnit: 500, vatBps: 1800, priceStep: 50 },
      r.grid,
    );
    expect(q.lines[0]?.vendorUnitCost.amount).toBe(2200 + 1400);
  });

  it("refuses a capability larger than the reference zone and unreadable amounts", () => {
    const r = parseOfferForm(form({ ...filled, [offerField.width(dtf)]: "320", [offerField.cost(emb, 1)]: "12,5" }), ctx);
    expect(r.errors).toContain("front_center · dtf : dimensions entre 1 et 300 × 400 mm.");
    expect(r.errors).toContain("chest_left · embroidery, 10 pc : montant invalide.");
  });

  it("explains what is missing on an empty form", () => {
    const r = parseOfferForm(form({}), ctx);
    expect(r.status).toBe("draft");
    expect(r.errors).toEqual(["Choisissez au moins une couleur/taille disponible.", "Activez au moins une zone et une technique."]);
  });

});
