import Link from "next/link";
import { fcfa } from "@/lib/orders";

export type LedgerEntry = { id: number; type: string; amount: number; note: string; at: string; fulfillment_id: string | null };
const TYPE: Record<string, string> = { earning: "Commande livrée", penalty: "Pénalité (litige)", adjustment: "Ajustement", payout: "Versement" };

/** Statement of a workshop: entries with running balance (oldest first), shown to the team and to the workshop. */
export function LedgerStatement({ entries, orderLink }: { entries: LedgerEntry[]; orderLink?: (fulfillmentId: string) => string }) {
  let balance = 0;
  const rows = entries.map((e) => ({ ...e, balance: (balance += e.amount) }));
  if (rows.length === 0) return <p className="text-sm text-muted">Aucune écriture pour l&apos;instant : les gains apparaissent à la livraison des commandes.</p>;
  return (
    <div className="grid gap-2">
      <p className="text-lg">Solde dû : <b className="tabular-nums">{fcfa(balance)}</b></p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th className="p-2">Date</th><th className="p-2">Opération</th><th className="p-2">Détail</th><th className="p-2 text-right">Montant</th><th className="p-2 text-right">Solde</th>
          </tr></thead>
          <tbody>
            {[...rows].reverse().map((e) => (
              <tr key={e.id} className="border-b border-line">
                <td className="p-2 tabular-nums">{new Date(e.at).toLocaleDateString("fr-SN")}</td>
                <td className="p-2">{TYPE[e.type] ?? e.type}</td>
                <td className="p-2">{e.fulfillment_id && orderLink ? <Link className="underline" href={orderLink(e.fulfillment_id)}>{e.note || "Commande"}</Link> : e.note}</td>
                <td className={`p-2 text-right tabular-nums ${e.amount < 0 ? "text-error" : ""}`}>{fcfa(e.amount)}</td>
                <td className="p-2 text-right tabular-nums">{fcfa(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
