/**
 * SAWWA Design Document — the source of truth for a creation.
 * Units are real millimetres, origin = top-left corner of the print zone, layer x/y = layer centre.
 * The studio, the preflight, the price and (later) production files all read this same document.
 */

export const FONTS = {
  manrope: { label: "Manrope", css: "var(--font-manrope), system-ui, sans-serif", weight: 800 },
  fraunces: { label: "Fraunces", css: "var(--font-fraunces), Georgia, serif", weight: 600 },
  anton: { label: "Anton", css: "var(--font-anton), Impact, sans-serif", weight: 400 },
  playfair: { label: "Playfair Display", css: "var(--font-playfair), Georgia, serif", weight: 700 },
  caveat: { label: "Caveat", css: "var(--font-caveat), cursive", weight: 700 },
  grotesk: { label: "Space Grotesk", css: "var(--font-grotesk), system-ui, sans-serif", weight: 700 },
} as const;
export type FontKey = keyof typeof FONTS;

interface LayerBase {
  id: string;
  xMm: number;
  yMm: number;
  rotation: number; // degrees, clockwise
  widthMm: number;
  heightMm: number;
  hidden?: boolean;
  locked?: boolean;
}

export interface TextLayer extends LayerBase {
  type: "text";
  text: string;
  font: FontKey;
  /** Font size in mm (≈ height of capitals × 1.4). */
  sizeMm: number;
  fill: string;
  italic?: boolean;
  letterSpacing?: number; // em
}

export interface ImageLayer extends LayerBase {
  type: "image";
  /** Asset reference: "idb:<id>" while on the device, a storage path once saved. */
  src: string;
  name: string;
  pxWidth: number;
  pxHeight: number;
}

export type ShapeKind = "rect" | "circle" | "losange";
export interface ShapeLayer extends LayerBase {
  type: "shape";
  shape: ShapeKind;
  fill: string;
}

/** Flat-colour vector artwork (e.g. a logo vectorised in the studio). Paths are drawn in a viewBox scaled to the layer. */
export interface VectorLayer extends LayerBase {
  type: "vector";
  name: string;
  viewWidth: number;
  viewHeight: number;
  paths: { d: string; fill: string }[];
}

export type Layer = TextLayer | ImageLayer | ShapeLayer | VectorLayer;

/** Total path data of one vector layer: a very detailed trace is refused (heavy to store, send and print). */
export const MAX_VECTOR_CHARS = 300_000;
/** Whole document as JSON: must fit the server action limit (2 MB, next.config.ts) with margin. */
export const MAX_DOCUMENT_CHARS = 1_500_000;
export const vectorChars = (paths: { d: string }[]) => paths.reduce((n, p) => n + p.d.length, 0);
/** Only absolute/relative move, line, curve and close commands with numbers: nothing executable can hide in it. */
export const isSafePathData = (d: unknown) => typeof d === "string" && d.length > 0 && d.length <= 200_000 && /^[MmLlHhVvCcSsQqTtZz0-9eE.,\s-]+$/.test(d);

export interface Surface {
  zoneKey: string;
  technique: string;
  layers: Layer[];
}

export interface DesignDocument {
  schemaVersion: 1;
  product: string; // base product slug
  colorKey: string;
  surfaces: Surface[];
}

export const emptyDocument = (product: string, colorKey: string): DesignDocument => ({
  schemaVersion: 1,
  product,
  colorKey,
  surfaces: [],
});

const isHex = (v: unknown) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

/** Validate untrusted JSON (localStorage, request body). Returns errors or the typed document. */
export function parseDesign(input: unknown): { ok: true; value: DesignDocument } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const d = input as Partial<DesignDocument> | null;
  if (!d || typeof d !== "object") return { ok: false, errors: ["not an object"] };
  if (JSON.stringify(d).length > MAX_DOCUMENT_CHARS) return { ok: false, errors: ["document too large"] };
  if (d.schemaVersion !== 1) errors.push("unsupported schemaVersion");
  if (typeof d.product !== "string" || !d.product) errors.push("product required");
  if (typeof d.colorKey !== "string") errors.push("colorKey required");
  if (!Array.isArray(d.surfaces)) errors.push("surfaces must be an array");
  for (const [si, s] of (d.surfaces ?? []).entries()) {
    if (typeof s?.zoneKey !== "string" || typeof s?.technique !== "string" || !Array.isArray(s?.layers)) {
      errors.push(`surface ${si} invalid`);
      continue;
    }
    if (s.layers.length > 50) errors.push(`surface ${si}: too many layers`);
    for (const [li, l] of s.layers.entries()) {
      const at = `surface ${si} layer ${li}`;
      if (typeof l?.id !== "string") errors.push(`${at}: id`);
      for (const k of ["xMm", "yMm", "rotation", "widthMm", "heightMm"] as const) if (!isNum(l?.[k])) errors.push(`${at}: ${k}`);
      if (l?.type === "text") {
        if (typeof l.text !== "string" || l.text.length > 200) errors.push(`${at}: text`);
        if (!(l.font in FONTS)) errors.push(`${at}: font`);
        if (!isNum(l.sizeMm) || l.sizeMm <= 0) errors.push(`${at}: sizeMm`);
        if (!isHex(l.fill)) errors.push(`${at}: fill`);
      } else if (l?.type === "image") {
        if (typeof l.src !== "string" || !isNum(l.pxWidth) || !isNum(l.pxHeight)) errors.push(`${at}: image`);
      } else if (l?.type === "shape") {
        if (!["rect", "circle", "losange"].includes(l.shape) || !isHex(l.fill)) errors.push(`${at}: shape`);
      } else if (l?.type === "vector") {
        if (!isNum(l.viewWidth) || !isNum(l.viewHeight) || l.viewWidth <= 0 || l.viewHeight <= 0) errors.push(`${at}: vector viewBox`);
        if (!Array.isArray(l.paths) || l.paths.length === 0 || l.paths.length > 3000) errors.push(`${at}: vector paths`);
        else if (l.paths.some((p) => !isSafePathData(p?.d) || !isHex(p?.fill))) errors.push(`${at}: vector path`);
        else if (vectorChars(l.paths) > MAX_VECTOR_CHARS) errors.push(`${at}: vector too detailed`);
      } else errors.push(`${at}: type`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: d as DesignDocument };
}
