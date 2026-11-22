import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { EVENT_LABEL, STATUS_LABEL } from "@/lib/fulfillment";
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
  const { supabase } = await requireUser(`/compte/commandes/${id}`);
  const { data: o } = await supabase
    .from("orders")
    .select("id, number, payment_status, subtotal, shipping, tax, total, deposit_due, shipping_address, created_at, items:order_items(id, color_key, sizes, quantity, unit_price, line_total, design_version_id, version:design_versions(document), product:base_products(slug, name, variants:base_product_variants(color_key, color_hex), zones(key, anchor, max_width_mm, max_height_mm))), fulfillments(id, status, carrier, tracking_number), events:status_events(event, payload, at)")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const item = (o.items as unknown as { id: string; design_version_id: string; color_key: string; sizes: Record<string, number>; quantity: number; unit_price: number; line_total: number; version: { document: unknown }; product: { slug: string; name: unknown; variants: { color_key: string; color_hex: string }[]; zones: ZoneRow[] } }[])[0];
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

      {f?.status === "changes_requested" && (
        <Section title="L'atelier demande une correction" id="correction">
          {lastChange && <p className="rounded-lg bg-ocre/20 p-3">« {lastChange.payload.comment} »</p>}
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
