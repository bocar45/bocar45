import { vendorCostsByOrder } from "@/lib/fulfillment-costs";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { hasPlatformRole, requirePlatformRole } from "@/lib/auth";
import { computeKpis, pct, type OrderRow } from "@/lib/dashboard";
import { READ_FAILED, logError } from "@/lib/log";
import { fcfa } from "@/lib/orders";

export const metadata = { title: "Tableau de bord" };
const PERIODS = { "7": "7 jours", "30": "30 jours", "90": "90 jours", "365": "12 mois" } as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  const { supabase, memberships } = await requirePlatformRole(["ops", "finance"], "/admin/tableau-de-bord");
  const canModerate = hasPlatformRole(memberships, ["ops", "support"]);
  const { jours } = await searchParams;
  const days = jours && jours in PERIODS ? Number(jours) : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [{ data, error }, { count: openDisputes }, { count: openReports }, { data: ruleSets }] = await Promise.all([
    supabase.from("orders").select("total, tax, shipping, payment_status, created_at, quote_snapshot, id, fulfillments(status, sla_due_at, proof_round), events:status_events(event, at)")
      .gte("created_at", since).limit(5000),
    supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("price_rule_sets").select("version, rules"),
  ]);
  if (error) logError("dashboard_read_failed", error);
  // each order is split with the VAT rate of the rule set it was priced with (frozen in its quote)
  const vatOf = new Map((ruleSets ?? []).map((r) => [r.version as number, (r.rules as { vatBps: number }).vatBps]));
  const costs = await vendorCostsByOrder(supabase, (data ?? []).map((o) => o.id as string)).catch((e) => { logError("dashboard_costs_failed", e); return new Map<string, number | null>(); });
  const rows = (data ?? []).map((o) => ({ ...o, fulfillments: (o.fulfillments as unknown as Record<string, unknown>[]).map((f) => ({ ...f, vendor_cost: costs.get(o.id as string) ?? null })), vatBps: vatOf.get((o.quote_snapshot as { ruleSetVersion?: number } | null)?.ruleSetVersion ?? -1) ?? 1800 })) as unknown as OrderRow[];
  const k = computeKpis(rows);
  const tiles: [string, string, string?][] = [
    ["Chiffre d'affaires TTC (payé)", fcfa(k.revenue), `${k.paidOrders} commande${k.paidOrders > 1 ? "s" : ""} payée${k.paidOrders > 1 ? "s" : ""} sur ${k.orders}`],
    ["Chiffre d'affaires HT hors livraison", fcfa(k.revenueExclTax)],
    ["Coût ateliers (HT)", fcfa(k.vendorCost)],
    ["Marge brute", fcfa(k.grossMargin), `Taux : ${pct(k.marginRate)}${k.unassignedPaid ? ` · ${k.unassignedPaid} commande(s) payée(s) sans atelier : marge provisoire` : ""}`],
    ["Expédiées dans le délai", pct(k.onTimeRate), `${k.onTime} sur ${k.shipped} expédiée${k.shipped > 1 ? "s" : ""}`],
    ["Commandes en retard (en cours)", String(k.lateOpen)],
    ["Délai moyen commande → expédition", k.avgLeadHours === null ? "—" : `${Math.round(k.avgLeadHours / 24 * 10) / 10} j`],
    ["Taux de BAT refusés", pct(k.proofRefusalRate), `${k.proofsRefused} sur ${k.proofs} décisions · objectif < 10 %`],
    ["Litiges ouverts", String(openDisputes ?? 0)],
    ...(canModerate ? [["Signalements à modérer", String(openReports ?? 0)] as [string, string]] : []),
  ];
  return (
    <div className="grid gap-6">
      <PageHeader title="Tableau de bord" back={{ href: "/admin", label: "Administration" }} />
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Période">
        {Object.entries(PERIODS).map(([d, l]) => (
          <Link key={d} href={`/admin/tableau-de-bord?jours=${d}`} aria-current={Number(d) === days ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 ${Number(d) === days ? "bg-brun text-ivoire" : "border border-line"}`}>{l}</Link>
        ))}
      </nav>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="grid gap-1 rounded-lg border border-line bg-surface p-4">
            <span className="text-sm text-muted">{label}</span>
            <b className="text-2xl tabular-nums">{value}</b>
            {hint && <span className="text-xs text-muted">{hint}</span>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">Commandes créées sur la période. Marge brute = chiffre d&apos;affaires HT hors livraison − coût des ateliers affectés (avant frais de paiement, litiges et remboursements). Critères du pilote : livraison dans le délai ≥ 90 %, BAT refusés &lt; 10 %, marge réelle à ±20 % de la simulation.</p>
    </div>
  );
}
