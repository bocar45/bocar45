/**
 * Image tools of the studio (E18c). Pure functions on RGBA pixels, so they are tested without a browser.
 * The studio decodes the image, applies one operation and stores the result as a new image (undoable).
 */
export interface Pixels { width: number; height: number; data: Uint8ClampedArray }

export const pixels = (width: number, height: number, data?: Uint8ClampedArray): Pixels =>
  ({ width, height, data: data ?? new Uint8ClampedArray(width * height * 4) });

const dist = (d: Uint8ClampedArray, i: number, c: [number, number, number]) =>
  Math.hypot(d[i]! - c[0], d[i + 1]! - c[1], d[i + 2]! - c[2]);

/** Most frequent opaque colour along the border: the background of a typical logo or photo of a logo. */
export function borderColor(img: Pixels): [number, number, number] {
  const counts = new Map<string, number>();
  const { width: w, height: h, data } = img;
  const visit = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3]! < 128) return;
    const key = [data[i]! >> 3, data[i + 1]! >> 3, data[i + 2]! >> 3].join(","); // tolerate light noise
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < w; x++) { visit(x, 0); visit(x, h - 1); }
  for (let y = 0; y < h; y++) { visit(0, y); visit(w - 1, y); }
  let best = "31,31,31", n = -1;
  for (const [k, c] of counts) if (c > n) { best = k; n = c; }
  const [r, g, b] = best.split(",").map((v) => Number(v) * 8 + 4) as [number, number, number];
  return [r, g, b];
}

/**
 * Make `color` transparent. `tolerance` (0–100) widens the match; pixels just above the threshold fade out
 * (soft edge) instead of leaving a hard halo. Only pixels connected to the border are removed when `fromEdges`.
 */
export function removeColor(img: Pixels, color: [number, number, number], tolerance: number, fromEdges = true): Pixels {
  const out = pixels(img.width, img.height, new Uint8ClampedArray(img.data));
  const t = (Math.max(0, Math.min(100, tolerance)) / 100) * 255;
  const soft = Math.max(8, t * 0.35);
  const { width: w, height: h } = img;
  const d = out.data;
  const apply = (i: number) => {
    const k = dist(d, i, color);
    if (k <= t) d[i + 3] = 0;
    else if (k <= t + soft) d[i + 3] = Math.round(d[i + 3]! * ((k - t) / soft));
  };
  if (!fromEdges) {
    for (let i = 0; i < d.length; i += 4) apply(i);
    return out;
  }
  // Flood fill from the border: an inner area of the same colour (e.g. the white of an eye) is kept.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (dist(d, i, color) > t + soft) continue;
    apply(i);
    const x = p % w, y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  return out;
}

export function invert(img: Pixels): Pixels {
  const out = pixels(img.width, img.height, new Uint8ClampedArray(img.data));
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255 - out.data[i]!;
    out.data[i + 1] = 255 - out.data[i + 1]!;
    out.data[i + 2] = 255 - out.data[i + 2]!;
  }
  return out;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Smallest rectangle holding every visible pixel (alpha ≥ 8). null if the image is empty. */
export function opaqueBounds(img: Pixels): Rect | null {
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3]! >= 8) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function crop(img: Pixels, r: Rect): Pixels {
  const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
  const w = Math.max(1, Math.min(img.width - x0, Math.floor(r.w))), h = Math.max(1, Math.min(img.height - y0, Math.floor(r.h)));
  const out = pixels(w, h);
  for (let y = 0; y < h; y++) out.data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4);
  return out;
}

/** Crop by percentages taken from each side (0–45 %), as typed in the studio. */
export function cropPercent(img: Pixels, p: { left: number; right: number; top: number; bottom: number }): Pixels {
  const c = (v: number) => Math.max(0, Math.min(45, v)) / 100;
  const x = img.width * c(p.left), y = img.height * c(p.top);
  return crop(img, { x, y, w: img.width * (1 - c(p.left) - c(p.right)), h: img.height * (1 - c(p.top) - c(p.bottom)) });
}

