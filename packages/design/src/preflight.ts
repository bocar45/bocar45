import type { Surface } from "./document.ts";
import { effectiveDpi, layerBox, solidColors, visibleLayers } from "./geometry.ts";

export type Severity = "error" | "warning";
export interface Issue { code: string; severity: Severity; layerId?: string; message: string }

export interface TechniqueRules {
  minDpi?: number;
  maxColors?: number;
  minTextHeightMm?: number;
  allowsPhotos?: boolean;
}

/** Fabrication rules per technique (mirrors the `techniques.constraints` seed). */
export const TECHNIQUE_RULES: Record<string, TechniqueRules> = {
  dtg: { minDpi: 200, minTextHeightMm: 2 },
  dtf: { minDpi: 200, minTextHeightMm: 2 },
  sublimation: { minDpi: 200, minTextHeightMm: 2 },
  uv: { minDpi: 300, minTextHeightMm: 1.5 },
  embroidery: { maxColors: 12, minTextHeightMm: 5, allowsPhotos: false },
  screen_print: { maxColors: 6, minTextHeightMm: 3, allowsPhotos: false },
  flock: { maxColors: 3, minTextHeightMm: 8, allowsPhotos: false },
  engraving: { maxColors: 1, minTextHeightMm: 2, allowsPhotos: false },
};

/** Cap height ≈ 0.7 × font size: what is visually measured as "letter height". */
export const capHeightMm = (sizeMm: number) => sizeMm * 0.7;

/**
 * Can this surface be produced as designed? Errors block the order, warnings need the customer's agreement.
 * Thresholds: resolution ≥ 200 dpi OK, 150–199 warning, < 150 error (PRODUCT_SPEC §5).
 */
export function preflight(surface: Surface, zone: { maxWidthMm: number; maxHeightMm: number }): Issue[] {
  const rules = TECHNIQUE_RULES[surface.technique] ?? {};
  const issues: Issue[] = [];
  const tol = 0.5;
  for (const l of visibleLayers(surface)) {
    const b = layerBox(l);
    if (b.minX < -tol || b.minY < -tol || b.maxX > zone.maxWidthMm + tol || b.maxY > zone.maxHeightMm + tol) {
      issues.push({ code: "OUT_OF_ZONE", severity: "error", layerId: l.id, message: "Un élément dépasse de la zone imprimable : il serait coupé." });
    }
    if (l.type === "image") {
      if (rules.allowsPhotos === false) {
        issues.push({ code: "PHOTO_NOT_SUPPORTED", severity: "warning", layerId: l.id, message: "Cette technique reproduit des aplats de couleur, pas des photos : l'atelier simplifiera l'image." });
      } else if (rules.minDpi) {
        const dpi = effectiveDpi(l);
        if (dpi < 150) issues.push({ code: "LOW_DPI", severity: "error", layerId: l.id, message: `Image trop peu définie à cette taille (${dpi} dpi). Réduisez-la ou importez une version plus grande.` });
        else if (dpi < rules.minDpi) issues.push({ code: "LOW_DPI", severity: "warning", layerId: l.id, message: `Image un peu floue à cette taille (${dpi} dpi, ${rules.minDpi} recommandés).` });
      }
    }
    if (l.type === "text") {
      if (!l.text.trim()) issues.push({ code: "EMPTY_TEXT", severity: "warning", layerId: l.id, message: "Un texte est vide." });
      const cap = capHeightMm(l.sizeMm);
      if (rules.minTextHeightMm && cap < rules.minTextHeightMm) {
        issues.push({ code: "TEXT_TOO_SMALL", severity: "error", layerId: l.id, message: `Texte trop petit pour cette technique (lettres de ${cap.toFixed(1)} mm, minimum ${rules.minTextHeightMm} mm).` });
      }
    }
  }
  if (rules.maxColors) {
    const n = solidColors(surface).length;
    if (n > rules.maxColors) issues.push({ code: "TOO_MANY_COLORS", severity: "error", message: `${n} couleurs utilisées, ${rules.maxColors} au maximum pour cette technique.` });
  }
  return issues;
}

export const blocking = (issues: Issue[]) => issues.some((i) => i.severity === "error");
