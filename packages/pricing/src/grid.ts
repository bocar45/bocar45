import type { DecorationRate, Tier, VendorPriceGrid, TechniqueKey } from "./types.ts";

/** Quantity breakpoints shown in the workshop price table. */
export const DEFAULT_BREAKPOINTS = [1, 10, 25, 50, 100] as const;

/** One row of the workshop price table: a cost per breakpoint, blank cell = no new tier. */
export type CostRow = readonly (number | null)[];

export interface GridForm {
  vendorId: string;
  version: number;
  breakpoints: readonly number[];
  variantIds: readonly string[];
  blankCosts: CostRow;
  decorations: readonly {
    zoneKey: string;
    technique: TechniqueKey;
    maxWidthMm: number;
    maxHeightMm: number;
    maxColors?: number;
    costs: CostRow;
    setupFee?: number;
    extraColorUnitCost?: number;
  }[];
  minOrderQty?: number;
  orderSetupFee?: number;
}

function toTiers(breakpoints: readonly number[], costs: CostRow): Tier[] {
  const tiers: Tier[] = [];
  breakpoints.forEach((minQty, i) => {
    const c = costs[i];
    if (c !== null && c !== undefined) tiers.push({ minQty, unitCost: c });
  });
  return tiers;
}

/** Workshop form → VendorPriceGrid (the shape packages/pricing consumes). */
export function buildVendorGrid(form: GridForm): VendorPriceGrid {
  const blankTiers = toTiers(form.breakpoints, form.blankCosts);
  const decorations: DecorationRate[] = form.decorations.map((d) => ({
    technique: d.technique,
    zoneKey: d.zoneKey,
    maxWidthMm: d.maxWidthMm,
    maxHeightMm: d.maxHeightMm,
    tiers: toTiers(form.breakpoints, d.costs),
    ...(d.maxColors ? { maxColors: d.maxColors } : {}),
    ...(d.setupFee ? { setupFee: d.setupFee } : {}),
    ...(d.extraColorUnitCost ? { extraColorUnitCost: d.extraColorUnitCost } : {}),
  }));
  return {
    vendorId: form.vendorId,
    version: form.version,
    currency: "XOF",
    blanks: Object.fromEntries(form.variantIds.map((id) => [id, blankTiers])),
    decorations,
    ...(form.minOrderQty && form.minOrderQty > 1 ? { minOrderQty: form.minOrderQty } : {}),
    ...(form.orderSetupFee ? { orderSetupFee: form.orderSetupFee } : {}),
  };
}

const LABEL: Record<TechniqueKey, string> = {
  dtg: "DTG", dtf: "DTF", embroidery: "broderie", screen_print: "sérigraphie",
  sublimation: "sublimation", uv: "UV", engraving: "gravure", flock: "flocage",
};

function checkTiers(tiers: readonly Tier[], what: string, minQty: number, errors: string[]): void {
  if (tiers.length === 0) {
    errors.push(`${what} : indiquez au moins un prix.`);
    return;
  }
  const qtys = tiers.map((t) => t.minQty);
  if (new Set(qtys).size !== qtys.length) errors.push(`${what} : paliers en double.`);
  for (const t of tiers) {
    if (!Number.isSafeInteger(t.minQty) || t.minQty < 1) errors.push(`${what} : palier invalide.`);
    if (!Number.isSafeInteger(t.unitCost) || t.unitCost < 0) errors.push(`${what} : prix invalide (FCFA entiers, ≥ 0).`);
  }
  if (Math.min(...qtys) > minQty) errors.push(`${what} : il manque un prix pour ${minQty} pièce${minQty > 1 ? "s" : ""}.`);
}

/** Errors that would make the grid unusable by the pricing engine (empty list = valid). */
export function validateVendorGrid(grid: VendorPriceGrid): string[] {
  const errors: string[] = [];
  const minQty = grid.minOrderQty ?? 1;
  const blanks = Object.values(grid.blanks);
  if (blanks.length === 0) errors.push("Choisissez au moins une couleur/taille disponible.");
  const first = blanks[0];
  if (first) checkTiers(first, "Produit vierge", minQty, errors);
  if (grid.decorations.length === 0) errors.push("Activez au moins une zone et une technique.");
  for (const d of grid.decorations) {
    const what = `${LABEL[d.technique]} · ${d.zoneKey}`;
    checkTiers(d.tiers, what, d.minQty ?? minQty, errors);
    if (d.maxWidthMm <= 0 || d.maxHeightMm <= 0) errors.push(`${what} : dimensions invalides.`);
    for (const v of [d.setupFee, d.extraColorUnitCost, d.maxColors]) {
      if (v !== undefined && (!Number.isSafeInteger(v) || v < 0)) errors.push(`${what} : valeur invalide.`);
    }
  }
  for (const v of [grid.orderSetupFee, grid.minOrderQty]) {
    if (v !== undefined && (!Number.isSafeInteger(v) || v < 0)) errors.push("Frais fixes ou minimum invalides.");
  }
  return errors;
}

/** Parse a FCFA amount typed by a person ("2 500", "2500 F", "") → integer or null. */
export function parseFcfa(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const cleaned = input.replace(/[\s  ]/g, "").replace(/f(cfa)?$/i, "");
  if (cleaned === "") return null;
  if (!/^\d+$/.test(cleaned)) return Number.NaN;
  return Number.parseInt(cleaned, 10);
}
