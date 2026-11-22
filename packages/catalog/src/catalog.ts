/** Reference-catalogue rules shared by the admin UI, server actions and tests. Pure. */

export const TECHNIQUES = ["dtg", "dtf", "embroidery", "screen_print", "sublimation", "uv", "engraving", "flock"] as const;
export type Technique = (typeof TECHNIQUES)[number];

export const TECHNIQUE_LABEL: Record<Technique, string> = {
  dtg: "Impression directe (DTG)",
  dtf: "Transfert DTF",
  embroidery: "Broderie",
  screen_print: "Sérigraphie",
  sublimation: "Sublimation",
  uv: "Impression UV",
  engraving: "Gravure",
  flock: "Flocage",
};

export const isTechnique = (v: string): v is Technique => (TECHNIQUES as readonly string[]).includes(v);

/** "T-shirt col rond 180 g" → "t-shirt-col-rond-180-g" */
export function slugify(input: string): string {
  return input
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Machine keys for views and zones: front, chest_left… */
export function toKey(input: string): string {
  return slugify(input).replace(/-/g, "_");
}

export const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];

/** "S, M,l ; XL" → ["S","M","L","XL"] (deduplicated, usual size order first). */
export function parseSizes(input: string): string[] {
  const list = [...new Set(input.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s);
    return i === -1 ? 100 : i;
  };
  return list.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "fr", { numeric: true }));
}

export const isHexColor = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

export const MAX_PRINT_MM = 2000;

export function validateZone(z: { key: string; maxWidthMm: number; maxHeightMm: number; techniques: string[] }): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9_]{2,40}$/.test(z.key)) errors.push("Identifiant de zone invalide (lettres, chiffres, _).");
  for (const [label, v] of [["Largeur", z.maxWidthMm], ["Hauteur", z.maxHeightMm]] as const) {
    if (!Number.isInteger(v) || v <= 0 || v > MAX_PRINT_MM) errors.push(`${label} : entre 1 et ${MAX_PRINT_MM} mm.`);
  }
  if (z.techniques.length === 0) errors.push("Choisissez au moins une technique.");
  if (z.techniques.some((t) => !isTechnique(t))) errors.push("Technique inconnue.");
  return errors;
}

export interface ProductSummary {
  name: string;
  variants: number;
  views: number;
  zones: number;
  zonesWithoutTechnique: number;
}

/** Why a product cannot be published yet (empty list = publishable). Mirrored by a DB trigger. */
export function publishBlockers(p: ProductSummary): string[] {
  const out: string[] = [];
  if (!p.name.trim()) out.push("Le produit n'a pas de nom.");
  if (p.variants === 0) out.push("Ajoutez au moins une couleur et une taille.");
  if (p.views === 0) out.push("Ajoutez au moins une vue (devant, dos…).");
  if (p.zones === 0) out.push("Ajoutez au moins une zone de personnalisation.");
  if (p.zonesWithoutTechnique > 0) out.push("Chaque zone doit accepter au moins une technique.");
  return out;
}

/** Occasions of ready-to-personalise templates (E15): local calendar first (docs/BENCHMARK_CATALOGUE.md). */
export const OCCASIONS = {
  mariage: "Mariage",
  bapteme: "Baptême",
  anniversaire: "Anniversaire",
  tabaski: "Tabaski",
  korite: "Korité",
  magal: "Magal",
  rentree: "Rentrée",
  "fin-annee": "Fêtes de fin d'année",
  "saint-valentin": "Saint-Valentin",
  "fete-meres": "Fête des mères",
  sport: "Sport et supporters",
  entreprise: "Entreprise",
  association: "Association",
  humour: "Humour",
  autre: "Autre",
} as const;
export type Occasion = keyof typeof OCCASIONS;
export const isOccasion = (v: string): v is Occasion => Object.hasOwn(OCCASIONS, v);