/**
 * Halftone: the image becomes round dots of one colour on a transparent background, dot area proportional to the
 * darkness (and opacity) of each cell. `cellPx` is the dot pitch in source pixels.
 */
export function halftone(img: Pixels, cellPx: number, ink: [number, number, number]): Pixels {
  const cell = Math.max(2, Math.round(cellPx));
  const out = pixels(img.width, img.height);
  const { width: w, height: h, data } = img;
  for (let cy = 0; cy < h; cy += cell) for (let cx = 0; cx < w; cx += cell) {
    let dark = 0, n = 0;
    for (let y = cy; y < Math.min(h, cy + cell); y++) for (let x = cx; x < Math.min(w, cx + cell); x++) {
      const i = (y * w + x) * 4;
      const lum = (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
      dark += (1 - lum) * (data[i + 3]! / 255);
      n++;
    }
    const coverage = n ? dark / n : 0;
    const r = (cell / 2) * Math.sqrt(coverage) * Math.SQRT2; // dot area ∝ coverage (touching at 50 %)
    const mx = cx + cell / 2, my = cy + cell / 2;
    for (let y = cy; y < Math.min(h, cy + cell); y++) for (let x = cx; x < Math.min(w, cx + cell); x++) {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      const a = Math.max(0, Math.min(1, r - d + 0.5)); // anti-aliased edge
      if (a <= 0) continue;
      const i = (y * w + x) * 4;
      out.data[i] = ink[0]; out.data[i + 1] = ink[1]; out.data[i + 2] = ink[2]; out.data[i + 3] = Math.round(a * 255);
    }
  }
  return out;
}

export const hexToRgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
export const rgbToHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** Turn the tracer's SVG output into safe vector paths; transparent or background-coloured shapes can be dropped. */
export function pathsFromTracedSvg(svg: string, opts: { drop?: [number, number, number] | null; tolerance?: number } = {}): { d: string; fill: string }[] {
  const out: { d: string; fill: string }[] = [];
  const re = /<path\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const attrs = m[1]!;
    const d = /\sd="([^"]*)"/.exec(attrs)?.[1]?.trim();
    const fill = /fill="rgb\((\d+),(\d+),(\d+)\)"/.exec(attrs);
    const opacity = Number(/opacity="([\d.]+)"/.exec(attrs)?.[1] ?? "1");
    if (!d || !fill || opacity < 0.5 || !/^[MmLlHhVvCcSsQqTtZz0-9eE.,\s-]+$/.test(d)) continue;
    const rgb: [number, number, number] = [Number(fill[1]), Number(fill[2]), Number(fill[3])];
    if (opts.drop && Math.hypot(rgb[0] - opts.drop[0], rgb[1] - opts.drop[1], rgb[2] - opts.drop[2]) <= (opts.tolerance ?? 40)) continue;
    out.push({ d, fill: rgbToHex(...rgb) });
  }
  return out;
}

/** Colour used to stand for transparency while tracing (vivid magenta: practically never part of a logo). */
export const TRACE_KEY: [number, number, number] = [255, 0, 255];

/**
 * The tracer ignores transparency: transparent areas would merge into a neighbouring colour (a round logo becomes a
 * square). They are painted in TRACE_KEY first, and the shapes of that colour are dropped afterwards.
 */
export function flattenTransparency(img: Pixels, key: [number, number, number] = TRACE_KEY): Pixels {
  const out = pixels(img.width, img.height, new Uint8ClampedArray(img.data));
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]! / 255;
    d[i] = Math.round(d[i]! * a + key[0] * (1 - a));
    d[i + 1] = Math.round(d[i + 1]! * a + key[1] * (1 - a));
    d[i + 2] = Math.round(d[i + 2]! * a + key[2] * (1 - a));
    d[i + 3] = 255;
  }
  return out;
}

