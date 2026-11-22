import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { REQUEST_STATUS } from "@/lib/b2b";
import { Empty, PageHeader } from "@/components/ui";
import { READ_FAILED, logError } from "@/lib/log";

export const metadata = { title: "Mes devis" };

export default async function MyQuotes() {
  const { supabase } = await requireUser("/compte/devis");
  const { data, error } = await supabase.from("quote_requests").select("id, number, organization_name, quantity, status, created_at").order("created_at", { ascending: false });
  if (error) logError("customer_quotes_read_failed", error);
  return (
    <div className="grid gap-6">
      <PageHeader title="Mes devis" back={{ href: "/compte", label: "Mon compte" }}>
        <Link href="/devis" className="rounded-md bg-action px-4 py-2 font-bold text-on-action">Demander un devis</Link>
      </PageHeader>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data?.length === 0 && <Empty>Aucune demande de devis. Pour une association, un club ou une entreprise, demandez un prix ferme.</Empty>}
      <ul className="grid gap-3">
        {(data ?? []).map((r) => (
          <li key={r.id}>
            <Link href={`/compte/devis/${r.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 hover:border-terra">
              <b className="tabular-nums">{r.number}</b>
              <span>{r.organization_name} · {r.quantity} pièces</span>
              <span className="text-sm text-muted">{new Date(r.created_at).toLocaleDateString("fr-SN")}</span>
              <span className="ml-auto rounded-full bg-sable px-3 py-1 text-xs font-bold">{REQUEST_STATUS[r.status] ?? r.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
