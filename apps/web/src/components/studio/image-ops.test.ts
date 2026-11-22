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

/** Same logo drawn twice as large: the white eye is 4 × 4 px, like a real (small) detail. */
function bigLogo(): Pixels {
  const src = logo(), img = pixels(40, 40);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
    const i = ((y >> 1) * 20 + (x >> 1)) * 4;
    img.data.set(src.data.slice(i, i + 4), (y * 40 + x) * 4);
  }
  return img;
}

const BLUE = [47, 75, 124], OCRE = [201, 146, 62], BROWN = [42, 26, 18];
/**
 * A realistic exported logo: white background, blue disc, brown triangle, ocre bar, thin brown "text" strokes,
 * drawn at 4× and box-filtered down, so every edge is anti-aliased (mixed colours that are not part of the logo).
 */
function antialiasedLogo(): Pixels {
  const S = 4, W = 160, H = 120;
  const colourAt = (x: number, y: number): number[] => {
    if (y > 92 && y < 100 && ((x > 40 && x < 44) || (x > 60 && x < 64) || (x > 80 && x < 84))) return BROWN; // text
    if (y > 70 && y < 80 && x > 30 && x < 130) return OCRE;
    const tx = x - 80, ty = y - 20;
    if (ty > 0 && ty < 40 && Math.abs(tx) < ty * 0.6) return BROWN;
    if ((x - 80) ** 2 + (y - 38) ** 2 < 30 ** 2) return BLUE;
    return [255, 255, 255];
  };
  const img = pixels(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const c = colourAt(x + (sx + 0.5) / S, y + (sy + 0.5) / S);
      acc[0]! += c[0]!; acc[1]! += c[1]!; acc[2]! += c[2]!;
    }
    img.data.set([...acc.map((v) => Math.round(v / (S * S))), 255], (y * W + x) * 4);
  }
  return img;
}
const close = (pal: number[][], expected: number[][]) =>
  expected.every((e) => pal.some((c) => Math.max(...c.map((v, k) => Math.abs(v - e[k]!))) <= 8));

describe("palette for vectorisation", () => {
  it("finds the real colours of a logo, not averages", () => {
    const pal = dominantColors(bigLogo(), 2).map((c) => c.join());
    expect(pal.sort()).toEqual(["255,255,255", "47,75,124"]);
    const onlyLogo = dominantColors(removeColor(bigLogo(), [255, 255, 255], 10), 3).map((c) => c.join());
    expect(onlyLogo.sort()).toEqual(["255,255,255", "47,75,124"]); // eye kept, only 2 distinct colours exist
  });
  it("ignores anti-aliased edges: 3 colours asked → exactly the 3 colours of the logo", () => {
    // as the studio does it: background colour removed everywhere before measuring the palette
    const direct = dominantColors(removeColor(antialiasedLogo(), [255, 255, 255], 12, false), 3);
    expect(direct).toHaveLength(3);
    expect(close(direct, [BLUE, OCRE, BROWN])).toBe(true);
    // after "Retirer le fond" (only the background touching the border)
    const noBg = dominantColors(removeColor(antialiasedLogo(), [255, 255, 255], 20), 3);
    expect(noBg).toHaveLength(3);
    expect(close(noBg, [BLUE, OCRE, BROWN])).toBe(true);
    // asking for more colours never invents an edge grey
    const more = dominantColors(removeColor(antialiasedLogo(), [255, 255, 255], 12, false), 5);
    expect(more).toHaveLength(3);
  });
});
