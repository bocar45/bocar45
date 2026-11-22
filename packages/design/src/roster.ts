import type { DesignDocument, PerItem, TextLayer } from "./document.ts";

/**
 * Team orders (E16): one design, one line per piece with its size, name and number. Texts marked `perItem` take the
 * piece's value; the same rules run in the studio, on the server and for the production files.
 */

export interface RosterEntry {
  size: string;
  name?: string;
  number?: string;
}

export const MAX_ROSTER = 500;
const NAME_CHARS = /^[\p{Script=Latin}0-9 .'’-]*$/u; // the production fonts cover Latin letters with accents

const perItemLayers = (doc: DesignDocument) =>
  doc.surfaces.flatMap((s) => s.layers.flatMap((l) => (l.type === "text" && l.perItem ? [{ zoneKey: s.zoneKey, layer: l as TextLayer & { perItem: PerItem } }] : [])));

/** Which values each piece needs, with the strictest maximum length across the layers using it. */
export function rosterKeys(doc: DesignDocument): Partial<Record<PerItem["key"], { maxLength: number }>> {
  const out: Partial<Record<PerItem["key"], { maxLength: number }>> = {};
  for (const { layer } of perItemLayers(doc)) {
    const k = layer.perItem.key;
    out[k] = { maxLength: Math.min(out[k]?.maxLength ?? Infinity, layer.perItem.maxLength) };
  }
  return out;
}
export const needsRoster = (doc: DesignDocument) => Object.keys(rosterKeys(doc)).length > 0;

/** Text printed for a value: same case as the sample (an upper-case sample prints names in capitals). */
function shown(layer: TextLayer, value: string) {
  const v = value.trim().replace(/\s+/g, " ");
  return layer.text === layer.text.toUpperCase() && /\p{L}/u.test(layer.text) ? v.toLocaleUpperCase("fr") : v;
}

/** The design of one piece: variable texts replaced, empty ones hidden. */
export function personalize(doc: DesignDocument, entry: RosterEntry): DesignDocument {
  return {
    ...doc,
    surfaces: doc.surfaces.map((s) => ({
      ...s,
      layers: s.layers.map((l) => {
        if (l.type !== "text" || !l.perItem) return l;
        const text = shown(l, (l.perItem.key === "name" ? entry.name : entry.number) ?? "");
        const sampleLen = Math.max(1, Array.from(l.text).length);
        return { ...l, text, widthMm: (l.widthMm * Array.from(text).length) / sampleLen, ...(text ? {} : { hidden: true }) };
      }),
    })),
  };
}

/** Sizes and quantity of the order line, from the roster. */
export function sizesFromRoster(entries: RosterEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) out[e.size] = (out[e.size] ?? 0) + 1;
  return out;
}

/**
 * Check a roster against the design and the product. Errors block the order; warnings are shown (e.g. two players
 * with the same number). Messages in French, numbered by line as the customer sees them.
 */
export function checkRoster(
  doc: DesignDocument, entries: RosterEntry[], sizes: string[], zones: { key: string; maxWidthMm: number }[],
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  const keys = rosterKeys(doc);
  if (entries.length === 0) errors.push("Ajoutez au moins une pièce à la liste.");
  if (entries.length > MAX_ROSTER) errors.push(`${MAX_ROSTER} pièces au plus par commande.`);
  const layers = perItemLayers(doc);
  entries.forEach((e, i) => {
    const n = `Ligne ${i + 1}`;
    const before = errors.length;
    if (!sizes.includes(e.size)) errors.push(`${n} : taille « ${e.size} » indisponible.`);
    const name = (e.name ?? "").trim(), num = (e.number ?? "").trim();
    if (keys.name) {
      if (Array.from(name).length > keys.name.maxLength) errors.push(`${n} : nom trop long (${keys.name.maxLength} caractères au plus).`);
      if (!NAME_CHARS.test(name)) errors.push(`${n} : le nom contient des caractères que l'atelier ne peut pas imprimer.`);
    } else if (name) errors.push(`${n} : cette création n'a pas d'emplacement pour un nom.`);
    if (keys.number) {
      if (!/^\d*$/.test(num)) errors.push(`${n} : le numéro ne doit contenir que des chiffres.`);
      else if (num.length > keys.number.maxLength) errors.push(`${n} : numéro trop long (${keys.number.maxLength} chiffres au plus).`);
    } else if (num) errors.push(`${n} : cette création n'a pas d'emplacement pour un numéro.`);
    // the printed text must stay inside its zone (once the value itself is acceptable)
    const piece = personalize(doc, e);
    if (errors.length === before) for (const { zoneKey, layer } of layers) {
      const z = zones.find((x) => x.key === zoneKey);
      const l = piece.surfaces.find((s) => s.zoneKey === zoneKey)?.layers.find((x) => x.id === layer.id);
      if (z && l && !l.hidden && (l.xMm - l.widthMm / 2 < 0 || l.xMm + l.widthMm / 2 > z.maxWidthMm)) {
        errors.push(`${n} : « ${l.type === "text" ? l.text : ""} » dépasse de la zone d'impression ; raccourcissez-le ou réduisez le texte dans le studio.`);
      }
    }
    if (keys.name && keys.number && !name && !num) warnings.push(`${n} : ni nom ni numéro, la pièce sera imprimée sans personnalisation.`);
  });
  const seen = new Map<string, number[]>();
  entries.forEach((e, i) => { const k = (e.number ?? "").trim(); if (k) seen.set(k, [...(seen.get(k) ?? []), i + 1]); });
  for (const [num, lines] of seen) if (lines.length > 1) warnings.push(`Numéro ${num} en double (lignes ${lines.join(", ")}).`);
  return { errors, warnings };
}

/**
 * Read a list pasted from a spreadsheet or a message: one piece per line, columns separated by tab, semicolon or comma,
 * in any order (the size is recognised among the product sizes, the number is the column of digits).
 */
export function parseRosterText(text: string, sizes: string[]): RosterEntry[] {
  const upper = new Map(sizes.map((s) => [s.toUpperCase(), s]));
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const cells = line.split(/\t|;|,/).map((c) => c.trim()).filter(Boolean);
    const entry: RosterEntry = { size: "" };
    const rest: string[] = [];
    for (const c of cells) {
      if (!entry.size && upper.has(c.toUpperCase())) entry.size = upper.get(c.toUpperCase())!;
      else if (entry.number === undefined && /^\d{1,3}$/.test(c)) entry.number = c;
      else rest.push(c);
    }
    if (rest.length) entry.name = rest.join(" ");
    if (!entry.size && !entry.name && entry.number === undefined) return [];
    return [entry];
  });
}

/**
 * The design used for the price and the print size of a team order: each variable text as wide as its widest
 * piece (the workshop prints up to that size). The same function runs in the studio and on the server, so the price
 * shown is the price charged.
 */
export function widestPiece(doc: DesignDocument, entries: RosterEntry[]): DesignDocument {
  if (entries.length === 0) return doc;
  const pieces = entries.map((e) => personalize(doc, e));
  return {
    ...doc,
    surfaces: doc.surfaces.map((s, si) => ({
      ...s,
      layers: s.layers.map((l, li) => {
        if (l.type !== "text" || !l.perItem) return l;
        let best = l;
        for (const p of pieces) {
          const c = p.surfaces[si]!.layers[li]!;
          if (!c.hidden && c.widthMm > best.widthMm) best = c as TextLayer;
        }
        return { ...l, widthMm: best.widthMm };
      }),
    })),
  };
}
