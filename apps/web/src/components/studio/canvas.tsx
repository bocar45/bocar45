"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FONTS, motifOffset, motifTile, pathD, piecePolygons, type AllOver, type Layer, type PatternSpec, type Surface } from "@sawwa/design";

type Mode = "move" | "scale" | "rotate";
interface Drag { mode: Mode; id: string; start: { x: number; y: number }; layer: Layer }

export interface CanvasProps {
  surface: Surface;
  zone: { maxWidthMm: number; maxHeightMm: number; label: string; pattern?: PatternSpec | null };
  /** E18b: continuous motif under the pattern pieces. */
  allOver?: AllOver | null;
  garmentColor: string;
  selectedId: string | null;
  issueLayerIds: Set<string>;
  imageUrls: Record<string, string>;
  onSelect: (id: string | null) => void;
  onPreview: (id: string, patch: Partial<Layer>) => void;
  onCommit: () => void;
  onMeasure: (id: string, widthMm: number, heightMm: number) => void;
}

const SNAP_MM = 2;

export function StudioCanvas(p: CanvasProps) {
  const svg = useRef<SVGSVGElement>(null);
  const textRefs = useRef(new Map<string, SVGTextElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const { maxWidthMm: W, maxHeightMm: H } = p.zone;
  const m = Math.max(W, H) * 0.22;
  const dark = isDark(p.garmentColor);
  const ink = dark ? "#F2E9D8" : "#2A1A12";
  const piece = p.zone.pattern ? piecePolygons(p.zone.pattern) : null;
  const motif = piece && p.allOver ? motifTile(p.allOver) : null;
  const motifAt = motif ? motifOffset(p.zone.pattern ?? undefined, motif.size) : [0, 0];

  // Measure rendered text so geometry, preflight and price use the real size.
  useLayoutEffect(() => {
    for (const l of p.surface.layers) {
      if (l.type !== "text") continue;
      const el = textRefs.current.get(l.id);
      if (!el) continue;
      const b = el.getBBox();
      if (Math.abs(b.width - l.widthMm) > 0.5 || Math.abs(b.height - l.heightMm) > 0.5) p.onMeasure(l.id, Math.max(1, b.width), Math.max(1, b.height));
    }
  });

  const toMm = (e: { clientX: number; clientY: number }) => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const r = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: r.x, y: r.y };
  };

  const start = (e: ReactPointerEvent, layer: Layer, mode: Mode) => {
    e.stopPropagation();
    p.onSelect(layer.id);
    if (layer.locked) return;
    svg.current?.setPointerCapture(e.pointerId);
    setDrag({ mode, id: layer.id, start: toMm(e), layer });
  };

  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const pt = toMm(e);
    const l = drag.layer;
    if (drag.mode === "move") {
      let x = l.xMm + pt.x - drag.start.x;
      let y = l.yMm + pt.y - drag.start.y;
      const v = Math.abs(x - W / 2) < SNAP_MM;
      const h = Math.abs(y - H / 2) < SNAP_MM;
      if (v) x = W / 2;
      if (h) y = H / 2;
      setGuides({ v, h });
      p.onPreview(l.id, { xMm: round(x), yMm: round(y) });
    } else if (drag.mode === "scale") {
      const d0 = Math.hypot(drag.start.x - l.xMm, drag.start.y - l.yMm);
      const d1 = Math.hypot(pt.x - l.xMm, pt.y - l.yMm);
      const f = Math.max(0.05, d1 / Math.max(d0, 0.1));
      if (l.type === "text") p.onPreview(l.id, { sizeMm: round(Math.max(2, l.sizeMm * f)), widthMm: l.widthMm * f, heightMm: l.heightMm * f } as Partial<Layer>);
      else p.onPreview(l.id, { widthMm: round(Math.max(3, l.widthMm * f)), heightMm: round(Math.max(3, l.heightMm * f)) });
    } else {
      let a = (Math.atan2(pt.y - l.yMm, pt.x - l.xMm) * 180) / Math.PI + 90;
      a = ((a % 360) + 360) % 360;
      const snap = Math.round(a / 45) * 45;
      if (Math.abs(a - snap) < 4) a = snap % 360;
      p.onPreview(l.id, { rotation: Math.round(a) });
    }
  };

  const end = (e: ReactPointerEvent) => {
    if (!drag) return;
    svg.current?.releasePointerCapture(e.pointerId);
    setDrag(null);
    setGuides({ v: false, h: false });
    p.onCommit();
  };

  const selected = p.surface.layers.find((l) => l.id === p.selectedId && !l.hidden);
  const handle = Math.max(W, H) * 0.022;

  return (
    <svg
      ref={svg}
      viewBox={`${-m} ${-m} ${W + 2 * m} ${H + 2 * m}`}
      className="h-full w-full touch-none select-none"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerDown={() => p.onSelect(null)}
      role="application"
      aria-label={`Zone ${p.zone.label}, ${W / 10} × ${H / 10} cm`}
    >
      <rect x={-m} y={-m} width={W + 2 * m} height={H + 2 * m} rx={m * 0.4} fill={p.garmentColor} />
      <rect x={-m} y={-m} width={W + 2 * m} height={H + 2 * m} rx={m * 0.4} fill="url(#studio-weave)" opacity={0.5} />
      <defs>
        <pattern id="studio-weave" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6 L6 0" stroke={dark ? "#ffffff" : "#000000"} strokeOpacity="0.04" strokeWidth="1" />
        </pattern>
        <clipPath id="zone-clip"><rect x="0" y="0" width={W} height={H} /></clipPath>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="none" stroke={dark ? "#E08A5F" : "#93421D"} strokeWidth={Math.max(W, H) * 0.004} strokeDasharray={`${handle} ${handle * 0.7}`} />
      <text x={W / 2} y={-handle} textAnchor="middle" fontSize={handle * 1.1} fill={ink} opacity={0.65} fontFamily="var(--font-manrope)">
        {p.zone.label} · {W / 10} × {H / 10} cm
      </text>

      {piece && (
        // E18b: the piece as the workshop will cut it — continuous motif inside, printed edge, cut line, stitch line
        <g pointerEvents="none">
          <defs>
            <clipPath id="piece-clip"><path d={pathD(piece.print)} /></clipPath>
            {motif && (
              <pattern id="piece-motif" patternUnits="userSpaceOnUse" x={motifAt[0]} y={motifAt[1]} width={motif.size} height={motif.size}>
                <rect width={motif.size} height={motif.size} fill={motif.background} />
                {motif.shapes.map((s, i) => <path key={i} d={s.d} fill={s.fill} />)}
              </pattern>
            )}
          </defs>
          <path d={pathD(piece.print)} fill={motif ? "url(#piece-motif)" : "#FFFFFF"} />
        </g>
      )}

      {p.surface.layers.map((l) => (l.hidden ? null : (
        <g key={l.id} transform={`translate(${l.xMm} ${l.yMm}) rotate(${l.rotation})`} onPointerDown={(e) => start(e, l, "move")} style={{ cursor: l.locked ? "default" : "move" }}>
          <LayerShape layer={l} url={l.type === "image" ? p.imageUrls[l.src] : undefined} textRef={(el) => { if (el) textRefs.current.set(l.id, el); else textRefs.current.delete(l.id); }} />
          {p.issueLayerIds.has(l.id) && <rect x={-l.widthMm / 2} y={-l.heightMm / 2} width={l.widthMm} height={l.heightMm} fill="none" stroke="#A4262C" strokeWidth={handle * 0.18} strokeDasharray={`${handle * 0.5} ${handle * 0.3}`} />}
        </g>
      )))}

      {piece && (
        <g pointerEvents="none">
          {/* what lies outside the printed area is cut away: shown dimmed */}
          <path d={`M${-m} ${-m}H${W + m}V${H + m}H${-m}Z ${pathD(piece.print)}`} fillRule="evenodd" fill={p.garmentColor} opacity={0.78} />
          <path d={pathD(piece.cut)} fill="none" stroke="#B5562A" strokeWidth={handle * 0.14} />
          <path d={pathD(piece.stitch)} fill="none" stroke="#2A1A12" strokeOpacity={0.6} strokeWidth={handle * 0.1} strokeDasharray={`${handle * 0.4} ${handle * 0.3}`} />
        </g>
      )}

      {guides.v && <line x1={W / 2} y1={-m} x2={W / 2} y2={H + m} stroke="#2F4B7C" strokeWidth={handle * 0.12} />}
      {guides.h && <line x1={-m} y1={H / 2} x2={W + m} y2={H / 2} stroke="#2F4B7C" strokeWidth={handle * 0.12} />}

      {selected && (
        <g transform={`translate(${selected.xMm} ${selected.yMm}) rotate(${selected.rotation})`}>
          <rect x={-selected.widthMm / 2} y={-selected.heightMm / 2} width={selected.widthMm} height={selected.heightMm} fill="none" stroke="#2F4B7C" strokeWidth={handle * 0.15} pointerEvents="none" />
          {!selected.locked && (
            <>
              <line x1="0" y1={-selected.heightMm / 2} x2="0" y2={-selected.heightMm / 2 - handle * 2.2} stroke="#2F4B7C" strokeWidth={handle * 0.15} />
              <circle cx="0" cy={-selected.heightMm / 2 - handle * 2.2} r={handle * 0.75} fill="#FBF7EF" stroke="#2F4B7C" strokeWidth={handle * 0.2}
                style={{ cursor: "grab" }} onPointerDown={(e) => start(e, selected, "rotate")} aria-label="Pivoter" />
              <rect x={selected.widthMm / 2 - handle * 0.7} y={selected.heightMm / 2 - handle * 0.7} width={handle * 1.4} height={handle * 1.4} fill="#2F4B7C"
                style={{ cursor: "nwse-resize" }} onPointerDown={(e) => start(e, selected, "scale")} aria-label="Redimensionner" />
            </>
          )}
        </g>
      )}
    </svg>
  );
}

