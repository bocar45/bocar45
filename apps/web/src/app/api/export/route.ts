import { vendorCostsByOrder } from "@/lib/fulfillment-costs";
import { NextResponse, type NextRequest } from "next/server";
import { getSession, hasPlatformRole } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { logError } from "@/lib/log";

export const runtime = "nodejs";

const plain = (message: string, status: number) => new NextResponse(`${message}\n`, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * E20 — accounting exports (finance, ops): orders (sales and VAT), workshop ledger, payouts, disputes, over a period.
 * Read with the user's own session: RLS limits what each role sees.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return plain("Connectez-vous pour télécharger cet export.", 401);
  if (!hasPlatformRole(session.memberships, ["finance", "ops"])) return plain("Export réservé à la finance et aux opérations.", 403);
  const p = request.nextUrl.searchParams;
  const from = day(p.get("from")), to = day(p.get("to"));
  if (!from || !to || from > to) return plain("Période invalide.", 400);
  const start = `${from}T00:00:00Z`, end = `${to}T23:59:59.999Z`;
  const db = session.supabase;
  const date = (v: string | null) => (v ? v.slice(0, 10) : "");
  let csv: string;
  try {
    switch (p.get("type")) {
      case "orders": {
        const { data, error } = await db.from("orders").select("number, created_at, paid_at, payment_status, payment_reference, subtotal, shipping, discount, tax, total, deposit_due, id, fulfillments(status, vendor:organizations(name))").gte("created_at", start).lte("created_at", end).order("created_at");
        if (error) throw error;
        const costs = await vendorCostsByOrder(db, (data ?? []).map((o) => o.id as string));
        csv = toCsv(["Commande", "Date", "Payée le", "Paiement", "Référence paiement", "Articles TTC", "Livraison TTC", "Remise TTC", "TVA", "Total TTC", "Acompte", "Statut fabrication", "Atelier", "Coût atelier HT"],
          (data ?? []).map((o) => { const f = (o.fulfillments as unknown as { status: string; vendor: { name: string } | null }[])[0];
            return [o.number, date(o.created_at), date(o.paid_at), o.payment_status, o.payment_reference, o.subtotal, o.shipping, o.discount, o.tax, o.total, o.deposit_due, f?.status, f?.vendor?.name, costs.get(o.id as string) ?? null]; }));
        break;
      }
      case "ledger": {
        const { data, error } = await db.from("vendor_ledger").select("id, at, type, amount, note, vendor:organizations(name), fulfillment_id").gte("at", start).lte("at", end).order("at");
        if (error) throw error;
        csv = toCsv(["N°", "Date", "Atelier", "Type", "Montant (FCFA)", "Détail", "Ordre de fabrication"],
          (data ?? []).map((e) => [e.id, date(e.at), (e.vendor as unknown as { name: string } | null)?.name, e.type, e.amount, e.note, e.fulfillment_id]));
        break;
      }
      case "payouts": {
        const { data, error } = await db.from("payouts").select("at, amount, method, reference, vendor:organizations(name)").gte("at", start).lte("at", end).order("at");
        if (error) throw error;
        csv = toCsv(["Date", "Atelier", "Montant (FCFA)", "Moyen", "Référence"], (data ?? []).map((v) => [date(v.at), (v.vendor as unknown as { name: string } | null)?.name, v.amount, v.method, v.reference]));
        break;
      }
      case "disputes": {
        const { data, error } = await db.from("disputes").select("created_at, resolved_at, reason, status, resolution, refund_amount, vendor_liable, penalty_amount, order:orders(number)").gte("created_at", start).lte("created_at", end).order("created_at");
        if (error) throw error;
        csv = toCsv(["Ouvert le", "Commande", "Motif", "Statut", "Décision", "Remboursement (FCFA)", "Faute atelier", "Pénalité (FCFA)", "Tranché le"],
          (data ?? []).map((d) => [date(d.created_at), (d.order as unknown as { number: string } | null)?.number, d.reason, d.status, d.resolution, d.refund_amount, d.vendor_liable ? "oui" : "non", d.penalty_amount, date(d.resolved_at)]));
        break;
      }
      default: return plain("Type d'export inconnu.", 400);
    }
  } catch (e) {
    logError("export_failed", e, { type: p.get("type") });
    return plain("L'export n'a pas pu être généré. Réessayez dans un instant.", 500);
  }
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sawwa-${p.get("type")}-${from}-${to}.csv"`, "Cache-Control": "private, no-store" } });
}
