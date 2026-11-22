"use client";

import type { DesignDocument } from "@sawwa/design";
import { LayerShape } from "./studio/canvas";

/** Gallery thumbnail of a template: its first printed zone on the product colour, at real proportions. */
export function TemplateThumb({ doc, zones, urls, garmentHex, label }: {
  doc: DesignDocument; zones: { key: string; maxWidthMm: number; maxHeightMm: number }[]; urls: Record<string, string>; garmentHex: string; label: string;
}) {
  const s = doc.surfaces.find((x) => x.layers.some((l) => !l.hidden));
  const z = zones.find((x) => x.key === s?.zoneKey);
  const W = z?.maxWidthMm ?? 300, H = z?.maxHeightMm ?? 300;
  const m = Math.max(W, H) * 0.12;
  return (
    <svg viewBox={`${-m} ${-m} ${W + 2 * m} ${H + 2 * m}`} className="aspect-square w-full" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <rect x={-m} y={-m} width={W + 2 * m} height={H + 2 * m} fill={garmentHex} />
      {s?.layers.filter((l) => !l.hidden).map((l) => (
        <g key={l.id} transform={`translate(${l.xMm} ${l.yMm}) rotate(${l.rotation})`}>
          <LayerShape layer={l} url={l.type === "image" ? urls[l.src] : undefined} />
        </g>
      ))}
    </svg>
  );
}
