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
  it("keeps every standard zone inside the garment", () => {
    for (const kind of ["tee", "polo", "hoodie"] as const) {
      const poly = outline(kind);
      for (const key of ["front_center", "chest_left", "back_center", "left_sleeve", "right_sleeve"]) {
        const size = key.includes("sleeve") ? 50 : key === "chest_left" ? 100 : 280;
        const p = placeZone(kind, { key, maxWidthMm: size, maxHeightMm: size });
        for (const [x, y] of [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]] as const) {
          expect(pointInPolygon(x, y, poly), `${kind} ${key} (${x}, ${y})`).toBe(true);
        }
      }
    }
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
