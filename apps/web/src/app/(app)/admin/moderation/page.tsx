import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Empty, PageHeader, inputClass } from "@/components/ui";
import { requirePlatformRole } from "@/lib/auth";
import { READ_FAILED, logError } from "@/lib/log";
import { REPORT_REASONS, isReportReason } from "@/lib/report-reasons";
import { resolveReport } from "./actions";

export const metadata = { title: "Modération" };

const ROLE = { customer: "client", vendor: "atelier", staff: "équipe" } as Record<string, string>;

export default async function Moderation({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { supabase } = await requirePlatformRole(["ops", "support"], "/admin/moderation");
  const { vue } = await searchParams;
  const open = vue !== "traites";
  let q = supabase.from("content_reports").select("id, target_type, target_id, reporter_role, reason, details, status, resolution_note, created_at, resolved_at").order("created_at", { ascending: !open }).limit(200);
  q = open ? q.eq("status", "open") : q.neq("status", "open");
  const { data, error } = await q;
  if (error) logError("moderation_read_failed", error);
  const templateIds = (data ?? []).filter((r) => r.target_type === "template").map((r) => r.target_id as string);
  const orderIds = (data ?? []).filter((r) => r.target_type === "order").map((r) => r.target_id as string);
  const [{ data: templates }, { data: orders }] = await Promise.all([
    templateIds.length ? supabase.from("templates").select("id, title, status, product:base_products(slug), slug").in("id", templateIds) : Promise.resolve({ data: [] }),
    orderIds.length ? supabase.from("orders").select("id, number").in("id", orderIds) : Promise.resolve({ data: [] }),
  ]);
  const target = (r: { target_type: string; target_id: string }) => {
    if (r.target_type === "template") {
      const t = (templates ?? []).find((x) => x.id === r.target_id) as { title: string; status: string; slug: string; product: { slug: string } | null } | undefined;
      return t ? <>Modèle <Link className="underline" href={`/studio/${t.product?.slug}?modele=${t.slug}`}>{t.title}</Link> ({t.status})</> : "Modèle retiré de la galerie";
    }
    const o = (orders ?? []).find((x) => x.id === r.target_id) as { id: string; number: string } | undefined;
    return o ? <>Commande <Link className="underline" href={`/admin/commandes/${o.id}`}>{o.number}</Link></> : "Commande";
  };
  return (
    <div className="grid gap-6">
      <PageHeader title="Modération des contenus" back={{ href: "/admin", label: "Administration" }} />
      <p className="max-w-3xl text-sm text-muted">Signalements des ateliers et des clients. Retenir un signalement retire un modèle de la galerie, ou met en pause la production d&apos;une commande (contactez ensuite le client : correction ou remboursement). Objectif : traiter sous 48 h.</p>
      <nav className="flex gap-2 text-sm">
        <Link href="/admin/moderation" className={`rounded-full px-3 py-1.5 ${open ? "bg-brun text-ivoire" : "border border-line"}`}>À traiter</Link>
        <Link href="/admin/moderation?vue=traites" className={`rounded-full px-3 py-1.5 ${!open ? "bg-brun text-ivoire" : "border border-line"}`}>Traités</Link>
      </nav>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data?.length === 0 && <Empty>{open ? "Aucun signalement à traiter." : "Aucun signalement traité."}</Empty>}
      <ul className="grid gap-3">
        {(data ?? []).map((r) => (
          <li key={r.id} className="grid gap-2 rounded-xl border border-line bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <b>{isReportReason(r.reason) ? REPORT_REASONS[r.reason] : r.reason}</b>
              <span className="text-muted">par {ROLE[r.reporter_role] ?? r.reporter_role} · {new Date(r.created_at).toLocaleString("fr-SN", { dateStyle: "short", timeStyle: "short" })}</span>
              {r.status === "open" && Date.now() - Date.parse(r.created_at) > 48 * 3600 * 1000 && <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-bold text-error">+48 h</span>}
            </div>
            <div>{target(r)}</div>
            {r.details && <p className="whitespace-pre-line">« {r.details} »</p>}
            {r.status === "open" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <ActionForm action={resolveReport.bind(null, r.id, "upheld")} submitLabel="Retenir">
                  <input name="note" required minLength={3} className={inputClass} placeholder="Décision (ex. : logo d'une marque déposée)" aria-label="Décision" />
                </ActionForm>
                <ActionForm action={resolveReport.bind(null, r.id, "dismissed")} submitLabel="Classer sans suite" variant="secondary">
                  <input name="note" required minLength={3} className={inputClass} placeholder="Raison (ex. : logo du client lui-même)" aria-label="Raison" />
                </ActionForm>
              </div>
            ) : <p className="text-muted">{r.status === "upheld" ? "Retenu" : "Classé sans suite"} : {r.resolution_note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
