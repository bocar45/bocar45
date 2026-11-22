import { describe, expect, it } from "vitest";
import { parseSizes, publishBlockers, slugify, toKey, validateZone } from "./catalog.ts";

describe("catalog helpers", () => {
  it("slugifies French names", () => {
    expect(slugify("T-shirt col rond 180 g")).toBe("t-shirt-col-rond-180-g");
    expect(slugify("  Mug céramique « Téranga » ")).toBe("mug-ceramique-teranga");
    expect(toKey("Poitrine gauche")).toBe("poitrine_gauche");
  });

  it("parses sizes in the usual order", () => {
    expect(parseSizes("xl, s ;M  L, s")).toEqual(["S", "M", "L", "XL"]);
    expect(parseSizes("Unique")).toEqual(["UNIQUE"]);
    expect(parseSizes("")).toEqual([]);
  });

  it("validates zones", () => {
    expect(validateZone({ key: "front_center", maxWidthMm: 300, maxHeightMm: 400, techniques: ["dtf"] })).toEqual([]);
    expect(validateZone({ key: "Devant!", maxWidthMm: 0, maxHeightMm: 5000, techniques: [] })).toHaveLength(4);
    expect(validateZone({ key: "x_1", maxWidthMm: 10, maxHeightMm: 10, techniques: ["laser"] })).toEqual(["Technique inconnue."]);
  });

  it("lists what blocks publication", () => {
    expect(publishBlockers({ name: "Tee", variants: 2, views: 1, zones: 1, zonesWithoutTechnique: 0 })).toEqual([]);
    expect(publishBlockers({ name: "", variants: 0, views: 0, zones: 0, zonesWithoutTechnique: 0 })).toHaveLength(4);
  });
});
