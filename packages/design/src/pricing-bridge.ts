import type { DesignDocument } from "./document.ts";
import { printedArea, solidColors } from "./geometry.ts";
import type { PatternSpec } from "./pattern.ts";

export interface ZoneSize { key: string; maxWidthMm: number; maxHeightMm: number; pattern?: PatternSpec | null }

/**
 * Decorations to price: one per surface that prints something, sized to what is actually printed.
 * E18b: a pattern piece is printed in full (to its bleed) as soon as it carries a design or the continuous motif,
 * once per cut piece (two sleeves = two decorations); sublimation has no colour limit.
 */
export function decorationsFor(doc: DesignDocument, zones: ZoneSize[]) {
  const out: { zoneKey: string; technique: string; widthMm: number; heightMm: number; colors: number }[] = [];
  for (const zone of zones.filter((z) => z.pattern)) {
    const s = doc.surfaces.find((x) => x.zoneKey === zone.key);
    const printed = doc.allOver || (s && printedArea(s, zone));
    if (!printed) continue;
    for (let i = 0; i < (zone.pattern!.quantity || 1); i++) {
      out.push({ zoneKey: zone.key, technique: s?.technique ?? "sublimation", widthMm: zone.maxWidthMm, heightMm: zone.maxHeightMm, colors: 1 });
    }
  }
  for (const s of doc.surfaces) {
    const zone = zones.find((z) => z.key === s.zoneKey);
    if (!zone || zone.pattern) continue;
    const area = printedArea(s, zone);
    if (!area) continue;
    out.push({ zoneKey: s.zoneKey, technique: s.technique, widthMm: area.widthMm, heightMm: area.heightMm, colors: Math.max(1, solidColors(s).length) });
  }
  return out;
}
