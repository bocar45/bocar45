import { pixels, type Pixels } from "./image-ops";

/**
 * E22 — automatic background removal (salient object), pure parts. The model (U²-Net small, « u2netp », Apache 2.0)
 * runs in the browser; these functions prepare its input and apply its mask, and are tested without it.
 */
export const U2NET_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

/** RGB of a 320×320 image → NCHW float tensor data normalised like U²-Net's training (image ÷ its max, then mean/std). */
export function u2netInput(img: Pixels): Float32Array {
  const n = img.width * img.height;
  let max = 1;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) max = Math.max(max, img.data[i * 4 + c]!);
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[c * n + i] = (img.data[i * 4 + c]! / max - MEAN[c]!) / STD[c]!;
  return out;
}

/**
 * Apply a model mask (values in any range, size mw×mh) as the alpha of the original image: min-max normalised,
 * bilinear upsampling, soft edges kept, near-zero cleared. The colours are untouched (the original stays in history).
 */
export function applyMask(img: Pixels, mask: Float32Array, mw: number, mh: number): Pixels {
  let lo = Infinity, hi = -Infinity;
  for (const v of mask) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  const at = (x: number, y: number) => (mask[Math.min(mh - 1, y) * mw + Math.min(mw - 1, x)]! - lo) / span;
  const out = pixels(img.width, img.height, new Uint8ClampedArray(img.data));
  for (let y = 0; y < img.height; y++) {
    const fy = ((y + 0.5) * mh) / img.height - 0.5, y0 = Math.max(0, Math.floor(fy)), ty = Math.max(0, fy - y0);
    for (let x = 0; x < img.width; x++) {
      const fx = ((x + 0.5) * mw) / img.width - 0.5, x0 = Math.max(0, Math.floor(fx)), tx = Math.max(0, fx - x0);
      const m = (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
      const a = m < 0.05 ? 0 : m > 0.95 ? 1 : m;
      const i = (y * img.width + x) * 4 + 3;
      out.data[i] = Math.round(out.data[i]! * a);
    }
  }
  return out;
}

/** The model gives probabilities (0..1): no confident pixel means no clear subject (avoid stretching noise). */
export function hasSubject(mask: Float32Array, threshold = 0.5): boolean {
  for (const v of mask) if (v >= threshold) return true;
  return false;
}
