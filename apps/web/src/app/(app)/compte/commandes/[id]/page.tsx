import { DisputeForm } from "./dispute-form";
import { openDispute } from "../actions";
import { DISPUTE_REASON, DISPUTE_RESOLUTION, DISPUTE_STATUS } from "@/lib/disputes";
import { RosterList } from "@/components/roster-list";
import type { RosterEntry } from "@sawwa/design";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { EVENT_LABEL, REASON_LABEL, STATUS_LABEL } from "@/lib/fulfillment";
import Link from "next/link";
import { dateTime, fcfa, loadVersions, readDoc, signedDesignUrls, zoneList, type ZoneRow } from "@/lib/orders";
import { VersionHistory } from "@/components/version-history";
import { DELIVERY_OPTIONS, isDeliveryKey } from "@/lib/shipping";
import { ActionForm } from "@/components/action-form";
import { DesignPreview } from "@/components/design-preview";
import { PageHeader, Section, fr } from "@/components/ui";
import { answerCorrection } from "../actions";

export const metadata = { title: "Ma commande" };

const STEPS = ["pending_assignment", "proof_review", "proof_approved", "in_production", "shipped", "delivered"];

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser(`/compte/commandes/${id}`);
  const { data: o } = await supabase
    .from("orders")
    .select("id, number, payment_status, subtotal, shipping, tax, total, deposit_due, shipping_address, created_at, items:order_items(id, color_key, sizes, quantity, roster, unit_price, line_total, design_version_id, version:design_versions(document), product:base_products(slug, name, variants:base_product_variants(color_key, color_hex), zones(key, anchor, max_width_mm, max_height_mm))), fulfillments(id, status, carrier, tracking_number), events:status_events(event, payload, at)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const { data: disputeRows } = await supabase.from("disputes").select("id, reason, description, status, resolution, refund_amount, resolution_note, created_at").eq("order_id", o.id).order("created_at");
  const disputes = (disputeRows ?? []) as { id: string; reason: string; description: string; status: string; resolution: string | null; refund_amount: number | null; resolution_note: string }[];
  const item = (o.items as unknown as { id: string; design_version_id: string; color_key: string; sizes: Record<string, number>; quantity: number; roster: RosterEntry[] | null; unit_price: number; line_total: number; version: { document: unknown }; product: { slug: string; name: unknown; variants: { color_key: string; color_hex: string }[]; zones: ZoneRow[] } }[])[0];
  const f = (o.fulfillments as { id: string; status: string; carrier: string | null; tracking_number: string | null }[])[0];
  const events = ((o.events ?? []) as { event: string; payload: { comment?: string; reason?: string }; at: string }[]).sort((a, b) => a.at.localeCompare(b.at));
  const doc = item ? readDoc(item.version.document) : null;
  const urls = doc ? await signedDesignUrls(supabase, doc) : {};
  const history = item ? await loadVersions(supabase, item.id) : { versions: [], urls: {} };
  const garment = item?.product.variants.find((v) => v.color_key === item.color_key)?.color_hex ?? "#F2E9D8";
  const address = o.shipping_address as { name: string; phone: string; district: string; landmark: string; city: string; delivery: string };
  const lastChange = [...events].reverse().find((e) => e.event === "request_changes");
  const reached = f ? Math.max(0, STEPS.indexOf(f.status === "assigned" ? "pending_assignment" : f.status === "changes_requested" ? "proof_review" : f.status === "quality_check" ? "in_production" : f.status)) : 0;

  return (
    <div className="grid gap-6">
      <PageHeader title={`Commande ${o.number}`} back={{ href: "/compte/commandes", label: "Mes commandes" }}>
        <span className="rounded-full bg-brun px-3 py-1 text-sm font-bold text-ivoire">{o.payment_status === "awaiting_payment" ? "Paiement attendu" : f ? STATUS_LABEL[f.status] : ""}</span>
      </PageHeader>

      {o.payment_status === "awaiting_payment" && (
        <div className="grid gap-2 rounded-2xl bg-terra p-5 text-ivoire">
          <b className="display text-2xl">Dernière étape : le paiement</b>
          <p>Montant à régler : <b>{fcfa(o.deposit_due ?? o.total)}</b>{o.deposit_due ? ` (acompte de 50 %, solde de ${fcfa(o.total - o.deposit_due)} avant l'expédition)` : ""}.</p>
          <p className="text-sm text-ivoire/85">L&apos;équipe SAWWA vous contacte sur WhatsApp au {address.phone} avec les instructions Wave, Orange Money ou virement. Indiquez la référence <b>{o.number}</b>. La production démarre dès la confirmation du paiement.</p>
        </div>
      )}

      {(f?.status === "shipped" || f?.status === "delivered" || disputes.length > 0) && (
        <Section title="Un problème avec votre commande ?" id="litige">
          {disputes.map((d) => (
            <div key={d.id} className="grid gap-1 rounded-lg border border-line p-3 text-sm">
              <b>{DISPUTE_REASON[d.reason] ?? d.reason} · {DISPUTE_STATUS[d.status] ?? d.status}</b>
              <span className="whitespace-pre-line">{d.description}</span>
              {d.status !== "open" && <span>Décision : {d.resolution ? DISPUTE_RESOLUTION[d.resolution] : "—"}{d.refund_amount ? ` (${fcfa(d.refund_amount)})` : ""}{d.resolution_note ? ` — ${d.resolution_note}` : ""}</span>}
            </div>
          ))}
          {(f?.status === "shipped" || f?.status === "delivered") && !disputes.some((d) => d.status === "open") && (
            <DisputeForm userId={user.id} action={openDispute.bind(null, o.id)} />
          )}
        </Section>
      )}

      {f?.status === "changes_requested" && (
        <Section title="L'atelier demande une correction" id="correction">
          {lastChange && <p className="rounded-lg bg-ocre/20 p-3">{lastChange.payload.reason && REASON_LABEL[lastChange.payload.reason] ? <b className="block">{REASON_LABEL[lastChange.payload.reason]}</b> : null}« {lastChange.payload.comment} »</p>}
          {lastChange?.payload.reason && ["trademark", "protected_character", "prohibited_content"].includes(lastChange.payload.reason) && (
            <p className="text-sm">SAWWA et ses ateliers n&apos;impriment pas de marque, de personnage ou d&apos;œuvre protégés sans autorisation de leur titulaire. Remplacez l&apos;élément concerné, ou annulez pour être remboursé.</p>
          )}
          <p className="text-sm text-muted">Corrigez votre création dans le studio et renvoyez-la à l&apos;atelier, faites produire telle quelle, ou annulez pour être remboursé.</p>
          <div className="flex flex-wrap gap-3">
            {item && <Link href={`/studio/${item.product.slug}?commande=${o.id}`} className="btn btn-brun !py-2 text-sm">Corriger ma création</Link>}
            <ActionForm action={answerCorrection.bind(null, f.id, "accept_as_is")} submitLabel="Produire telle quelle" className="contents" />
            <ActionForm action={answerCorrection.bind(null, f.id, "cancel")} submitLabel="Annuler la commande" variant="secondary" className="contents" />
          </div>
        </Section>
      )}

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-6" aria-label="Avancement">
        {STEPS.map((s, i) => (
          <li key={s} className={`rounded-lg px-3 py-2 text-xs font-bold ${i <= reached && o.payment_status !== "awaiting_payment" ? "bg-brun text-ivoire" : "bg-sable text-muted"}`}>{STATUS_LABEL[s]}</li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section title={item ? `${fr(item.product.name)} · ${item.color_key.replace(/_/g, " ")}` : "Article"} id="design">
          {doc && item && <DesignPreview doc={doc} zones={zoneList(item.product.zones)} urls={urls} garmentHex={item.product.variants.find((v) => v.color_key === item.color_key)?.color_hex ?? "#F2E9D8"} />}
          {item && history.versions.length > 1 && (
            <div className="grid gap-2"><h3 className="font-bold">Versions de votre création</h3>
              <VersionHistory versions={history.versions} currentId={item.design_version_id} zones={zoneList(item.product.zones)} urls={history.urls} garmentHex={garment} />
            </div>
          )}
          {item && <p className="text-sm">Tailles : {Object.entries(item.sizes).map(([s, n]) => `${s} × ${n}`).join(" · ")}</p>}
          {item && <RosterList roster={item.roster} />}
        </Section>
        <div className="grid content-start gap-6">
          <Section title="Montant" id="amount">
            <dl className="grid grid-cols-[1fr_auto] gap-1 text-sm tabular-nums">
              <dt>Articles ({item?.quantity} pc)</dt><dd>{fcfa(o.subtotal)}</dd>
              <dt>Livraison</dt><dd>{o.shipping ? fcfa(o.shipping) : "gratuite"}</dd>
              <dt className="font-bold">Total TTC</dt><dd className="font-bold">{fcfa(o.total)}</dd>
              <dt className="text-muted">dont TVA</dt><dd className="text-muted">{fcfa(o.tax)}</dd>
            </dl>
          </Section>
          <Section title="Livraison" id="delivery">
            <p className="text-sm">{isDeliveryKey(address.delivery) ? DELIVERY_OPTIONS[address.delivery].label : ""}<br />{address.name} · {address.phone}<br />{[address.district, address.landmark, address.city].filter(Boolean).join(", ")}</p>
            {f?.tracking_number && <p className="text-sm">Expédiée avec {f.carrier} — suivi {f.tracking_number}</p>}
          </Section>
          <Section title="Historique" id="history">
            <ol className="grid gap-2 text-sm">
              {events.map((e, i) => (
                <li key={i} className="grid gap-0.5 border-l-2 border-ocre pl-3">
                  <b>{EVENT_LABEL[e.event] ?? e.event}</b>
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
