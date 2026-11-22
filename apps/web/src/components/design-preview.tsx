"use client";

import type { DesignDocument } from "@sawwa/design";
import { LayerShape, isDark } from "./studio/canvas";

/** Read-only rendering of every printed zone of a design, at real proportions. */
export function DesignPreview({ doc, zones, urls, garmentHex }: {
  doc: DesignDocument; zones: { key: string; label: string; maxWidthMm: number; maxHeightMm: number }[];
  urls: Record<string, string>; garmentHex: string;
}) {
  const surfaces = doc.surfaces.filter((s) => s.layers.some((l) => !l.hidden));
  if (surfaces.length === 0) return <p className="text-sm text-muted">Création vide.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {surfaces.map((s) => {
        const z = zones.find((x) => x.key === s.zoneKey);
        const W = z?.maxWidthMm ?? 300;
        const H = z?.maxHeightMm ?? 400;
        const m = Math.max(W, H) * 0.06;
        return (
          <figure key={s.zoneKey} className="grid gap-2">
            <svg viewBox={`${-m} ${-m} ${W + 2 * m} ${H + 2 * m}`} className="w-full rounded-xl" role="img" aria-label={`Zone ${z?.label ?? s.zoneKey}`}>
              <rect x={-m} y={-m} width={W + 2 * m} height={H + 2 * m} fill={garmentHex} />
              <rect x="0" y="0" width={W} height={H} fill="none" stroke={isDark(garmentHex) ? "#E08A5F" : "#93421D"} strokeDasharray="6 4" strokeWidth={Math.max(W, H) * 0.004} />
              {s.layers.filter((l) => !l.hidden).map((l) => (
                <g key={l.id} transform={`translate(${l.xMm} ${l.yMm}) rotate(${l.rotation})`}>
                  <LayerShape layer={l} url={l.type === "image" ? urls[l.src] : undefined} />
                </g>
              ))}
            </svg>
            <figcaption className="text-sm"><b>{z?.label ?? s.zoneKey}</b> <span className="text-muted">· {s.technique}</span></figcaption>
          </figure>
        );
      })}
    </div>
  );
}
