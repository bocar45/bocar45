import { isTechnique, type Technique } from "@sawwa/catalog";
import { DEFAULT_BREAKPOINTS, buildVendorGrid, parseFcfa, validateVendorGrid, type GridForm, type VendorPriceGrid } from "@sawwa/pricing";
import { checked, int, str } from "./form";

export type OfferZone = { id: string; key: string; max_width_mm: number; max_height_mm: number; allowed_techniques: Technique[] };
export type Capability = { zone_id: string; technique: Technique; max_width_mm: number; max_height_mm: number; max_colors: number | null };

/** Field names shared by the offer editor page and this parser. */
export const offerField = {
  variant: (variantId: string) => `variant_${variantId}`,
  blank: (i: number) => `blank_${i}`,
  key: (zoneId: string, t: Technique) => `${zoneId}_${t}`,
  cap: (k: string) => `cap_${k}`,
  width: (k: string) => `w_${k}`,
  height: (k: string) => `h_${k}`,
  colors: (k: string) => `colors_${k}`,
  cost: (k: string, i: number) => `cost_${k}_${i}`,
  setup: (k: string) => `setup_${k}`,
  extra: (k: string) => `extra_${k}`,
};

export interface ParsedOffer {
  errors: string[];
  status: "active" | "draft";
  minQty: number;
  leadTimeDays: number;
  variantIds: string[];
  capabilities: Capability[];
  grid: VendorPriceGrid;
}

/** Workshop offer form → offer rows + versioned price grid. Pure. */
export function parseOfferForm(
  fd: FormData,
  ctx: { vendorId: string; version: number; variantIds: string[]; zones: OfferZone[] },
): ParsedOffer {
  const errors: string[] = [];
  const costRow = (name: (i: number) => string, label: string) =>
    DEFAULT_BREAKPOINTS.map((q, i) => {
      const v = parseFcfa(str(fd, name(i)));
      if (Number.isNaN(v)) errors.push(`${label}, ${q} pc : montant invalide.`);
      return v === null || Number.isNaN(v) ? null : v;
    });

  const variantIds = ctx.variantIds.filter((id) => checked(fd, offerField.variant(id)));
  const capabilities: Capability[] = [];
  const decorations: GridForm["decorations"][number][] = [];

  for (const z of ctx.zones) {
    for (const t of z.allowed_techniques.filter(isTechnique)) {
      const k = offerField.key(z.id, t);
      if (!checked(fd, offerField.cap(k))) continue;
      const label = `${z.key} · ${t}`;
      const w = int(fd, offerField.width(k)) ?? z.max_width_mm;
      const h = int(fd, offerField.height(k)) ?? z.max_height_mm;
      if (Number.isNaN(w) || Number.isNaN(h) || w < 1 || h < 1 || w > z.max_width_mm || h > z.max_height_mm) {
        errors.push(`${label} : dimensions entre 1 et ${z.max_width_mm} × ${z.max_height_mm} mm.`);
        continue;
      }
      const colors = int(fd, offerField.colors(k));
      const setup = parseFcfa(str(fd, offerField.setup(k)));
      const extra = parseFcfa(str(fd, offerField.extra(k)));
      if ([colors, setup, extra].some((v) => Number.isNaN(v))) errors.push(`${label} : valeur invalide.`);
      const ok = (v: number | null): v is number => v !== null && !Number.isNaN(v) && v > 0;
      capabilities.push({ zone_id: z.id, technique: t, max_width_mm: w, max_height_mm: h, max_colors: ok(colors) ? colors : null });
      decorations.push({
        zoneKey: z.key, technique: t, maxWidthMm: w, maxHeightMm: h,
        ...(ok(colors) ? { maxColors: colors } : {}),
        costs: costRow((i) => offerField.cost(k, i), label),
        ...(ok(setup) ? { setupFee: setup } : {}),
        ...(ok(extra) ? { extraColorUnitCost: extra } : {}),
      });
    }
  }

  const minQty = int(fd, "min_qty") ?? 1;
  const leadTimeDays = int(fd, "lead_time_days") ?? 5;
  if (Number.isNaN(minQty) || minQty < 1) errors.push("Quantité minimale : nombre entier ≥ 1.");
  if (Number.isNaN(leadTimeDays) || leadTimeDays < 1 || leadTimeDays > 60) errors.push("Délai : entre 1 et 60 jours.");

  const grid = buildVendorGrid({
    vendorId: ctx.vendorId,
    version: ctx.version,
    breakpoints: DEFAULT_BREAKPOINTS,
    variantIds,
    blankCosts: costRow(offerField.blank, "Produit vierge"),
    decorations,
    ...(minQty > 1 ? { minOrderQty: minQty } : {}),
  });
  errors.push(...validateVendorGrid(grid));
  return { errors: [...new Set(errors)], status: checked(fd, "active") ? "active" : "draft", minQty, leadTimeDays, variantIds, capabilities, grid };
}
