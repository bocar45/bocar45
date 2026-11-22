import Link from "next/link";
import { hasPlatformRole, requirePlatformRole } from "@/lib/auth";
import { Empty, PageHeader, StatusPill, fr } from "@/components/ui";
import { READ_FAILED, logError } from "@/lib/log";

export const metadata = { title: "Catalogue" };

export default async function CatalogPage() {
  const { supabase, memberships } = await requirePlatformRole(["catalog", "ops", "vendor_manager"], "/admin/catalogue");
  const { data, error } = await supabase
    .from("base_products")
    .select("id, slug, name, status, updated_at, category:categories(name), variants:base_product_variants(count), zones(count)")
    .order("updated_at", { ascending: false });
  const canEdit = hasPlatformRole(memberships, ["catalog"]);
  if (error) logError("catalog_read_failed", error);
  return (
    <div className="grid gap-6">
      <PageHeader title="Catalogue de référence" back={{ href: "/admin", label: "Administration" }}>
        {canEdit && <Link href="/admin/catalogue/nouveau" className="rounded-md bg-action px-4 py-2 font-bold text-on-action">Nouveau produit</Link>}
      </PageHeader>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data?.length === 0 && <Empty>Aucun produit. Créez le premier produit de référence (ex. « T-shirt col rond 180 g »).</Empty>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-2">Produit</th><th className="p-2">Catégorie</th><th className="p-2 text-right">Variantes</th><th className="p-2 text-right">Zones</th><th className="p-2">Statut</th>
            </tr></thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="p-2"><Link href={`/admin/catalogue/${p.id}`} className="font-semibold underline">{fr(p.name)}</Link><div className="text-xs text-muted">{p.slug}</div></td>
                  <td className="p-2">{fr((p.category as unknown as { name: unknown } | null)?.name)}</td>
                  <td className="p-2 text-right tabular-nums">{(p.variants as unknown as { count: number }[])[0]?.count ?? 0}</td>
                  <td className="p-2 text-right tabular-nums">{(p.zones as unknown as { count: number }[])[0]?.count ?? 0}</td>
                  <td className="p-2"><StatusPill status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
