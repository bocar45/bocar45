import { pieceZone, type PatternSpec, type Pt } from "./pattern.ts";

/**
 * E18b — reference cut-and-sew patterns (size M, mm) for all-over printed garments. Pieces that face the 3D preview
 * are drawn in the garment frame of the studio 3D models (x centred, y = 0 on the shoulder line) so the preview and the
 * continuous motif line up exactly; the others are drawn in their own frame. To be checked against the pilot
 * workshop's real patterns before selling (E18b 🧑‍💼).
 */
export type PatternKind = "tee" | "hoodie";
interface PieceDef { key: string; label: string; outline: Pt[]; quantity: number; mirror?: boolean; garmentFrame?: { panel: "front" | "back" }; body3d?: { panel: "front" | "back"; x: number; y: number; w: number; h: number } }

const mirrorHalf = (half: Pt[]): Pt[] => [...half, ...[...half].reverse().filter(([x]) => x !== 0).map(([x, y]) => [-x, y] as Pt)];

const TEE_SIDE: Pt[] = [[240, 12], [252, 110], [262, 215], [262, 420], [268, 720], [0, 720]];
const HOODIE_SIDE: Pt[] = [[250, 20], [270, 130], [290, 240], [285, 640], [0, 640]];
const neck = (w: number, depth: number): Pt[] => [[0, depth], [w * 0.32, depth * 0.87], [w * 0.63, depth * 0.53], [w, -5]];

export const PATTERN_TEMPLATES: Record<PatternKind, { label: string; seamMm: number; bleedMm: number; pieces: PieceDef[] }> = {
  tee: {
    label: "T-shirt coupé-cousu (impression intégrale)", seamMm: 10, bleedMm: 5,
    pieces: [
      { key: "piece_devant", label: "Devant", quantity: 1, garmentFrame: { panel: "front" }, outline: mirrorHalf([...neck(95, 80), ...TEE_SIDE]) },
      { key: "piece_dos", label: "Dos", quantity: 1, garmentFrame: { panel: "back" }, outline: mirrorHalf([...neck(95, 25), ...TEE_SIDE]) },
      { key: "piece_manche", label: "Manche (×2)", quantity: 2, mirror: true, body3d: { panel: "front", x: 240, y: 12, w: 210, h: 288 },
        outline: [[0, 230], [40, 120], [130, 40], [260, 0], [390, 40], [480, 120], [520, 230]] },
      { key: "piece_col", label: "Bord-côte du col", quantity: 1, outline: [[0, 0], [480, 0], [480, 40], [0, 40]] },
    ],
  },
  hoodie: {
    label: "Hoodie coupé-cousu (impression intégrale)", seamMm: 10, bleedMm: 5,
    pieces: [
      { key: "piece_devant", label: "Devant", quantity: 1, garmentFrame: { panel: "front" }, outline: mirrorHalf([...neck(100, 95), ...HOODIE_SIDE]) },
      { key: "piece_dos", label: "Dos", quantity: 1, garmentFrame: { panel: "back" }, outline: mirrorHalf([...neck(100, 30), ...HOODIE_SIDE]) },
      { key: "piece_manche", label: "Manche (×2)", quantity: 2, mirror: true, body3d: { panel: "front", x: 250, y: 20, w: 310, h: 380 },
        outline: [[0, 180], [50, 70], [150, 10], [280, 0], [410, 10], [510, 70], [560, 180], [470, 640], [90, 640]] },
      { key: "piece_capuche", label: "Capuche (×2)", quantity: 2, mirror: true, outline: [[0, 0], [160, -20], [300, 40], [360, 180], [340, 330], [240, 380], [0, 380]] },
      { key: "piece_poche", label: "Poche kangourou", quantity: 1, garmentFrame: { panel: "front" }, outline: [[-170, 640], [-130, 470], [130, 470], [170, 640]] },
      { key: "piece_poignet", label: "Poignet (×2)", quantity: 2, outline: [[0, 0], [200, 0], [200, 80], [0, 80]] },
      { key: "piece_ceinture", label: "Ceinture", quantity: 1, outline: [[0, 0], [900, 0], [900, 70], [0, 70]] },
    ],
  },
};

/** Zone rows for a product (one per piece): box with seam and bleed, pattern spec in `anchor.pattern`. */
export function patternZones(kind: PatternKind) {
  const t = PATTERN_TEMPLATES[kind];
  return t.pieces.map((p) => {
    const z = pieceZone(p.outline, t.seamMm, t.bleedMm);
    const body = p.garmentFrame ? { panel: p.garmentFrame.panel, x: z.originX, y: z.originY, w: z.widthMm, h: z.heightMm } : p.body3d ?? null;
    const pattern: PatternSpec = { outline: z.outline, seamMm: t.seamMm, bleedMm: t.bleedMm, quantity: p.quantity, ...(p.mirror ? { mirror: true } : {}), body };
    return { key: p.key, label: p.label, maxWidthMm: z.widthMm, maxHeightMm: z.heightMm, pattern };
  });
}