export function LayerShape({ layer: l, url, textRef }: { layer: Layer; url?: string | undefined; textRef?: (el: SVGTextElement | null) => void }) {
  if (l.type === "text") {
    const f = FONTS[l.font];
    return (
      <text ref={textRef} textAnchor="middle" dominantBaseline="central" fontSize={l.sizeMm} fontFamily={f.css} fontWeight={f.weight}
        fontStyle={l.italic ? "italic" : undefined} letterSpacing={l.letterSpacing ? `${l.letterSpacing}em` : undefined} fill={l.fill}>
        {l.text || " "}
      </text>
    );
  }
  if (l.type === "image") {
    return url
      ? <image href={url} x={-l.widthMm / 2} y={-l.heightMm / 2} width={l.widthMm} height={l.heightMm} preserveAspectRatio="none" />
      : <rect x={-l.widthMm / 2} y={-l.heightMm / 2} width={l.widthMm} height={l.heightMm} fill="#00000014" stroke="#00000033" strokeDasharray="3 2" />;
  }
  if (l.type === "vector") {
    return (
      <svg x={-l.widthMm / 2} y={-l.heightMm / 2} width={l.widthMm} height={l.heightMm} viewBox={`0 0 ${l.viewWidth} ${l.viewHeight}`} preserveAspectRatio="none" overflow="visible">
        {l.paths.map((p, i) => <path key={i} d={p.d} fill={p.fill} />)}
      </svg>
    );
  }
  const { widthMm: w, heightMm: h } = l;
  if (l.shape === "circle") return <ellipse rx={w / 2} ry={h / 2} fill={l.fill} />;
  if (l.shape === "losange") return <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} fill={l.fill} />;
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill={l.fill} />;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function isDark(hex: string): boolean {
  const n = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * n[0]! + 0.7152 * n[1]! + 0.0722 * n[2]! < 110;
}
