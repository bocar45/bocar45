import type { Layer, Surface } from "./document.ts";

/**
 * E18b — all-over printing on cut-and-sew garments. Each pattern piece (front, back, sleeve, hood…) is a print zone
 * whose box includes the seam allowance and the bleed; `outline` is the stitch line in that box (mm).
 * The workshop prints the full rectangle (sublimation / textile printing), then cuts along the cut line.
 */
export type Pt = [number, number];

export interface PatternSpec {
  outline: Pt[]; // stitch line, zone coordinates (mm)
  seamMm: number; // seam allowance outside the stitch line
  bleedMm: number; // extra printed margin outside the cut line
  quantity: number; // pieces of this shape per garment (2 for sleeves)
  mirror?: boolean; // the second piece is the mirror image (left/right)
  /** Where this piece's box lies on the garment, for the 3D preview and for the continuous motif (mm, garment frame). */
  body?: { panel: "front" | "back"; x: number; y: number; w: number; h: number } | null;
}

const area = (p: Pt[]) => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]!; return s + x * y2 - x2 * y; }, 0) / 2;

/** Polygon grown by `d` mm (outwards), miter joins limited to 2·d. Works for the simple, mostly convex garment shapes. */
export function offsetPolygon(poly: Pt[], d: number): Pt[] {
  const sign = area(poly) > 0 ? 1 : -1; // outward normal side depends on orientation (y axis points down)
  const n = poly.length;
  return poly.map((p, i) => {
    const a = poly[(i - 1 + n) % n]!, b = poly[(i + 1) % n]!;
    const n1 = normal(a, p, sign), n2 = normal(p, b, sign);
    let mx = n1[0] + n2[0], my = n1[1] + n2[1];
    const len = Math.hypot(mx, my) || 1;
    mx /= len; my /= len;
    const cos = mx * n1[0] + my * n1[1];
    const k = Math.min(2, 1 / Math.max(cos, 0.5));
    return [round(p[0] + mx * d * k), round(p[1] + my * d * k)];
  });
}
function normal(a: Pt, b: Pt, sign: number): Pt {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [(sign * dy) / l, (-sign * dx) / l];
}
const round = (v: number) => Math.round(v * 100) / 100;

/** Stitch line, cut line (stitch + seam) and printed area (cut + bleed). */
export function piecePolygons(p: PatternSpec) {
  return { stitch: p.outline, cut: offsetPolygon(p.outline, p.seamMm), print: offsetPolygon(p.outline, p.seamMm + p.bleedMm) };
}
export const pathD = (poly: Pt[]) => `M${poly.map(([x, y]) => `${x} ${y}`).join("L")}Z`;

/** Build a piece zone from a stitch outline given in any frame: box = outline + seam + bleed on every side. */
export function pieceZone(outlineAnyFrame: Pt[], seamMm: number, bleedMm: number) {
  const xs = outlineAnyFrame.map((p) => p[0]), ys = outlineAnyFrame.map((p) => p[1]);
  const m = seamMm + bleedMm, minX = Math.min(...xs), minY = Math.min(...ys);
  const outline = outlineAnyFrame.map(([x, y]) => [round(x - minX + m), round(y - minY + m)] as Pt);
  return { outline, widthMm: Math.ceil(Math.max(...xs) - minX + 2 * m), heightMm: Math.ceil(Math.max(...ys) - minY + 2 * m), originX: minX - m, originY: minY - m };
}

// ── Continuous motif (« motif continu ») ─────────────────────────────────────────────
export const ALL_OVER_MOTIFS = { uni: "Uni", losanges: "Losanges", bandes: "Bandes tissées", damier: "Damier", pois: "Pois" } as const;
export type MotifKind = keyof typeof ALL_OVER_MOTIFS;
export interface AllOver { motif: MotifKind; colors: [string, string]; tileMm: number }
export const isMotif = (v: unknown): v is MotifKind => typeof v === "string" && Object.hasOwn(ALL_OVER_MOTIFS, v);

/** One tile of the motif (square, `tileMm` wide): background colour + vector shapes. Same tile in studio, 3D and print. */
export function motifTile(a: AllOver): { size: number; background: string; shapes: { d: string; fill: string }[] } {
  const s = a.tileMm, [bg, fg] = a.colors, h = s / 2;
  const shapes: { d: string; fill: string }[] = [];
  if (a.motif === "losanges") shapes.push({ d: `M${h} 0L${s} ${h}L${h} ${s}L0 ${h}Z`, fill: fg });
  if (a.motif === "bandes") shapes.push({ d: `M0 0H${s}V${s * 0.18}H0Z M0 ${s * 0.5}H${s}V${s * 0.58}H0Z`, fill: fg });
  if (a.motif === "damier") shapes.push({ d: `M0 0H${h}V${h}H0Z M${h} ${h}H${s}V${s}H${h}Z`, fill: fg });
  if (a.motif === "pois") { const r = s * 0.18; shapes.push({ d: `M${h - r} ${h}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`, fill: fg }); }
  return { size: s, background: bg, shapes };
}

/**
 * How the continuous motif lies in a piece: local = (s·X + tx, Y + ty), where (X, Y) is the point on the garment seen
 * from the front (the motif's grid is anchored there, so it continues across every seam). A back piece is printed as
 * seen from behind (s = −1); the second piece of a mirrored pair (`mirrored`) sits on the other side of the garment.
 * Pieces without a body position keep the grid on their own corner.
 */
