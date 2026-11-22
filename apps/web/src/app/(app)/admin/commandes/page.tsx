import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/fulfillment";
import { fcfa } from "@/lib/orders";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Commandes" };

const TABS = {
  payer: { label: "À encaisser", match: (pay: string) => pay === "awaiting_payment" },
  affecter: { label: "À affecter", match: (pay: string, st: string) => pay === "paid" && (st === "pending_assignment") },
  cours: { label: "En cours", match: (pay: string, st: string) => pay === "paid" && !["pending_assignment", "delivered", "cancelled"].includes(st) },
  terminees: { label: "Terminées", match: (_: string, st: string) => ["delivered", "cancelled"].includes(st) },
} as const;
type Tab = keyof typeof TABS;

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { supabase } = await requirePlatformRole(["ops", "support", "finance"], "/admin/commandes");
  const { vue } = await searchParams;
  const tab: Tab = vue && vue in TABS ? (vue as Tab) : "payer";
  const { data, error } = await supabase
    .from("orders").select("id, number, total, payment_status, shipping_address, created_at, fulfillments(status, sla_due_at, vendor:organizations(name)), items:order_items(versions:order_item_versions(surcharge))")
    .order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []).map((o) => {
    const f = (o.fulfillments as unknown as { status: string; sla_due_at: string | null; vendor: { name: string } | null }[])[0];
    const surcharge = (o.items as unknown as { versions: { surcharge: number }[] }[]).flatMap((i) => i.versions).reduce((n, v) => n + Number(v.surcharge), 0);
    return { ...o, status: f?.status ?? "pending_assignment", vendor: f?.vendor?.name ?? null, sla: f?.sla_due_at ?? null, surcharge };
  });
  const counts = Object.fromEntries((Object.keys(TABS) as Tab[]).map((t) => [t, rows.filter((r) => TABS[t].match(r.payment_status, r.status)).length]));
  const shown = rows.filter((r) => TABS[tab].match(r.payment_status, r.status));
  const now = Date.now();
  return (
    <div className="grid gap-6">
      <PageHeader title="Commandes" back={{ href: "/admin", label: "Administration" }} />
      <nav className="flex flex-wrap gap-2" aria-label="Vues">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link key={t} href={`/admin/commandes?vue=${t}`} aria-current={t === tab ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold ${t === tab ? "bg-brun text-ivoire" : "border border-line"}`}>{TABS[t].label} <span className="tabular-nums">{counts[t]}</span></Link>
        ))}
      </nav>
      {error && <p role="alert" className="text-error">⚠ {error.message}</p>}
      {shown.length === 0 ? <Empty>Aucune commande dans cette vue.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-2">Commande</th><th className="p-2">Client</th><th className="p-2">Statut</th><th className="p-2">Atelier</th><th className="p-2">Échéance</th><th className="p-2 text-right">Total TTC</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => {
                const late = r.sla && new Date(r.sla).getTime() < now && !["delivered", "cancelled", "shipped"].includes(r.status);
                return (
                  <tr key={r.id} className="border-b border-line">
                    <td className="p-2"><Link className="font-semibold underline tabular-nums" href={`/admin/commandes/${r.id}`}>{r.number}</Link><div className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString("fr-SN")}</div></td>
                    <td className="p-2">{(r.shipping_address as { name?: string }).name}</td>
                    <td className="p-2">{r.payment_status === "awaiting_payment" ? "Paiement attendu" : STATUS_LABEL[r.status]}{r.surcharge > 0 && <span className="ml-2 rounded-full bg-ocre/25 px-2 py-0.5 text-xs font-bold">Supplément {fcfa(r.surcharge)}</span>}</td>
                    <td className="p-2">{r.vendor ?? "—"}</td>
                    <td className={`p-2 tabular-nums ${late ? "font-bold text-error" : ""}`}>{r.sla ? `${late ? "En retard · " : ""}${new Date(r.sla).toLocaleString("fr-SN", { dateStyle: "short", timeStyle: "short" })}` : "—"}</td>
                    <td className="p-2 text-right tabular-nums">{fcfa(r.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
