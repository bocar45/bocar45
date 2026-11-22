import { describe, expect, it } from "vitest";
import { decorationsFor, effectiveDpi, emptyDocument, layerBox, parseDesign, preflight, printedArea, type Surface } from "./index.ts";

const zone = { maxWidthMm: 300, maxHeightMm: 400 };
const text = (over: Partial<Extract<Surface["layers"][number], { type: "text" }>> = {}) => ({
  id: "t1", type: "text" as const, text: "TERANGA", font: "manrope" as const, sizeMm: 30, fill: "#2A1A12",
  xMm: 150, yMm: 60, rotation: 0, widthMm: 160, heightMm: 30, ...over,
});
const image = (over = {}) => ({ id: "i1", type: "image" as const, src: "idb:1", name: "logo.png", pxWidth: 2000, pxHeight: 2000, xMm: 150, yMm: 200, rotation: 0, widthMm: 200, heightMm: 200, ...over });

describe("geometry", () => {
  it("computes rotated bounding boxes", () => {
    const b = layerBox({ xMm: 100, yMm: 100, widthMm: 100, heightMm: 20, rotation: 90 });
    expect(b.minX).toBeCloseTo(90); expect(b.maxY).toBeCloseTo(150);
  });
  it("measures print resolution", () => {
    expect(effectiveDpi({ pxWidth: 2000, pxHeight: 2000, widthMm: 254, heightMm: 254 })).toBe(200);
  });
  it("measures the printed area for pricing", () => {
    const s: Surface = { zoneKey: "front", technique: "dtf", layers: [text(), image()] };
    expect(printedArea(s, zone)).toEqual({ widthMm: 200, heightMm: 255 }); // y 45 → 300
    expect(printedArea({ ...s, layers: [] }, zone)).toBeNull();
  });
});

describe("preflight", () => {
  it("accepts a clean DTF design", () => {
    expect(preflight({ zoneKey: "front", technique: "dtf", layers: [text(), image()] }, zone)).toEqual([]);
  });
  it("flags elements outside the zone", () => {
    const issues = preflight({ zoneKey: "front", technique: "dtf", layers: [text({ xMm: 290 })] }, zone);
    expect(issues.map((i) => i.code)).toEqual(["OUT_OF_ZONE"]);
  });
  it("grades image resolution: warning 150–199 dpi, error below", () => {
    const warn = preflight({ zoneKey: "f", technique: "dtg", layers: [image({ widthMm: 290, heightMm: 290 })] }, zone);
    expect(warn[0]).toMatchObject({ code: "LOW_DPI", severity: "warning" });
    const err = preflight({ zoneKey: "f", technique: "dtg", layers: [image({ pxWidth: 800, pxHeight: 800 })] }, zone);
    expect(err[0]).toMatchObject({ code: "LOW_DPI", severity: "error" });
  });
  it("applies embroidery rules: text size, colours, photos", () => {
    const layers = [text({ sizeMm: 5 }), image(), ...Array.from({ length: 13 }, (_, i) => ({ id: `s${i}`, type: "shape" as const, shape: "rect" as const, fill: `#${(i + 16).toString(16).padStart(2, "0")}0000`, xMm: 20, yMm: 20, rotation: 0, widthMm: 10, heightMm: 10 }))];
    const codes = preflight({ zoneKey: "chest", technique: "embroidery", layers }, zone).map((i) => i.code).sort();
    expect(codes).toEqual(["PHOTO_NOT_SUPPORTED", "TEXT_TOO_SMALL", "TOO_MANY_COLORS"]);
  });
  it("ignores hidden layers", () => {
    expect(preflight({ zoneKey: "f", technique: "dtf", layers: [text({ xMm: 999, hidden: true })] }, zone)).toEqual([]);
  });
});

describe("document", () => {
  it("validates untrusted JSON", () => {
    const doc = { ...emptyDocument("tee", "ivoire"), surfaces: [{ zoneKey: "front", technique: "dtf", layers: [text(), image()] }] };
    expect(parseDesign(JSON.parse(JSON.stringify(doc))).ok).toBe(true);
    const bad = parseDesign({ ...doc, surfaces: [{ zoneKey: "front", technique: "dtf", layers: [{ ...text(), fill: "red", font: "comic" }] }] });
    expect(bad.ok).toBe(false);
    expect(parseDesign(null).ok).toBe(false);
  });
  it("turns surfaces into priced decorations", () => {
    const doc = { ...emptyDocument("tee", "ivoire"), surfaces: [
      { zoneKey: "front", technique: "dtf", layers: [text(), image()] },
      { zoneKey: "back", technique: "dtf", layers: [] },
    ] };
    expect(decorationsFor(doc, [{ key: "front", ...zone }, { key: "back", ...zone }])).toEqual([
      { zoneKey: "front", technique: "dtf", widthMm: 200, heightMm: 255, colors: 1 },
    ]);
  });
});
