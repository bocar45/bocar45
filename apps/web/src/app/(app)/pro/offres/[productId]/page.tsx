import { notFound, redirect } from "next/navigation";
import { TECHNIQUE_LABEL, isTechnique, type Technique } from "@sawwa/catalog";
import { DEFAULT_BREAKPOINTS, tierCost, type Tier, type VendorPriceGrid } from "@sawwa/pricing";
import { offerField } from "@/lib/offer-form";
import { requireActiveVendor } from "@/lib/vendor";
import { ActionForm } from "@/components/action-form";
import { Field, PageHeader, Section, fr, inputClass } from "@/components/ui";
import { saveOffer } from "../actions";

export const metadata = { title: "Offre" };

type Variant = { id: string; color_key: string; color_hex: string; size: string };
type Zone = { id: string; key: string; max_width_mm: number; max_height_mm: number; allowed_techniques: Technique[]; anchor: { label?: string; note?: string } };
type Capability = { zone_id: string; technique: Technique; max_width_mm: number; max_height_mm: number; max_colors: number | null };

const cell = "w-24 rounded-md border border-line bg-bg px-2 py-1 text-right tabular-nums";
const NEEDS_COLORS: Technique[] = ["embroidery", "screen_print", "flock"];

/** Show only the costs that start a tier, so the form round-trips to the same grid. */
function rowValues(tiers: readonly Tier[] | undefined) {
  return DEFAULT_BREAKPOINTS.map((q) => tiers?.find((t) => t.minQty === q)?.unitCost ?? "");
}

