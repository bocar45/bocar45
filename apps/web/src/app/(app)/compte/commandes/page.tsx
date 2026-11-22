import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/fulfillment";
import { fcfa } from "@/lib/orders";
import { Empty, PageHeader } from "@/components/ui";
import { READ_FAILED, TRY_AGAIN, logError } from "@/lib/log";

export const metadata = { title: "Mes commandes" };

export default async function MyOrders() {
  const { supabase } = await requireUser("/compte/commandes");
  const { data, error } = await supabase.from("orders").select("id, number, total, payment_status, created_at, fulfillments(status)").order("created_at", { ascending: false });
  if (error) logError("customer_orders_read_failed", error);
  return (
    <div className="grid gap-6">
      <PageHeader title="Mes commandes" back={{ href: "/compte", label: "Mon compte" }} />
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data?.length === 0 && <Empty>Aucune commande pour l&apos;instant.</Empty>}
      <ul className="grid gap-3">
        {(data ?? []).map((o) => {
          const status = (o.fulfillments as { status: string }[])[0]?.status ?? "pending_assignment";
          return (
            <li key={o.id}>
              <Link href={`/compte/commandes/${o.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 hover:border-terra">
                <b className="tabular-nums">{o.number}</b>
                <span className="text-sm text-muted">{new Date(o.created_at).toLocaleDateString("fr-SN")}</span>
                <span className="rounded-full bg-sable px-3 py-1 text-xs font-bold">{o.payment_status === "awaiting_payment" ? "Paiement attendu" : STATUS_LABEL[status]}</span>
                <span className="ml-auto font-bold tabular-nums">{fcfa(o.total)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