/** Shapes to drop after tracing: the transparency key always, the background colour when asked. */
export function tracedPaths(svg: string, background: [number, number, number] | null): { d: string; fill: string }[] {
  const withoutKey = pathsFromTracedSvg(svg, { drop: TRACE_KEY, tolerance: 90 });
  if (!background) return withoutKey;
  return withoutKey.filter((p) => {
    const [r, g, b] = hexToRgb(p.fill);
    return Math.hypot(r - background[0], g - background[1], b - background[2]) > 60;
  });
}

/**
 * Main colours of a logo, used as the exact palette for vectorisation so a logo keeps its real colours.
 * Only "interior" pixels count (same colour as their 4 neighbours): the anti-aliased edges, which mix two colours,
 * never become a colour of their own. Colours are picked by frequency (a colour must cover ≥ 0.5 % of the interior),
 * and each one is the most frequent exact colour of its group, never an average.
 */
export function dominantColors(img: Pixels, n: number): [number, number, number][] {
  const { width: w, height: h, data } = img;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 60000)));
  const near = (i: number, j: number) =>
    data[j + 3]! >= 128 && Math.abs(data[i]! - data[j]!) + Math.abs(data[i + 1]! - data[j + 1]!) + Math.abs(data[i + 2]! - data[j + 2]!) <= 24;
  const pts: number[] = []; // packed 0xRRGGBB
  for (let y = 1; y < h - 1; y += step) for (let x = 1; x < w - 1; x += step) {
    const i = (y * w + x) * 4;
    if (data[i + 3]! < 128) continue;
    if (!near(i, i - 4) || !near(i, i + 4) || !near(i, i - w * 4) || !near(i, i + w * 4)) continue;
    pts.push((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
  }
  if (pts.length === 0) {
    // tiny or noisy image: fall back to every opaque pixel
    for (let p = 0; p < w * h; p++) { const i = p * 4; if (data[i + 3]! >= 128) pts.push((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!); }
  }
  if (pts.length === 0) return [];
  const rgb = (v: number): [number, number, number] => [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
  // histogram of coarse buckets (4 bits per channel), each bucket remembers its mean colour
  const buckets = new Map<number, { count: number; sum: [number, number, number] }>();
  for (const v of pts) {
    const k = ((v >> 20) & 15) << 8 | ((v >> 12) & 15) << 4 | ((v >> 4) & 15);
    const b = buckets.get(k) ?? { count: 0, sum: [0, 0, 0] };
    const c = rgb(v);
    b.count++; b.sum[0] += c[0]; b.sum[1] += c[1]; b.sum[2] += c[2];
    buckets.set(k, b);
  }
  const minCount = Math.max(1, pts.length * 0.005);
  const centers: [number, number, number][] = [];
  for (const b of [...buckets.values()].sort((a, z) => z.count - a.count)) {
    if (centers.length >= n || b.count < minCount) break;
    const c: [number, number, number] = [b.sum[0] / b.count, b.sum[1] / b.count, b.sum[2] / b.count];
    if (centers.every((o) => dist(o, c) > 40)) centers.push(c);
  }
  // snap each centre on the most frequent exact colour of its group
  const groups = centers.map(() => new Map<number, number>());
  for (const v of pts) {
    const c = rgb(v);
    let bi = 0, bd = Infinity;
    centers.forEach((o, ci) => { const d = dist(c, o); if (d < bd) { bd = d; bi = ci; } });
    if (bd <= 40) groups[bi]!.set(v, (groups[bi]!.get(v) ?? 0) + 1);
  }
  return groups.map((g, ci) => {
    let best = -1, bc = 0;
    for (const [v, cnt] of g) if (cnt > bc) { bc = cnt; best = v; }
    return best >= 0 ? rgb(best) : (centers[ci]!.map(Math.round) as [number, number, number]);
  });
}
