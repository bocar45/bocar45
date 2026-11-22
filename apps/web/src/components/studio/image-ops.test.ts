import { describe, expect, it } from "vitest";
import { TRACE_KEY, dominantColors, borderColor, crop, cropPercent, flattenTransparency, halftone, invert, opaqueBounds, pathsFromTracedSvg, pixels, removeColor, tracedPaths, type Pixels } from "./image-ops";

/** 20 × 20 white image with a 10 × 10 dark-blue square in the middle and a white "eye" inside it. */
function logo(): Pixels {
  const img = pixels(20, 20);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const i = (y * 20 + x) * 4;
    const inSquare = x >= 5 && x < 15 && y >= 5 && y < 15;
    const eye = x >= 9 && x < 11 && y >= 9 && y < 11;
    const [r, g, b] = inSquare && !eye ? [47, 75, 124] : [255, 255, 255];
    img.data.set([r, g, b, 255], i);
  }
  return img;
}
const alpha = (img: Pixels, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

describe("image tools", () => {
  it("finds the background colour on the border", () => {
    const [r, g, b] = borderColor(logo());
    expect(Math.min(r, g, b)).toBeGreaterThan(240);
  });
  it("removes the background but keeps the same colour enclosed in the logo", () => {
    const out = removeColor(logo(), [255, 255, 255], 10);
    expect(alpha(out, 0, 0)).toBe(0);
    expect(alpha(out, 7, 7)).toBe(255); // logo
    expect(alpha(out, 9, 9)).toBe(255); // white eye kept (not connected to the border)
    expect(alpha(removeColor(logo(), [255, 255, 255], 10, false), 9, 9)).toBe(0); // unless asked
  });
  it("inverts colours and keeps transparency", () => {
    const out = invert(removeColor(logo(), [255, 255, 255], 10));
    expect(Array.from(out.data.slice((7 * 20 + 7) * 4, (7 * 20 + 7) * 4 + 4))).toEqual([208, 180, 131, 255]);
    expect(alpha(out, 0, 0)).toBe(0);
  });
  it("trims empty borders and crops by percentage", () => {
    const transparent = removeColor(logo(), [255, 255, 255], 10);
    const b = opaqueBounds(transparent)!;
    expect(b).toEqual({ x: 5, y: 5, w: 10, h: 10 });
    expect(crop(transparent, b).width).toBe(10);
    expect(opaqueBounds(pixels(4, 4))).toBeNull();
    const c = cropPercent(logo(), { left: 25, right: 25, top: 10, bottom: 0 });
    expect([c.width, c.height]).toEqual([10, 18]);
  });
  it("makes halftone dots whose size follows the darkness", () => {
    const out = halftone(logo(), 4, [42, 26, 18]);
    expect(alpha(out, 0, 0)).toBe(0); // white → no dot
    expect(alpha(out, 6, 6)).toBe(255); // dark square → dot centre
    expect(out.data[(6 * 20 + 6) * 4]).toBe(42); // in the ink colour
  });
  it("keeps only safe paths from the tracer and drops the background", () => {
    const svg = '<svg><path fill="rgb(255,255,255)" stroke="none" opacity="1" d="M 0 0 L 20 0 Z" /><path fill="rgb(47,75,124)" opacity="1" d="M 5 5 L 15 5 L 15 15 Z" /><path fill="rgb(1,2,3)" d="M0 0" onload="x" /><path fill="rgb(9,9,9)" opacity="0" d="M 1 1 Z" /></svg>';
    expect(pathsFromTracedSvg(svg, { drop: [255, 255, 255] })).toEqual([{ d: "M 5 5 L 15 5 L 15 15 Z", fill: "#2F4B7C" }, { d: "M0 0", fill: "#010203" }]);
  });
});

describe("vectorisation preparation", () => {
  it("paints transparent areas in the key colour so they never merge into the logo", () => {
    const flat = flattenTransparency(removeColor(logo(), [255, 255, 255], 10));
    expect(Array.from(flat.data.slice(0, 4))).toEqual([...TRACE_KEY, 255]); // corner was transparent
    expect(Array.from(flat.data.slice((7 * 20 + 7) * 4, (7 * 20 + 7) * 4 + 4))).toEqual([47, 75, 124, 255]); // logo untouched
  });
  it("drops the key colour always and the background only when asked", () => {
    const svg = '<path fill="rgb(250,5,250)" d="M0 0 Z"/><path fill="rgb(255,255,255)" d="M1 1 Z"/><path fill="rgb(47,75,124)" d="M2 2 Z"/>';
    expect(tracedPaths(svg, null).map((p) => p.fill)).toEqual(["#FFFFFF", "#2F4B7C"]);
    expect(tracedPaths(svg, [255, 255, 255]).map((p) => p.fill)).toEqual(["#2F4B7C"]);
  });
});

describe("palette for vectorisation", () => {
  it("finds the real colours of a logo, not averages", () => {
    const pal = dominantColors(logo(), 2).map((c) => c.join());
    expect(pal.sort()).toEqual(["255,255,255", "47,75,124"]);
    const onlyLogo = dominantColors(removeColor(logo(), [255, 255, 255], 10), 3).map((c) => c.join());
    expect(onlyLogo.sort()).toEqual(["255,255,255", "47,75,124"]); // eye kept, only 2 distinct colours exist
  });
});
