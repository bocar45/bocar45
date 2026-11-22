import Link from "next/link";
import { requireUser, vendorMembership } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/fulfillment";
import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Commandes atelier" };

const GROUPS: [string, string[]][] = [
  ["À prendre en charge", ["assigned"]],
  ["BAT à vérifier", ["proof_review"]],
  ["En attente du client", ["changes_requested"]],
  ["À produire", ["proof_approved", "in_production"]],
  ["À expédier", ["quality_check"]],
  ["Expédiées", ["shipped"]],
];

export default async function VendorOrders() {
  const { supabase, memberships } = await requireUser("/pro/commandes");
  const vendor = vendorMembership(memberships);
  if (!vendor || vendor.organization.status !== "active") redirect("/pro");
  const { data, error } = await supabase
    .from("fulfillments").select("id, status, sla_due_at, order_id, items:order_items!inner(quantity, product:base_products(name))")
    .eq("vendor_id", vendor.organization.id).order("sla_due_at", { ascending: true });
  const rows = (data ?? []) as unknown as { id: string; status: string; sla_due_at: string | null; items: { quantity: number; product: { name: { fr?: string } } }[] }[];
  const now = Date.now();
  return (
    <div className="grid gap-6">
      <PageHeader title="Commandes" back={{ href: "/pro", label: vendor.organization.name }} />
      {error && <p role="alert" className="text-error">⚠ {error.message}</p>}
      {rows.length === 0 && <Empty>Aucune commande pour le moment. Elles apparaissent ici dès que SAWWA vous en affecte une.</Empty>}
      {GROUPS.map(([title, statuses]) => {
        const list = rows.filter((r) => statuses.includes(r.status));
        if (list.length === 0) return null;
        return (
          <section key={title} className="grid gap-3">
            <h2 className="eyebrow flex items-center gap-2 text-muted"><span className="losange" aria-hidden="true" />{title} · {list.length}</h2>
            <ul className="grid gap-2">
              {list.map((r) => {
                const late = r.sla_due_at && new Date(r.sla_due_at).getTime() < now;
                return (
                  <li key={r.id}>
                    <Link href={`/pro/commandes/${r.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 text-base hover:border-terra">
                      <b>{r.items[0]?.product.name.fr}</b>
                      <span className="tabular-nums">{r.items.reduce((a, i) => a + i.quantity, 0)} pc</span>
                      <span className="rounded-full bg-sable px-3 py-1 text-xs font-bold">{STATUS_LABEL[r.status]}</span>
                      {r.sla_due_at && <span className={`ml-auto text-sm tabular-nums ${late ? "font-bold text-error" : "text-muted"}`}>{late ? "En retard · " : "Avant le "}{new Date(r.sla_due_at).toLocaleString("fr-SN", { dateStyle: "short", timeStyle: "short" })}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
