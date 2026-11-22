import type { DesignDocument, Layer } from "@sawwa/design";

/**
 * « Placer ici » : move a layer to another zone, centred. It keeps its size when it fits (90 % of the zone at most),
 * otherwise it is scaled down proportionally. Text scales through its font size. Empty surfaces are dropped.
 */
export function moveLayerToZone(
  doc: DesignDocument, layerId: string, fromZone: string,
  target: { key: string; maxWidthMm: number; maxHeightMm: number; technique: string },
): DesignDocument {
  const source = doc.surfaces.find((s) => s.zoneKey === fromZone);
  const layer = source?.layers.find((l) => l.id === layerId);
  if (!layer || target.key === fromZone) return doc;
  const f = Math.min(1, (target.maxWidthMm * 0.9) / Math.max(layer.widthMm, 1), (target.maxHeightMm * 0.9) / Math.max(layer.heightMm, 1));
  const moved = {
    ...layer, xMm: target.maxWidthMm / 2, yMm: target.maxHeightMm / 2, widthMm: layer.widthMm * f, heightMm: layer.heightMm * f,
    ...(layer.type === "text" ? { sizeMm: Math.max(2, Math.round(layer.sizeMm * f * 10) / 10) } : {}),
  } as Layer;
  const without = doc.surfaces.map((s) => (s.zoneKey === fromZone ? { ...s, layers: s.layers.filter((l) => l.id !== layerId) } : s));
  const existing = without.find((s) => s.zoneKey === target.key);
  const surfaces = existing
    ? without.map((s) => (s.zoneKey === target.key ? { ...s, layers: [...s.layers, moved] } : s))
    : [...without, { zoneKey: target.key, technique: target.technique, layers: [moved] }];
  return { ...doc, surfaces: surfaces.filter((s) => s.layers.length > 0) };
}
