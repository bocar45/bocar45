import { describe, expect, it } from "vitest";
import { pixels } from "./image-ops";
import { applyMask, u2netInput } from "./segment-ops";

describe("automatic background removal (E22)", () => {
  it("normalises the model input channel by channel (NCHW)", () => {
    const img = pixels(2, 1);
    img.data.set([255, 0, 0, 255, 0, 0, 255, 255]);
    const t = u2netInput(img);
    expect(t).toHaveLength(6);
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 4); // R of pixel 0
    expect(t[1]).toBeCloseTo((0 - 0.485) / 0.229, 4); // R of pixel 1
    expect(t[5]).toBeCloseTo((1 - 0.406) / 0.225, 4); // B of pixel 1
  });
  it("keeps the subject, clears the background, upsamples the mask and keeps colours", () => {
    const img = pixels(8, 8);
    for (let i = 0; i < 64; i++) img.data.set([200, 100, 50, 255], i * 4);
    // 4×4 mask: subject in the 2×2 centre, raw scores (not 0..1)
    const mask = new Float32Array([-5, -5, -5, -5, -5, 9, 9, -5, -5, 9, 9, -5, -5, -5, -5, -5]);
    const out = applyMask(img, mask, 4, 4);
    const alpha = (x: number, y: number) => out.data[(y * 8 + x) * 4 + 3];
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(7, 7)).toBe(0);
    expect(alpha(3, 3)).toBe(255);
    expect(alpha(4, 4)).toBe(255);
    expect(Array.from(out.data.slice((3 * 8 + 3) * 4, (3 * 8 + 3) * 4 + 3))).toEqual([200, 100, 50]);
    expect(Array.from(img.data.slice(3, 4))).toEqual([255]); // original untouched
  });
});
