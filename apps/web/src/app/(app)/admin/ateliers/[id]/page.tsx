import { notFound } from "next/navigation";
import { TECHNIQUE_LABEL } from "@sawwa/catalog";
import { DEFAULT_BREAKPOINTS, PricingError, price, type PlatformRuleSet, type VendorPriceGrid } from "@sawwa/pricing";
import { requirePlatformRole } from "@/lib/auth";
import { Empty, PageHeader, Section, StatusPill, fr } from "@/components/ui";

export const metadata = { title: "Atelier" };

const fcfa = (n: number) => n.toLocaleString("fr-FR");

export default async function VendorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requirePlatformRole(["ops", "vendor_manager"], `/admin/ateliers/${id}`);
  const [{ data: org }, { data: offers }, { data: rulesRow }] = await Promise.all([
    supabase.from("organizations").select("id, name, ninea, status, created_at").eq("id", id).eq("kind", "vendor").single(),
    supabase
      .from("vendor_offers")
      .select("id, status, min_qty, lead_time_days, product:base_products(name, category:categories(slug)), grids:vendor_price_grids(version, grid, created_at)")
      .eq("vendor_id", id),
    supabase.from("price_rule_sets").select("version, rules").eq("status", "active").maybeSingle(),
  ]);
  if (!org) notFound();
  const rules = (rulesRow?.rules ?? null) as PlatformRuleSet | null;

  return (
    <div className="grid gap-6">
      <PageHeader title={org.name} back={{ href: "/admin/ateliers", label: "Ateliers" }}>
        <StatusPill status={org.status} />
      </PageHeader>
      <p className="text-muted">NINEA : {org.ninea ?? "—"} · Candidature du {new Date(org.created_at).toLocaleDateString("fr-SN")}</p>
      {!rules && <p className="rounded-lg border border-line bg-surface p-3 text-muted">Aucune règle de prix active (ou pas de droit de lecture) : les prix publics ne peuvent pas être simulés.</p>}
      {offers?.length === 0 && <Empty>Cet atelier n&apos;a encore proposé aucun produit.</Empty>}
      {(offers ?? []).map((o) => {
        const product = o.product as unknown as { name: unknown; category: { slug: string } | null } | null;
        const latest = ((o.grids ?? []) as { version: number; grid: VendorPriceGrid; created_at: string }[]).sort((a, b) => b.version - a.version)[0];
        const grid = latest?.grid;
        const variantId = grid ? Object.keys(grid.blanks)[0] : undefined;
        return (
          <Section key={o.id} title={fr(product?.name)} id={`offer-${o.id}`}>
            <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
              <StatusPill status={o.status} /> Minimum {o.min_qty} pc · {o.lead_time_days} jours
              {latest && <> · grille v{latest.version} du {new Date(latest.created_at).toLocaleDateString("fr-SN")}</>}
            </p>
            {grid && variantId && rules && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="pb-2 text-left text-muted">Prix public TTC par pièce (règles v{rules.version}) — coût atelier et marge SAWWA en dessous</caption>
                  <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                    <th className="p-2">Marquage (taille max)</th>
                    {DEFAULT_BREAKPOINTS.map((q) => <th key={q} className="p-2 text-right">{q} pc</th>)}
                  </tr></thead>
                  <tbody>
                    {grid.decorations.map((d) => (
                      <tr key={`${d.zoneKey}-${d.technique}`} className="border-b border-line">
                        <td className="p-2">{d.zoneKey} · {TECHNIQUE_LABEL[d.technique]} ({d.maxWidthMm}×{d.maxHeightMm} mm)</td>
                        {DEFAULT_BREAKPOINTS.map((q) => {
                          try {
                            const quote = price(
                              { category: product?.category?.slug ?? "default", lines: [{ variantId, quantity: Math.max(q, o.min_qty) }], decorations: [{ zoneKey: d.zoneKey, technique: d.technique, widthMm: d.maxWidthMm, heightMm: d.maxHeightMm }] },
                              rules,
                              grid,
                            );
                            const line = quote.lines[0]!;
                            const perPiece = Math.round(quote.margin.amount / quote.totalQuantity);
                            return (
                              <td key={q} className="p-2 text-right tabular-nums">
                                <b>{fcfa(line.unitPrice.amount)}</b>
                                <div className="text-xs text-muted">{fcfa(line.vendorUnitCost.amount)} · +{fcfa(perPiece)}</div>
                              </td>
                            );
                          } catch (e) {
                            return <td key={q} className="p-2 text-right text-xs text-muted">{e instanceof PricingError ? "non proposé" : "erreur"}</td>;
                          }
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        );
      })}
    </div>
  );
}
