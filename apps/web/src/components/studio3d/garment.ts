/**
 * Provisional 3D garments (E18), modelled in real millimetres so that studio zones land where they are printed.
 * Garment coordinates: origin = centre of the shoulder line, x to the wearer's LEFT seen from the front (= viewer's
 * right), y downwards. Panels are seen from the outside: the back panel is mirrored when it is textured.
 * These are stand-ins until the artist's models arrive (VISUALISATION_3D.md); the calibration contract stays the same.
 */

export type GarmentKind = "tee" | "polo" | "hoodie" | "tote";
export type Panel = "front" | "back";

export interface GarmentTemplate {
  /** Half outline of the front panel (x ≥ 0), from the neck to the hem centre, in mm. Mirrored for x < 0. */
  halfOutline: [number, number][];
  /** Depth of the front neckline (mm below the shoulder line), and of the back one. */
  neckFront: number;
  neckBack: number;
  /** Puffiness of the inflated panels (mm). */
  thickness: number;
  /** Centre of the upper-arm print area on the wearer's left sleeve (mm); mirrored for the right sleeve. */
  sleeveCenter: [number, number];
  label: string;
}

export const GARMENTS: Record<GarmentKind, GarmentTemplate> = {
  tee: {
    label: "T-shirt (modèle provisoire)",
    neckFront: 80, neckBack: 25, thickness: 75, sleeveCenter: [310, 135],
    halfOutline: [[90, -10], [180, 5], [235, 15], [390, 150], [330, 230], [265, 185], [262, 420], [268, 720], [0, 725]],
  },
  polo: {
    label: "Polo (modèle provisoire)",
    neckFront: 70, neckBack: 25, thickness: 75, sleeveCenter: [305, 130],
    halfOutline: [[85, -15], [180, 5], [235, 15], [385, 150], [330, 225], [265, 185], [262, 420], [268, 730], [0, 735]],
  },
  hoodie: {
    label: "Hoodie (modèle provisoire)",
    neckFront: 95, neckBack: 30, thickness: 95, sleeveCenter: [330, 200],
    halfOutline: [[100, -10], [190, 5], [250, 20], [560, 300], [470, 400], [290, 240], [285, 640], [275, 700], [0, 705]],
  },
  tote: {
    label: "Tote bag (modèle provisoire)",
    neckFront: -40, neckBack: -40, thickness: 25, sleeveCenter: [0, 200],
    halfOutline: [[190, 0], [190, 400], [0, 400]],
  },
};

/** Full closed outline (front panel), clockwise, from the half outline. */
export function outline(kind: GarmentKind): [number, number][] {
  const half = GARMENTS[kind].halfOutline;
  const left = [...half].reverse().filter(([x]) => x !== 0).map(([x, y]) => [-x, y] as [number, number]);
  return [...half, ...left];
}

export interface Placement { panel: Panel; x: number; y: number; w: number; h: number }

/**
 * Where a studio zone sits on the garment (top-left corner, mm). Conventions used by print shops:
 * front print starts 7 cm below the front neckline, left-chest logo 10 cm × 10 cm on the wearer's left,
 * back print starts 7 cm below the back neckline, back-neck label 4 cm below it, sleeves on the upper arm.
 */
export function placeZone(kind: GarmentKind, zone: { key: string; maxWidthMm: number; maxHeightMm: number }): Placement {
  const g = GARMENTS[kind];
  const { key, maxWidthMm: w, maxHeightMm: h } = zone;
  const k = key.toLowerCase();
  if (kind === "tote") return { panel: /back|dos/.test(k) ? "back" : "front", x: -w / 2, y: Math.max(40, (400 - h) / 2), w, h };
  if (/neck|nuque|label|etiquette/.test(k) && /back|dos|nuque|neck/.test(k)) return { panel: "back", x: -w / 2, y: g.neckBack + 40, w, h };
  if (/back|dos/.test(k)) return { panel: "back", x: -w / 2, y: g.neckBack + 70, w, h };
  if (/chest_left|poitrine_gauche|coeur|left_chest/.test(k)) return { panel: "front", x: 110 - w / 2, y: g.neckFront + 60, w, h };
  if (/chest_right|poitrine_droite/.test(k)) return { panel: "front", x: -110 - w / 2, y: g.neckFront + 60, w, h };
  const [sx, sy] = g.sleeveCenter;
  if (/left_sleeve|manche_gauche/.test(k)) return { panel: "front", x: sx - w / 2, y: sy - h / 2, w, h };
  if (/right_sleeve|manche_droite/.test(k)) return { panel: "front", x: -sx - w / 2, y: sy - h / 2, w, h };
  if (/pocket|poche/.test(k)) return { panel: "front", x: -w / 2, y: 470, w, h };
  return { panel: "front", x: -w / 2, y: g.neckFront + 70, w, h };
}

/** Bounding box of the outline (mm), used for the texture canvas. */
export function bounds(kind: GarmentKind) {
  const pts = outline(kind);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Texture coordinates for a garment point; the back panel is mirrored because it is seen from behind. */
export function uvFor(kind: GarmentKind, panel: Panel, x: number, y: number): [number, number] {
  const b = bounds(kind);
  const u = (x - b.minX) / (b.maxX - b.minX);
  const v = 1 - (y - b.minY) / (b.maxY - b.minY);
  return [panel === "back" ? 1 - u : u, v];
}

export function pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distanceToOutline(x: number, y: number, poly: [number, number][]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j]!;
    const [bx, by] = poly[i]!;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** Inflation profile: flat in the middle, rounded towards the seams (like a garment on a form). */
export const inflate = (distanceMm: number, thicknessMm: number) => thicknessMm * (1 - Math.exp(-distanceMm / 45));

/** Mug: printable band wraps around the body; returns the angle span (radians) of a zone of `widthMm`. */
export function mugArc(widthMm: number, radiusMm: number): number {
  return Math.min(2 * Math.PI, widthMm / radiusMm);
}

export type ModelKind = GarmentKind | "mug" | "bottle" | "cap";

export function modelKindFor(slug: string): ModelKind {
  if (/hood|sweat/.test(slug)) return "hoodie";
  if (/polo/.test(slug)) return "polo";
  if (/casquette|cap/.test(slug)) return "cap";
  if (/mug|tasse/.test(slug)) return "mug";
  if (/gourde|bouteille|bottle/.test(slug)) return "bottle";
  if (/tote|sac/.test(slug)) return "tote";
  return "tee";
}
