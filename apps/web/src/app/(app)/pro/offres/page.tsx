import { redirect } from "next/navigation";
import Link from "next/link";
import { requireActiveVendor } from "@/lib/vendor";
import { Empty, PageHeader, StatusPill, fr } from "@/components/ui";
import { READ_FAILED, logError } from "@/lib/log";

export const metadata = { title: "Mes offres" };

export default async function OffersPage() {
  const { supabase, vendor, canManage } = await requireActiveVendor("/pro/offres");
  if (!canManage) redirect("/pro"); // prices: owner and managers only (RLS too)
  const [{ data: products, error }, { data: offers }] = await Promise.all([
    supabase.from("base_products").select("id, name, category:categories(name)").eq("status", "active").order("updated_at", { ascending: false }),
    supabase.from("vendor_offers").select("base_product_id, status, lead_time_days").eq("vendor_id", vendor.id),
  ]);
  const byProduct = new Map((offers ?? []).map((o) => [o.base_product_id, o]));
  if (error) logError("offers_read_failed", error);
  return (
    <div className="grid gap-6">
      <PageHeader title="Mes offres" back={{ href: "/pro", label: vendor.name }} />
      <p className="max-w-prose text-muted">Choisissez les produits que vous savez fabriquer, puis indiquez vos couleurs disponibles, vos techniques par zone et vos prix (FCFA, hors TVA).</p>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {products?.length === 0 && <Empty>Aucun produit publié par SAWWA pour l&apos;instant.</Empty>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(products ?? []).map((p) => {
          const offer = byProduct.get(p.id);
          return (
            <li key={p.id}>
              <Link href={`/pro/offres/${p.id}`} className="grid gap-2 rounded-xl border border-line bg-surface p-4">
                <span className="text-xs text-muted">{fr((p.category as unknown as { name: unknown } | null)?.name)}</span>
                <b>{fr(p.name)}</b>
                {offer ? <span className="flex items-center gap-2"><StatusPill status={offer.status} /><span className="text-sm text-muted">{offer.lead_time_days} j</span></span>
                       : <span className="text-sm text-action underline">Proposer ce produit</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
