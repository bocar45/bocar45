import type { DesignDocument } from "./document.ts";
import { printedArea, solidColors } from "./geometry.ts";

export interface ZoneSize { key: string; maxWidthMm: number; maxHeightMm: number }

/** Decorations to price: one per surface that prints something, sized to what is actually printed. */
export function decorationsFor(doc: DesignDocument, zones: ZoneSize[]) {
  return doc.surfaces.flatMap((s) => {
    const zone = zones.find((z) => z.key === s.zoneKey);
    if (!zone) return [];
    const area = printedArea(s, zone);
    if (!area) return [];
    return [{ zoneKey: s.zoneKey, technique: s.technique, widthMm: area.widthMm, heightMm: area.heightMm, colors: Math.max(1, solidColors(s).length) }];
  });
}
