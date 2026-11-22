import { RosterList } from "@/components/roster-list";
import type { RosterEntry } from "@sawwa/design";
import { notFound } from "next/navigation";
import { hasPlatformRole, requirePlatformRole } from "@/lib/auth";
import { candidateVendors } from "@/lib/assignment";
import { EVENT_LABEL, STATUS_LABEL } from "@/lib/fulfillment";
import { dateTime, fcfa, loadVersions, readDoc, signedDesignUrls, zoneList, type ZoneRow } from "@/lib/orders";
import { VersionHistory } from "@/components/version-history";
import { DELIVERY_OPTIONS, isDeliveryKey } from "@/lib/shipping";
import { createServiceClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { DesignPreview } from "@/components/design-preview";
import { Field, PageHeader, Section, fr, inputClass } from "@/components/ui";
import { adminEvent, assignVendor, confirmPayment } from "../actions";

export const metadata = { title: "Commande" };

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, memberships } = await requirePlatformRole(["ops", "support", "finance"], `/admin/commandes/${id}`);
  const isOps = hasPlatformRole(memberships, ["ops"]);
  const isFinance = hasPlatformRole(memberships, ["finance"]);
  const { data: o } = await supabase
    .from("orders")
    .select("id, number, payment_status, payment_reference, subtotal, shipping, tax, total, deposit_due, shipping_address, created_at, quote_snapshot, items:order_items(id, design_version_id, color_key, sizes, quantity, roster, unit_price, decorations, version:design_versions(document, sha256), product:base_products(name, variants:base_product_variants(color_key, color_hex), zones(key, anchor, max_width_mm, max_height_mm))), fulfillments(id, status, vendor_cost, sla_due_at, qc_photos, carrier, tracking_number, vendor:organizations(name)), events:status_events(event, actor_role, payload, at)")
    .eq("id", id).maybeSingle();
  if (!o) notFound();
  const item = (o.items as unknown as { id: string; design_version_id: string; color_key: string; sizes: Record<string, number>; quantity: number; roster: RosterEntry[] | null; unit_price: number; decorations: { zoneKey: string; technique: string; widthMm: number; heightMm: number }[]; version: { document: unknown; sha256: string } | null; product: { name: unknown; variants: { color_key: string; color_hex: string }[]; zones: ZoneRow[] } }[])[0];
  const f = (o.fulfillments as unknown as { id: string; status: string; vendor_cost: number | null; sla_due_at: string | null; qc_photos: string[]; carrier: string | null; tracking_number: string | null; vendor: { name: string } | null }[])[0];
  const events = ((o.events ?? []) as { event: string; actor_role: string; payload: Record<string, string>; at: string }[]).sort((a, b) => a.at.localeCompare(b.at));
  const doc = item?.version ? readDoc(item.version.document) : null;
  const db = createServiceClient();
  const urls = doc ? await signedDesignUrls(db, doc) : {};
  const qcUrls = f?.qc_photos.length ? ((await db.storage.from("qc-photos").createSignedUrls(f.qc_photos, 3600)).data ?? []).flatMap((x) => (x.signedUrl ? [x.signedUrl] : [])) : [];
  const address = o.shipping_address as Record<string, string>;
  const history = item ? await loadVersions(supabase, item.id, db) : { versions: [], urls: {} };
  const surchargeDue = history.versions.reduce((n, v) => n + v.surcharge, 0);
  const candidates = isOps && f?.status === "pending_assignment" && o.payment_status === "paid" ? await candidateVendors(o.id) : [];

  return (
    <div className="grid gap-6">
      <PageHeader title={`Commande ${o.number}`} back={{ href: "/admin/commandes", label: "Commandes" }}>
        <span className="rounded-full bg-brun px-3 py-1 text-sm font-bold text-ivoire">{o.payment_status === "awaiting_payment" ? "Paiement attendu" : f ? STATUS_LABEL[f.status] : ""}</span>
      </PageHeader>

      {o.payment_status === "awaiting_payment" && isFinance && (
        <Section title={`Encaisser ${fcfa(o.deposit_due ?? o.total)}${o.deposit_due ? " (acompte)" : ""}`} id="pay">
          <p className="text-sm text-muted">Pilote : confirmation manuelle après réception du paiement Wave, Orange Money ou virement. Le branchement de l&apos;agrégateur rendra cette étape automatique.</p>
          <ActionForm action={confirmPayment.bind(null, o.id)} submitLabel="Confirmer le paiement" className="flex flex-wrap items-end gap-3">
            <Field label="Référence de la transaction" htmlFor="reference"><input id="reference" name="reference" required className={inputClass} /></Field>
          </ActionForm>
        </Section>
      )}

      {candidates.length > 0 && f && (
        <Section title="Affecter à un atelier" id="assign">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted"><th className="p-2">Atelier</th><th className="p-2 text-right">Coût atelier</th><th className="p-2 text-right">Marge SAWWA (HT)</th><th className="p-2">Délai</th><th className="p-2" /></tr></thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.vendorId} className="border-b border-line">
                    <td className="p-2 font-semibold">{c.name}</td>
                    <td className="p-2 text-right tabular-nums">{c.vendorCost === null ? "ne peut pas produire" : fcfa(c.vendorCost)}</td>
                    <td className={`p-2 text-right tabular-nums ${c.margin !== null && c.margin < 0 ? "font-bold text-error" : ""}`}>{c.margin === null ? "—" : fcfa(c.margin)}</td>
                    <td className="p-2">{c.leadTimeDays} j</td>
                    <td className="p-2">{c.vendorCost !== null && <ActionForm action={assignVendor.bind(null, o.id, f.id, c.vendorId)} submitLabel="Affecter" pendingLabel="…" className="contents" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-6">
          <Section title={item ? `${fr(item.product.name)} · ${item.color_key.replace(/_/g, " ")}` : "Article"} id="design">
            {doc && item && <DesignPreview doc={doc} zones={zoneList(item.product.zones)} urls={urls} garmentHex={item.product.variants.find((v) => v.color_key === item.color_key)?.color_hex ?? "#F2E9D8"} />}
            {item && (
              <ul className="grid gap-1 text-sm">
                <li>Tailles : {Object.entries(item.sizes).map(([s, n]) => `${s} × ${n}`).join(" · ")} ({item.quantity} pc)</li>
                {(o.quote_snapshot as { b2bQuoteId?: string; b2bQuoteVersion?: number } | null)?.b2bQuoteId && <li>Prix du devis B2B (version {(o.quote_snapshot as { b2bQuoteVersion?: number }).b2bQuoteVersion}), figé à la commande</li>}
                {item.roster?.length ? <li><RosterList roster={item.roster} /></li> : null}
                {item.decorations.map((d) => <li key={d.zoneKey}>{d.zoneKey} · {d.technique} · {d.widthMm / 10} × {d.heightMm / 10} cm</li>)}
                {item.version && <li className="text-xs text-muted">Version figée · empreinte {item.version.sha256.slice(0, 12)}</li>}
              </ul>
            )}
            {item && history.versions.length > 1 && (
              <VersionHistory versions={history.versions} currentId={item.design_version_id} zones={zoneList(item.product.zones)} urls={history.urls} garmentHex={item.product.variants.find((v) => v.color_key === item.color_key)?.color_hex ?? "#F2E9D8"} />
            )}
          </Section>
          {qcUrls.length > 0 && (
            <Section title="Photos de contrôle qualité" id="qc">
              <div className="grid grid-cols-2 gap-3">{qcUrls.map((u) => <img key={u} src={u} alt="Photo du produit fini" className="rounded-lg" />)}</div>
            </Section>
          )}
        </div>
        <div className="grid content-start gap-6">
          <Section title="Montants" id="amounts">
            <dl className="grid grid-cols-[1fr_auto] gap-1 text-sm tabular-nums">
              <dt>Articles TTC</dt><dd>{fcfa(o.subtotal)}</dd>
              <dt>Livraison</dt><dd>{fcfa(o.shipping)}</dd>
              <dt className="font-bold">Total TTC</dt><dd className="font-bold">{fcfa(o.total)}</dd>
              <dt className="text-muted">TVA</dt><dd className="text-muted">{fcfa(o.tax)}</dd>
              {f?.vendor_cost != null && (<><dt>Coût atelier figé</dt><dd>{fcfa(f.vendor_cost)}</dd></>)}
              {o.payment_reference && (<><dt>Référence paiement</dt><dd>{o.payment_reference}</dd></>)}
              {surchargeDue > 0 && (<><dt className="font-bold text-terra-700">Supplément accepté après correction</dt><dd className="font-bold text-terra-700">{fcfa(surchargeDue)}</dd></>)}
            </dl>
          </Section>
          <Section title="Client et livraison" id="client">
            <p className="text-sm">{address.name} · {address.phone}<br />{[address.district, address.landmark, address.city].filter(Boolean).join(", ")}<br />{isDeliveryKey(address.delivery ?? "") ? DELIVERY_OPTIONS[address.delivery as keyof typeof DELIVERY_OPTIONS].label : ""}</p>
            {f?.vendor && <p className="text-sm">Atelier : <b>{f.vendor.name}</b>{f.sla_due_at ? ` · échéance ${dateTime(f.sla_due_at)}` : ""}</p>}
            {f?.tracking_number && <p className="text-sm">Expédition : {f.carrier} · {f.tracking_number}</p>}
          </Section>
          {isOps && f && !["delivered", "cancelled"].includes(f.status) && (
            <Section title="Interventions" id="ops">
              {f.status === "shipped" && <ActionForm action={adminEvent.bind(null, o.id, f.id, "confirm_delivery")} submitLabel="Confirmer la livraison" />}
              {f.status === "on_hold" ? <ActionForm action={adminEvent.bind(null, o.id, f.id, "resume")} submitLabel="Reprendre" /> : (
                <ActionForm action={adminEvent.bind(null, o.id, f.id, "hold")} submitLabel="Mettre en pause" variant="secondary" className="flex flex-wrap items-end gap-2">
                  <input name="reason" placeholder="Motif" aria-label="Motif de la pause" className={`${inputClass} max-w-xs`} />
                </ActionForm>
              )}
              {f.status !== "shipped" && (
                <ActionForm action={adminEvent.bind(null, o.id, f.id, "cancel")} submitLabel="Annuler la commande" variant="secondary" className="flex flex-wrap items-end gap-2">
                  <input name="reason" placeholder="Motif (visible dans l'historique)" aria-label="Motif d'annulation" className={`${inputClass} max-w-xs`} />
                </ActionForm>
              )}
            </Section>
          )}
          <Section title="Historique" id="history">
            <ol className="grid gap-2 text-sm">
              {events.map((e, i) => (
                <li key={i} className="grid gap-0.5 border-l-2 border-ocre pl-3">
                  <b>{EVENT_LABEL[e.event] ?? e.event} <span className="font-normal text-muted">· {e.actor_role}</span></b>
                  {(e.payload.comment || e.payload.reason) && <span>{e.payload.comment ?? e.payload.reason}</span>}
                  <span className="text-xs text-muted">{dateTime(e.at)}</span>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
