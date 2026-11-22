import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Empty, PageHeader, inputClass } from "@/components/ui";
import { requirePlatformRole } from "@/lib/auth";
import { DISPUTE_REASON, DISPUTE_RESOLUTION, DISPUTE_STATUS } from "@/lib/disputes";
import { READ_FAILED, logError } from "@/lib/log";
import { fcfa } from "@/lib/orders";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveDispute } from "./actions";

export const metadata = { title: "Litiges" };

export default async function Disputes({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { supabase } = await requirePlatformRole(["ops", "support", "finance"], "/admin/litiges");
  const { vue } = await searchParams;
  const open = vue !== "traites";
  let q = supabase.from("disputes").select("id, order_id, reason, description, photos, status, resolution, refund_amount, vendor_liable, penalty_amount, resolution_note, created_at, order:orders(number, total, fulfillments(qc_photos, vendor:organizations(name)))")
    .order("created_at", { ascending: open }).limit(200);
  q = open ? q.eq("status", "open") : q.neq("status", "open");
  const { data, error } = await q;
  if (error) logError("disputes_read_failed", error);
  // customer photos (private folder) and workshop QC photos: short signed links for the team
  const db = createServiceClient();
  const sign = async (bucket: string, paths: string[]) => {
    if (!paths.length) return {} as Record<string, string>;
    const { data: s } = await db.storage.from(bucket).createSignedUrls(paths, 3600);
    return Object.fromEntries((s ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path!, x.signedUrl]));
  };
  type Row = { id: string; order_id: string; reason: string; description: string; photos: string[]; status: string; resolution: string | null; refund_amount: number | null; vendor_liable: boolean; penalty_amount: number | null; resolution_note: string; created_at: string;
    order: { number: string; total: number; fulfillments: { qc_photos: string[]; vendor: { name: string } | null }[] } | null };
  const rows = (data ?? []) as unknown as Row[];
  const customerPhotos = await sign("design-assets", rows.flatMap((r) => r.photos));
  const qcPhotos = await sign("qc-photos", rows.flatMap((r) => r.order?.fulfillments[0]?.qc_photos ?? []));
  return (
    <div className="grid gap-6">
      <PageHeader title="Litiges et reprises" back={{ href: "/admin", label: "Administration" }} />
      <p className="max-w-3xl text-sm text-muted">Comparez les photos du client aux photos de contrôle de l&apos;atelier. Une faute de l&apos;atelier inscrit une pénalité à son grand livre. Le remboursement est noté ici et versé par la finance (paiement en ligne : étape E13).</p>
      <nav className="flex gap-2 text-sm">
        <Link href="/admin/litiges" className={`rounded-full px-3 py-1.5 ${open ? "bg-brun text-ivoire" : "border border-line"}`}>À traiter</Link>
        <Link href="/admin/litiges?vue=traites" className={`rounded-full px-3 py-1.5 ${!open ? "bg-brun text-ivoire" : "border border-line"}`}>Traités</Link>
      </nav>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {rows.length === 0 && <Empty>{open ? "Aucun litige en cours." : "Aucun litige traité."}</Empty>}
      <ul className="grid gap-4">
        {rows.map((r) => {
          const f = r.order?.fulfillments[0];
          return (
            <li key={r.id} className="grid gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <b>{DISPUTE_REASON[r.reason] ?? r.reason}</b>
                <Link className="underline" href={`/admin/commandes/${r.order_id}`}>{r.order?.number}</Link>
                <span className="text-muted">{f?.vendor?.name ?? "sans atelier"} · {r.order ? fcfa(r.order.total) : ""} · {new Date(r.created_at).toLocaleDateString("fr-SN")}</span>
                <span className="ml-auto rounded-full bg-sable px-2 py-0.5 text-xs font-bold">{DISPUTE_STATUS[r.status] ?? r.status}</span>
              </div>
              <p className="whitespace-pre-line">« {r.description} »</p>
              <div className="flex flex-wrap gap-4">
                {r.photos.length > 0 && <span>Photos client : {r.photos.map((p, i) => customerPhotos[p] ? <a key={p} className="ml-1 underline" href={customerPhotos[p]} target="_blank" rel="noreferrer">{i + 1}</a> : null)}</span>}
                {(f?.qc_photos.length ?? 0) > 0 && <span>Photos de contrôle atelier : {f!.qc_photos.map((p, i) => qcPhotos[p] ? <a key={p} className="ml-1 underline" href={qcPhotos[p]} target="_blank" rel="noreferrer">{i + 1}</a> : null)}</span>}
              </div>
              {r.status === "open" ? (
                <ActionForm action={resolveDispute.bind(null, r.id)} submitLabel="Enregistrer la décision" className="grid gap-2 sm:grid-cols-2">
                  <select name="status" className={inputClass} aria-label="Statut"><option value="resolved">Litige fondé</option><option value="rejected">Non retenu</option></select>
                  <select name="resolution" className={inputClass} aria-label="Décision">{Object.entries(DISPUTE_RESOLUTION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <input name="refund" inputMode="numeric" className={inputClass} placeholder="Remboursement partiel (FCFA)" aria-label="Remboursement (FCFA)" />
                  <label className="flex items-center gap-2"><input type="checkbox" name="vendor_liable" /> Faute de l&apos;atelier</label>
                  <input name="penalty" inputMode="numeric" className={inputClass} placeholder="Pénalité atelier (FCFA)" aria-label="Pénalité (FCFA)" />
                  <textarea name="note" required minLength={5} rows={2} className={`${inputClass} sm:col-span-2`} placeholder="Explication pour le client" aria-label="Explication" />
                </ActionForm>
              ) : (
                <p className="text-muted">{r.resolution ? DISPUTE_RESOLUTION[r.resolution] : "—"}{r.refund_amount ? ` · ${fcfa(r.refund_amount)} remboursés` : ""}{r.vendor_liable ? ` · pénalité atelier ${fcfa(r.penalty_amount ?? 0)}` : ""} — {r.resolution_note}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