export function motifFrame(p: PatternSpec | undefined | null, widthMm: number, mirrored = false): { s: 1 | -1; tx: number; ty: number } {
  const b = p?.body;
  if (!b) return { s: 1, tx: 0, ty: 0 };
  // original piece: X = ±(b.x + u); its mirrored copy is the flipped file (u' = W − u) on the other side (X' = −X)
  const s: 1 | -1 = b.panel === "back" ? -1 : 1;
  return mirrored ? { s, tx: b.x + widthMm, ty: -b.y } : { s, tx: -b.x, ty: -b.y };
}

/** Garment-frame rectangle covering a piece box, for drawing the motif under it (inverse of `motifFrame`). */
export function motifCover(f: { s: 1 | -1; tx: number; ty: number }, widthMm: number, heightMm: number) {
  const x1 = (0 - f.tx) / f.s, x2 = (widthMm - f.tx) / f.s;
  return { x: Math.min(x1, x2), y: -f.ty, w: widthMm, h: heightMm };
}

// ── Fabrication check for all-over pieces ──────────────────────────────────────────
export interface PatternIssue { code: "PIECE_NOT_COVERED" | "OUTSIDE_PIECE"; severity: "warning" | "error"; message: string; layerId?: string }

const box = (l: Layer) => {
  const a = (l.rotation * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = l.widthMm * c + l.heightMm * s, h = l.widthMm * s + l.heightMm * c;
  return { minX: l.xMm - w / 2, maxX: l.xMm + w / 2, minY: l.yMm - h / 2, maxY: l.yMm + h / 2 };
};

/**
 * Sublimation prints only where there is colour: without a continuous motif, the piece must be covered up to its
 * printed edge (else the white fabric shows at the seams); an element entirely outside the piece is never printed.
 */
export function patternPreflight(surface: Surface, p: PatternSpec, zone: { maxWidthMm: number; maxHeightMm: number }, allOver: AllOver | undefined): PatternIssue[] {
  const issues: PatternIssue[] = [];
  const { print } = piecePolygons(p);
  const px = print.map((q) => q[0]), py = print.map((q) => q[1]);
  const pb = { minX: Math.max(0, Math.min(...px)), maxX: Math.min(zone.maxWidthMm, Math.max(...px)), minY: Math.max(0, Math.min(...py)), maxY: Math.min(zone.maxHeightMm, Math.max(...py)) };
  const visible = surface.layers.filter((l) => !l.hidden);
  for (const l of visible) {
    const b = box(l);
    if (b.maxX <= pb.minX || b.minX >= pb.maxX || b.maxY <= pb.minY || b.minY >= pb.maxY) {
      issues.push({ code: "OUTSIDE_PIECE", severity: "error", layerId: l.id, message: "Un élément est entièrement hors de la pièce : il ne sera pas imprimé." });
    }
  }
  const covered = allOver || visible.some((l) => (l.type === "shape" && l.shape === "rect" || l.type === "image") && l.rotation % 90 === 0
    && box(l).minX <= pb.minX + 0.5 && box(l).maxX >= pb.maxX - 0.5 && box(l).minY <= pb.minY + 0.5 && box(l).maxY >= pb.maxY - 0.5);
  if (!covered) issues.push({ code: "PIECE_NOT_COVERED", severity: "warning", message: "La pièce n'est pas couverte jusqu'au bord (fond perdu) : le tissu blanc apparaîtra aux coutures. Choisissez un motif continu ou un fond plein." });
  return issues;
}

// ── Cutting plan (« plan de coupe ») ───────────────────────────────────────────────
export interface MarkerPiece { key: string; label: string; widthMm: number; heightMm: number; count: number }
export interface MarkerPlacement { key: string; label: string; index: number; x: number; y: number; widthMm: number; heightMm: number }

/**
 * Lay the printed rectangles on a roll of fabric (shelf packing, tallest first, no rotation: the grain line stays
 * vertical). Returns where each piece goes and the length of fabric needed.
 */
export function markerLayout(pieces: MarkerPiece[], fabricWidthMm: number, gapMm = 10): { placements: MarkerPlacement[]; lengthMm: number; tooWide: string[] } {
  const items = pieces.flatMap((p) => Array.from({ length: p.count }, (_, index) => ({ ...p, index }))).sort((a, b) => b.heightMm - a.heightMm || b.widthMm - a.widthMm);
  const placements: MarkerPlacement[] = [];
  const tooWide = [...new Set(items.filter((i) => i.widthMm > fabricWidthMm).map((i) => i.label))];
  let x = 0, y = 0, shelf = 0;
  for (const i of items.filter((it) => it.widthMm <= fabricWidthMm)) {
    if (x > 0 && x + i.widthMm > fabricWidthMm) { y += shelf + gapMm; x = 0; shelf = 0; }
    placements.push({ key: i.key, label: i.label, index: i.index, x, y, widthMm: i.widthMm, heightMm: i.heightMm });
    x += i.widthMm + gapMm;
    shelf = Math.max(shelf, i.heightMm);
  }
  return { placements, lengthMm: placements.length ? y + shelf : 0, tooWide };
}