export default async function OfferEditor({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const { supabase, vendor, canManage } = await requireActiveVendor(`/pro/offres/${productId}`);
  if (!canManage) redirect("/pro"); // prices: owner and managers only (RLS too)
  const { data: product } = await supabase
    .from("base_products")
    .select("id, name, status, variants:base_product_variants(id, color_key, color_hex, size), zones(id, key, max_width_mm, max_height_mm, allowed_techniques, anchor)")
    .eq("id", productId)
    .eq("status", "active")
    .single();
  if (!product) notFound();

  const { data: offer } = await supabase
    .from("vendor_offers")
    .select("id, status, min_qty, lead_time_days, variants:vendor_offer_variants(variant_id), caps:vendor_zone_capabilities(zone_id, technique, max_width_mm, max_height_mm, max_colors), grids:vendor_price_grids(version, grid)")
    .eq("vendor_id", vendor.id)
    .eq("base_product_id", productId)
    .maybeSingle();

  const variants = (product.variants ?? []) as Variant[];
  const zones = (product.zones ?? []) as Zone[];
  const offered = new Set(((offer?.variants ?? []) as { variant_id: string }[]).map((v) => v.variant_id));
  const caps = (offer?.caps ?? []) as Capability[];
  const grids = ((offer?.grids ?? []) as { version: number; grid: VendorPriceGrid }[]).sort((a, b) => b.version - a.version);
  const grid = grids[0]?.grid;
  const firstBlank = grid ? Object.values(grid.blanks)[0] : undefined;
  const isNew = !offer;

  return (
    <div className="grid gap-6">
      <PageHeader title={fr(product.name)} back={{ href: "/pro/offres", label: "Mes offres" }}>
        {grids[0] && <span className="text-sm text-muted">Grille de prix v{grids[0].version}</span>}
      </PageHeader>
      {!canManage && <p className="text-muted">Lecture seule : seuls le propriétaire ou un gérant modifient les offres.</p>}

      <ActionForm action={saveOffer.bind(null, productId)} submitLabel="Enregistrer l'offre" className="grid gap-6">
        <Section title="Conditions" id="conditions">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quantité minimale" htmlFor="min_qty"><input id="min_qty" name="min_qty" inputMode="numeric" defaultValue={offer?.min_qty ?? 1} className={inputClass} /></Field>
            <Field label="Délai de fabrication (jours ouvrés)" htmlFor="lead_time_days"><input id="lead_time_days" name="lead_time_days" inputMode="numeric" defaultValue={offer?.lead_time_days ?? 5} className={inputClass} /></Field>
          </div>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="active" defaultChecked={isNew || offer?.status === "active"} /> Proposer ce produit aux clients SAWWA
          </label>
        </Section>

        <Section title="Couleurs et tailles que vous pouvez fournir" id="variants">
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <label key={v.id} className="inline-flex items-center gap-2 rounded-md border border-line px-2 py-1 text-sm">
                <input type="checkbox" name={offerField.variant(v.id)} defaultChecked={isNew || offered.has(v.id)} />
                <span className="inline-block size-4 rounded-full border border-line" style={{ background: v.color_hex }} aria-hidden="true" />
                {v.color_key.replace(/_/g, " ")} {v.size}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Vos prix (FCFA hors TVA, par pièce)" id="prices">
          <p className="text-sm text-muted">Remplissez la colonne « 1 pc ». Les autres colonnes sont des prix dégressifs : laissez vide si le prix ne change pas.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="p-2">Élément</th>
                {DEFAULT_BREAKPOINTS.map((q) => <th key={q} className="p-2 text-right">{q} pc{q > 1 ? "+" : ""}</th>)}
                <th className="p-2 text-right">Frais fixes</th><th className="p-2 text-right">Couleur en +</th>
              </tr></thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="p-2 font-semibold">Produit vierge</td>
                  {rowValues(firstBlank).map((v, i) => (
                    <td key={i} className="p-2 text-right"><input aria-label={`Produit vierge, ${DEFAULT_BREAKPOINTS[i]} pièces`} name={offerField.blank(i)} inputMode="numeric" defaultValue={v} className={cell} /></td>
                  ))}
                  <td /><td />
                </tr>
                {zones.flatMap((z) =>
                  z.allowed_techniques.filter(isTechnique).map((t) => {
                    const k = offerField.key(z.id, t);
                    const cap = caps.find((c) => c.zone_id === z.id && c.technique === t);
                    const rate = grid?.decorations.find((d) => d.zoneKey === z.key && d.technique === t);
                    const label = `${z.anchor?.label ?? z.key} · ${TECHNIQUE_LABEL[t]}`;
                    return (
                      <tr key={k} className="border-b border-line align-top">
                        <td className="grid gap-2 p-2">
                          <label className="inline-flex items-center gap-2 font-semibold"><input type="checkbox" name={offerField.cap(k)} defaultChecked={Boolean(cap)} /> {label}</label>
                          <span className="flex flex-wrap items-center gap-1 text-xs text-muted">
                            max
                            <input aria-label={`${label} : largeur max en mm`} name={offerField.width(k)} inputMode="numeric" defaultValue={cap?.max_width_mm ?? z.max_width_mm} className="w-16 rounded border border-line bg-bg px-1 text-right" />
                            ×
                            <input aria-label={`${label} : hauteur max en mm`} name={offerField.height(k)} inputMode="numeric" defaultValue={cap?.max_height_mm ?? z.max_height_mm} className="w-16 rounded border border-line bg-bg px-1 text-right" />
                            mm
                            {NEEDS_COLORS.includes(t) && (<>
                              · couleurs max
                              <input aria-label={`${label} : nombre de couleurs max`} name={offerField.colors(k)} inputMode="numeric" defaultValue={cap?.max_colors ?? ""} className="w-12 rounded border border-line bg-bg px-1 text-right" />
                            </>)}
                          </span>
                        </td>
                        {rowValues(rate?.tiers).map((v, i) => (
                          <td key={i} className="p-2 text-right"><input aria-label={`${label}, ${DEFAULT_BREAKPOINTS[i]} pièces`} name={offerField.cost(k, i)} inputMode="numeric" defaultValue={v} className={cell} /></td>
                        ))}
                        <td className="p-2 text-right"><input aria-label={`${label} : frais fixes`} name={offerField.setup(k)} inputMode="numeric" defaultValue={rate?.setupFee ?? ""} className={cell} /></td>
                        <td className="p-2 text-right">{NEEDS_COLORS.includes(t) ? <input aria-label={`${label} : coût par couleur supplémentaire`} name={offerField.extra(k)} inputMode="numeric" defaultValue={rate?.extraColorUnitCost ?? ""} className={cell} /> : null}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
          {grid && firstBlank && (
            <p className="text-sm text-muted">
              Exemple avec vos prix actuels : 1 pièce vierge {tierCost(firstBlank, 1)?.toLocaleString("fr-FR")} FCFA ; 50 pièces {tierCost(firstBlank, 50)?.toLocaleString("fr-FR")} FCFA la pièce.
            </p>
          )}
        </Section>
      </ActionForm>
    </div>
  );
}
