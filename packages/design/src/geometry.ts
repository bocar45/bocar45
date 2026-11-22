import type { Layer, Surface } from "./document.ts";

export interface Box { minX: number; minY: number; maxX: number; maxY: number }

/** Axis-aligned bounding box of a layer, rotation included. */
export function layerBox(l: Pick<Layer, "xMm" | "yMm" | "widthMm" | "heightMm" | "rotation">): Box {
  const a = (l.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const hw = (l.widthMm / 2) * c + (l.heightMm / 2) * s;
  const hh = (l.widthMm / 2) * s + (l.heightMm / 2) * c;
  return { minX: l.xMm - hw, minY: l.yMm - hh, maxX: l.xMm + hw, maxY: l.yMm + hh };
}

export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  return boxes.reduce((u, b) => ({
    minX: Math.min(u.minX, b.minX), minY: Math.min(u.minY, b.minY),
    maxX: Math.max(u.maxX, b.maxX), maxY: Math.max(u.maxY, b.maxY),
  }));
}

export const visibleLayers = (s: Surface) => s.layers.filter((l) => !l.hidden);

/** Printed area of a surface (mm), clamped to the zone. null if nothing is printed. */
export function printedArea(s: Surface, zone: { maxWidthMm: number; maxHeightMm: number }): { widthMm: number; heightMm: number } | null {
  const u = unionBox(visibleLayers(s).map(layerBox));
  if (!u) return null;
  const w = Math.min(u.maxX, zone.maxWidthMm) - Math.max(u.minX, 0);
  const h = Math.min(u.maxY, zone.maxHeightMm) - Math.max(u.minY, 0);
  if (w <= 0 || h <= 0) return null;
  return { widthMm: Math.ceil(w), heightMm: Math.ceil(h) };
}

/** Effective print resolution of an image at its placed size. */
export function effectiveDpi(l: { pxWidth: number; pxHeight: number; widthMm: number; heightMm: number }): number {
  const dpiX = l.pxWidth / (l.widthMm / 25.4);
  const dpiY = l.pxHeight / (l.heightMm / 25.4);
  return Math.floor(Math.min(dpiX, dpiY));
}

/** Distinct solid colours used on a surface (images excluded). */
export function solidColors(s: Surface): string[] {
  const set = new Set<string>();
  for (const l of visibleLayers(s)) if (l.type !== "image") set.add(l.fill.toUpperCase());
  return [...set];
}
