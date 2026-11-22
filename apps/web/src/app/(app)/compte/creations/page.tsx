import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Empty, PageHeader, fr } from "@/components/ui";
import { READ_FAILED, logError } from "@/lib/log";

export const metadata = { title: "Mes créations" };

export default async function MyDesigns() {
  const { supabase } = await requireUser("/compte/creations");
  const { data, error } = await supabase.from("designs").select("id, title, updated_at, product:base_products(slug, name)").order("updated_at", { ascending: false });
  if (error) logError("designs_read_failed", error);
  return (
    <div className="grid gap-6">
      <PageHeader title="Mes créations" back={{ href: "/compte", label: "Mon compte" }} />
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data?.length === 0 && <Empty>Aucune création enregistrée. Ouvrez le studio depuis une fiche produit et cliquez sur « Enregistrer dans mon compte ».</Empty>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((d) => {
          const p = d.product as unknown as { slug: string; name: unknown } | null;
          return (
            <li key={d.id}>
              <Link href={`/studio/${p?.slug}?creation=${d.id}`} className="grid gap-1 rounded-xl border border-line bg-surface p-4 hover:border-terra">
                <b>{d.title}</b>
                <span className="text-sm text-muted">{fr(p?.name)}</span>
                <span className="text-xs text-muted">Modifiée le {new Date(d.updated_at).toLocaleDateString("fr-SN")}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
