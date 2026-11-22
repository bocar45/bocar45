import type { DesignDocument, ImageLayer, Layer, TemplateField } from "./document.ts";

/**
 * Ready-to-personalise templates (E15). A template is an ordinary design document whose fields (photo, text) are
 * marked on layers; decorative layers are `locked`. The customer fills the fields in an assistant, then orders or
 * opens the full studio. Pure functions: the same rules in the browser, the server and the tests.
 */

export interface FieldRef {
  layerId: string;
  zoneKey: string;
  kind: TemplateField["kind"];
  label: string;
  maxLength: number;
  /** Current text (text field) or image box in mm (photo field). */
  text?: string;
  box?: { widthMm: number; heightMm: number };
}

export const DEFAULT_TEXT_MAX = 40;

export function templateFields(doc: DesignDocument): FieldRef[] {
  return doc.surfaces.flatMap((s) => s.layers.flatMap((l): FieldRef[] => {
    if (!l.field) return [];
    const base = { layerId: l.id, zoneKey: s.zoneKey, kind: l.field.kind, label: l.field.label, maxLength: l.field.maxLength ?? DEFAULT_TEXT_MAX };
    if (l.type === "text") return [{ ...base, text: l.text }];
    if (l.type === "image") return [{ ...base, box: { widthMm: l.widthMm, heightMm: l.heightMm } }];
    return [];
  }));
}

/** Why a template cannot be published yet (empty = publishable). Messages for the catalogue team. */
export function templateBlockers(doc: DesignDocument): string[] {
  const out: string[] = [];
  const fields = templateFields(doc);
  if (doc.surfaces.every((s) => s.layers.length === 0)) out.push("Le modèle est vide.");
  if (fields.length === 0) out.push("Marquez au moins un élément comme « photo du client » ou « texte du client ».");
  const labels = fields.map((f) => f.label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) out.push("Deux champs ont le même nom : le client ne saurait pas lequel remplir.");
  for (const s of doc.surfaces) for (const l of s.layers) {
    if (l.type === "image" && !l.src.startsWith("storage:template-assets/")) out.push(`Image « ${l.name} » pas encore enregistrée avec le modèle.`);
  }
  return out;
}

const mapLayer = (doc: DesignDocument, id: string, fn: (l: Layer) => Layer): DesignDocument => ({
  ...doc,
  surfaces: doc.surfaces.map((s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? fn(l) : l)) })),
});

/** Fill a text field; the text is trimmed to one line and to the field's maximum length. */
export function fillText(doc: DesignDocument, layerId: string, text: string): DesignDocument {
  return mapLayer(doc, layerId, (l) => {
    if (l.type !== "text" || l.field?.kind !== "text") return l;
    const max = l.field.maxLength ?? DEFAULT_TEXT_MAX;
    return { ...l, text: Array.from(text.replace(/\s+/g, " ")).slice(0, max).join("") };
  });
}

/**
 * Part of a photo (pixels) to keep so that it fills a box of the given ratio without distortion: centred crop,
 * like a photo frame. The caller crops the image to this rectangle, then calls `fillPhoto`.
 */
export function coverCrop(pxWidth: number, pxHeight: number, boxWidth: number, boxHeight: number) {
  const target = boxWidth / boxHeight;
  if (pxWidth / pxHeight > target) {
    const w = Math.max(1, Math.round(pxHeight * target));
    return { x: Math.floor((pxWidth - w) / 2), y: 0, w, h: pxHeight };
  }
  const h = Math.max(1, Math.round(pxWidth / target));
  return { x: 0, y: Math.floor((pxHeight - h) / 2), w: pxWidth, h };
}

/** Put the customer's (already cropped) photo in a photo field: same box, same place, same rotation. */
export function fillPhoto(doc: DesignDocument, layerId: string, photo: Pick<ImageLayer, "src" | "name" | "pxWidth" | "pxHeight">): DesignDocument {
  return mapLayer(doc, layerId, (l) => (l.type === "image" && l.field?.kind === "photo" ? { ...l, ...photo } : l));
}
