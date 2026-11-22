import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { requirePlatformRole } from "@/lib/auth";
import { READ_FAILED, logError } from "@/lib/log";
import { fcfa } from "@/lib/orders";

export const metadata = { title: "Finances ateliers" };

export default async function Finances() {
  const { supabase } = await requirePlatformRole(["finance", "ops"], "/admin/finances");
  const [{ data: ledger, error }, { data: vendors }] = await Promise.all([
    supabase.from("vendor_ledger").select("vendor_id, type, amount").limit(50000),
    supabase.from("organizations").select("id, name, status").eq("kind", "vendor").order("name"),
  ]);
  if (error) logError("finances_read_failed", error);
  const sums = new Map<string, { balance: number; earned: number; paid: number; penalties: number }>();
  for (const e of ledger ?? []) {
    const s = sums.get(e.vendor_id) ?? { balance: 0, earned: 0, paid: 0, penalties: 0 };
    s.balance += e.amount;
    if (e.type === "earning") s.earned += e.amount;
    if (e.type === "payout") s.paid -= e.amount;
    if (e.type === "penalty") s.penalties -= e.amount;
    sums.set(e.vendor_id, s);
  }
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  return (
    <div className="grid gap-6">
      <PageHeader title="Finances des ateliers" back={{ href: "/admin", label: "Administration" }} />
      <p className="max-w-3xl text-sm text-muted">Le gain d&apos;un atelier est inscrit à la livraison, à son coût figé à l&apos;affectation. Les pénalités viennent des litiges. Solde = gains − pénalités − versements ± ajustements.</p>
      <section className="grid gap-2 rounded-xl border border-line bg-surface p-4 text-sm">
        <b>Export comptable (CSV, séparateur « ; »)</b>
        <form method="get" action="/api/export" className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">Données<select name="type" className="rounded-md border border-line px-2 py-1.5"><option value="orders">Commandes (ventes, TVA)</option><option value="ledger">Grand livre ateliers</option><option value="payouts">Versements</option><option value="disputes">Litiges</option></select></label>
          <label className="grid gap-1">Du<input type="date" name="from" defaultValue={monthStart} className="rounded-md border border-line px-2 py-1.5" /></label>
          <label className="grid gap-1">Au<input type="date" name="to" defaultValue={today} className="rounded-md border border-line px-2 py-1.5" /></label>
          <button type="submit" className="rounded-md bg-action px-4 py-2 font-bold text-on-action">Télécharger</button>
        </form>
      </section>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {vendors?.length === 0 && <Empty>Aucun atelier.</Empty>}
      {vendors && vendors.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-2">Atelier</th><th className="p-2 text-right">Gagné</th><th className="p-2 text-right">Pénalités</th><th className="p-2 text-right">Versé</th><th className="p-2 text-right">Solde dû</th>
            </tr></thead>
            <tbody>
              {vendors.map((v) => {
                const s = sums.get(v.id) ?? { balance: 0, earned: 0, paid: 0, penalties: 0 };
                return (
                  <tr key={v.id} className="border-b border-line">
                    <td className="p-2"><Link className="font-semibold underline" href={`/admin/finances/${v.id}`}>{v.name}</Link>{v.status !== "active" && <span className="ml-2 text-xs text-muted">({v.status})</span>}</td>
                    <td className="p-2 text-right tabular-nums">{fcfa(s.earned)}</td>
                    <td className="p-2 text-right tabular-nums">{fcfa(s.penalties)}</td>
                    <td className="p-2 text-right tabular-nums">{fcfa(s.paid)}</td>
                    <td className="p-2 text-right font-bold tabular-nums">{fcfa(s.balance)}</td>
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
