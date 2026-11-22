import { describe, expect, it } from "vitest";
import { GARMENTS, distanceToOutline, inflate, modelKindFor, mugArc, outline, placeZone, pointInPolygon, uvFor } from "./garment";

describe("3D calibration (E18)", () => {
  it("puts the front print 7 cm below the front neckline", () => {
    const p = placeZone("tee", { key: "front_center", maxWidthMm: 300, maxHeightMm: 400 });
    expect(p).toEqual({ panel: "front", x: -150, y: GARMENTS.tee.neckFront + 70, w: 300, h: 400 });
    // A logo drawn 70 mm below the top of the zone lands 140 mm below the neckline on the garment.
    expect(p.y + 70 - GARMENTS.tee.neckFront).toBe(140);
  });
  it("puts the left-chest logo on the wearer's left, the back print on the back panel", () => {
    expect(placeZone("tee", { key: "chest_left", maxWidthMm: 100, maxHeightMm: 100 })).toMatchObject({ panel: "front", x: 60 });
    expect(placeZone("hoodie", { key: "back_center", maxWidthMm: 300, maxHeightMm: 400 })).toMatchObject({ panel: "back", y: GARMENTS.hoodie.neckBack + 70 });
    expect(placeZone("tee", { key: "back_neck_label", maxWidthMm: 80, maxHeightMm: 40 })).toMatchObject({ panel: "back", y: GARMENTS.tee.neckBack + 40 });
  });
  it("keeps the usual print sizes inside the garment, with English and French zone keys", () => {
    // Usual sizes: sleeve 9 × 9 cm, left chest 10 × 10 cm, front and back 30 × 40 cm (25 × 35 cm on the tote).
    const cases: [string, number, number][] = [
      ["front_center", 300, 400], ["devant", 300, 400], ["back_center", 300, 400], ["dos", 300, 400],
      ["chest_left", 100, 100], ["poitrine_gauche", 100, 100], ["coeur", 100, 100],
      ["left_sleeve", 90, 90], ["manche_gauche", 90, 90], ["right_sleeve", 90, 90], ["manche_droite", 90, 90],
      ["nuque", 80, 40],
    ];
    for (const kind of ["tee", "polo", "hoodie"] as const) {
      const poly = outline(kind);
      for (const [key, w, h] of cases) {
        const p = placeZone(kind, { key, maxWidthMm: w, maxHeightMm: h });
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
          const x = p.x + (p.w * i) / 4, y = p.y + (p.h * j) / 4;
          expect(pointInPolygon(x, y, poly), `${kind} ${key} ${w}×${h} (${x}, ${y})`).toBe(true);
        }
      }
    }
    const tote = outline("tote");
    const p = placeZone("tote", { key: "front", maxWidthMm: 250, maxHeightMm: 350 });
    for (const [x, y] of [[p.x, p.y], [p.x + p.w, p.y + p.h]] as const) expect(pointInPolygon(x, y, tote)).toBe(true);
  });
  it("sends French zone keys to the right place", () => {
    expect(placeZone("tee", { key: "dos", maxWidthMm: 300, maxHeightMm: 400 }).panel).toBe("back");
    expect(placeZone("tee", { key: "nuque", maxWidthMm: 80, maxHeightMm: 40 })).toMatchObject({ panel: "back", y: GARMENTS.tee.neckBack + 40 });
    expect(placeZone("tee", { key: "poitrine_gauche", maxWidthMm: 100, maxHeightMm: 100 }).x).toBe(60);
    expect(placeZone("tee", { key: "manche_droite", maxWidthMm: 90, maxHeightMm: 90 }).x).toBeLessThan(0);
  });
  it("mirrors the back texture so that it reads correctly from behind", () => {
    const [uf] = uvFor("tee", "front", 100, 300);
    const [ub] = uvFor("tee", "back", 100, 300);
    expect(uf + ub).toBeCloseTo(1);
  });
  it("inflates panels smoothly towards the seams", () => {
    const poly = outline("tee");
    expect(distanceToOutline(0, 400, poly)).toBeGreaterThan(200);
    expect(inflate(0, 55)).toBe(0);
    expect(inflate(300, 55)).toBeGreaterThan(54);
  });
  it("wraps a mug print on the right arc and picks the model from the product", () => {
    expect(mugArc(200, 41)).toBeCloseTo(200 / 41);
    expect(mugArc(1000, 41)).toBeCloseTo(2 * Math.PI);
    expect(modelKindFor("hoodie-molleton-300-g")).toBe("hoodie");
    expect(modelKindFor("mug-ceramique-33cl")).toBe("mug");
    expect(modelKindFor("t-shirt-col-rond-180-g")).toBe("tee");
  });
});
