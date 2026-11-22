import { notFound, redirect } from "next/navigation";
import { layerBox, unionBox, visibleLayers, type RosterEntry } from "@sawwa/design";
import { TECHNIQUE_LABEL, type Technique } from "@sawwa/catalog";
import { requireUser, vendorMembership } from "@/lib/auth";
import { EVENT_LABEL, REASON_LABEL, STATUS_LABEL } from "@/lib/fulfillment";
import { dateTime, loadVersions, readDoc, signedDesignUrls, zoneList, type ZoneRow } from "@/lib/orders";
import { VersionHistory } from "@/components/version-history";
import { createServiceClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { DesignPreview } from "@/components/design-preview";
import { PageHeader, Section, fr, inputClass } from "@/components/ui";
import { vendorEvent } from "../actions";
import { QcUpload } from "./qc-upload";
import { patternOf } from "@/lib/pattern-zone";
import { reportContent } from "@/app/(vitrine)/signaler/actions";
import { REPORT_REASONS } from "@/lib/report-reasons";

export const metadata = { title: "Fiche de production" };

const REASONS = (["low_resolution", "outside_zone", "too_many_colors", "too_fine", "file_format", "trademark", "protected_character", "prohibited_content", "other"] as const).map((k) => [k, REASON_LABEL[k]!] as const);

function ReasonFields() {
  return (
    <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
      <select name="reason" aria-label="Motif" className={inputClass}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input name="comment" required placeholder="Expliquez au client ce qu'il faut changer" aria-label="Commentaire" className={inputClass} />
    </div>
  );
}

export default async function ProductionSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, memberships } = await requireUser(`/pro/commandes/${id}`);
  const vendor = vendorMembership(memberships);
  if (!vendor || vendor.organization.status !== "active") redirect("/pro");
  // E21: the amount paid to the workshop is for the owner and managers, not operators
  const canSeeAmount = vendor.role === "owner" || vendor.role === "manager";
  // RLS: only the assigned workshop can read this fulfillment and its items.
  const { data: f } = await supabase
    .from("fulfillments")
    .select("id, status, sla_due_at, proof_round, carrier, tracking_number, order_id, items:order_items(id, design_version_id, color_key, sizes, quantity, decorations, roster, version:design_versions(document, sha256), product:base_products(name, variants:base_product_variants(color_key, color_hex), zones(key, anchor, max_width_mm, max_height_mm))), events:status_events(event, payload, at)")
    .eq("id", id).eq("vendor_id", vendor.organization.id).maybeSingle();
  if (!f) notFound();
  const zoneOf = (key: string) => (f.items as unknown as { product: { zones: { key: string; anchor: unknown }[] } }[])[0]?.product.zones.find((z) => z.key === key);
  const vendorAmount = canSeeAmount
    ? ((await supabase.from("fulfillment_costs").select("vendor_cost").eq("fulfillment_id", f.id).maybeSingle()).data?.vendor_cost as number | null | undefined) ?? null
    : null;
  const item = (f.items as unknown as { id: string; design_version_id: string; color_key: string; sizes: Record<string, number>; quantity: number; roster: RosterEntry[] | null; decorations: { zoneKey: string; technique: Technique; widthMm: number; heightMm: number; colors: number }[]; version: { document: unknown; sha256: string }; product: { name: unknown; variants: { color_key: string; color_hex: string }[]; zones: (ZoneRow & { anchor: { label?: string; note?: string } | null })[] } }[])[0];
  // a pair of sleeves is priced as two decorations of the same zone: one entry per zone here
  const uniqueDecorations = (item?.decorations ?? []).filter((d, k, all) => all.findIndex((x) => x.zoneKey === d.zoneKey) === k);
  if (!item) notFound();
  const doc = readDoc(item.version.document);
  const urls = doc ? await signedDesignUrls(createServiceClient(), doc) : {};
  const zones = zoneList(item.product.zones);
  const history = await loadVersions(supabase, item.id, createServiceClient());
  const events = ((f.events ?? []) as { event: string; payload: Record<string, string>; at: string }[]).sort((a, b) => a.at.localeCompare(b.at));
  const hex = item.product.variants.find((v) => v.color_key === item.color_key)?.color_hex ?? "#F2E9D8";
  const images = doc ? doc.surfaces.flatMap((s) => s.layers).flatMap((l) => (l.type === "image" && urls[l.src] ? [{ name: l.name, url: urls[l.src]!, px: `${l.pxWidth} × ${l.pxHeight} px` }] : [])) : [];
  const act = (kind: Parameters<typeof vendorEvent>[1]) => vendorEvent.bind(null, f.id, kind);

  return (
    <div className="grid gap-6">
      <PageHeader title={fr(item.product.name)} back={{ href: "/pro/commandes", label: "Commandes" }}>
        <span className="rounded-full bg-brun px-3 py-1 text-sm font-bold text-ivoire">{STATUS_LABEL[f.status]}</span>
      </PageHeader>
      {f.sla_due_at && <p className="text-muted">À traiter avant le <b className="text-fg">{dateTime(f.sla_due_at)}</b></p>}

      <Section title="Action à faire" id="todo">
        {f.status === "assigned" && (
          <div className="grid gap-4">
            <ActionForm action={act("accept")} submitLabel="Prendre la commande et vérifier le fichier" />
            <details><summary className="cursor-pointer text-sm underline">Je ne peux pas la faire</summary>
              <ActionForm action={act("reject")} submitLabel="Refuser la commande" variant="secondary"><ReasonFields /></ActionForm>
            </details>
          </div>
        )}
        {f.status === "proof_review" && (
          <div className="grid gap-4">
            <p className="text-sm">Vérifiez la création ci-dessous : dimensions, position, couleurs, finesse des détails pour votre technique.</p>
            <ActionForm action={act("approve_proof")} submitLabel="Valider le BAT" />
            <ActionForm action={act("request_changes")} submitLabel="Demander une correction au client" variant="secondary"><ReasonFields /></ActionForm>
          </div>
        )}
        {f.status === "changes_requested" && <p className="text-muted">En attente de la réponse du client.</p>}
        {f.status === "proof_approved" && <ActionForm action={act("start_production")} submitLabel="Lancer la production" />}
        {f.status === "in_production" && <QcUpload vendorId={vendor.organization.id} fulfillmentId={f.id} action={act("submit_qc")} />}
        {f.status === "quality_check" && (
          <ActionForm action={act("ship")} submitLabel="Marquer comme expédiée" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input name="carrier" required placeholder="Livreur / transporteur" aria-label="Livreur ou transporteur" className={inputClass} />
            <input name="tracking" required placeholder="Référence ou n° de suivi" aria-label="Référence de suivi" className={inputClass} />
          </ActionForm>
        )}
        {["shipped", "delivered", "cancelled", "on_hold"].includes(f.status) && <p className="text-muted">{STATUS_LABEL[f.status]}.</p>}
      </Section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Section title="Création à produire" id="design">
          {doc && <DesignPreview doc={doc} zones={zones} urls={urls} garmentHex={hex} />}
          <p className="text-xs text-muted">Version figée · empreinte {item.version.sha256.slice(0, 12)} · BAT n° {f.proof_round || 1}</p>
          {history.versions.length > 1 && (
            <div className="grid gap-2"><h3 className="font-bold">Versions précédentes (pour comparer)</h3>
              <VersionHistory versions={history.versions} currentId={item.design_version_id} zones={zones} urls={history.urls} garmentHex={hex} />
            </div>
          )}
        </Section>
        <div className="grid content-start gap-6">
          <Section title="Fiche technique" id="sheet">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Couleur</dt><dd className="flex items-center gap-2"><span className="inline-block size-4 rounded-full border border-line" style={{ background: hex }} />{item.color_key.replace(/_/g, " ")}</dd>
              <dt className="text-muted">Tailles</dt><dd className="font-semibold tabular-nums">{Object.entries(item.sizes).map(([s, n]) => `${s} × ${n}`).join(" · ")} = {item.quantity} pc</dd>
              {item.roster?.length ? <><dt className="text-muted">Équipe</dt><dd>Nom et numéro différents sur chaque pièce (liste figée de {item.roster.length} pièces)</dd></> : null}
            </dl>
            <ul className="grid gap-3">
              {uniqueDecorations.map((d) => {
                const z = item.product.zones.find((x) => x.key === d.zoneKey);
                const s = doc?.surfaces.find((x) => x.zoneKey === d.zoneKey);
                const box = s ? unionBox(visibleLayers(s).map(layerBox)) : null;
                return (
                  <li key={d.zoneKey} className="grid gap-1 rounded-lg border border-line p-3 text-sm">
                    <b>{z?.anchor?.label ?? d.zoneKey} · {TECHNIQUE_LABEL[d.technique] ?? d.technique}</b>
                    <span className="tabular-nums">Marquage {(d.widthMm / 10).toFixed(1)} × {(d.heightMm / 10).toFixed(1)} cm{d.technique === "embroidery" || d.technique === "screen_print" ? ` · ${d.colors} couleur${d.colors > 1 ? "s" : ""}` : ""}</span>
                    {box && z && <span className="tabular-nums">Position : {(Math.max(0, box.minX) / 10).toFixed(1)} cm du bord gauche et {(Math.max(0, box.minY) / 10).toFixed(1)} cm du haut de la zone ({z.max_width_mm / 10} × {z.max_height_mm / 10} cm)</span>}
                    {z?.anchor?.note && <span className="text-muted">Repère : {z.anchor.note}</span>}
                  </li>
                );
              })}
            </ul>
            {vendorAmount != null && <p className="text-sm">Montant atelier pour cette commande : <b className="tabular-nums">{vendorAmount.toLocaleString("fr-FR")} FCFA HT</b></p>}
          </Section>
          <Section title="Fichiers de production" id="production">
            <ul className="grid gap-2 text-sm">
              <li><a className="btn btn-brun !py-2 text-sm" href={`/api/production/${f.id}?format=pdf`}>Fiche de production (PDF)</a></li>
              {uniqueDecorations.map((d) => {
                const label = item.product.zones.find((z) => z.key === d.zoneKey)?.anchor?.label ?? d.zoneKey;
                const variable = Boolean(item.roster?.length) && Boolean(doc?.surfaces.some((s) => s.zoneKey === d.zoneKey && s.layers.some((l) => l.type === "text" && l.perItem)));
                const href = (piece?: number) => `/api/production/${f.id}?format=png&zone=${encodeURIComponent(d.zoneKey)}${piece ? `&piece=${piece}` : ""}`;
                return variable ? (
                  <li key={d.zoneKey}>
                    <details>
                      <summary className="cursor-pointer underline">Fichiers d&apos;impression · {label} : un par pièce ({item.roster!.length}, PNG haute résolution)</summary>
                      <ol className="mt-2 grid max-h-80 gap-1 overflow-y-auto pl-2">
                        {item.roster!.map((e, i) => (
                          <li key={i}><a className="underline" href={href(i + 1)}>Pièce {i + 1} · {e.size}{e.number ? ` · n° ${e.number}` : ""}{e.name ? ` · ${e.name}` : ""}</a></li>
                        ))}
                      </ol>
                    </details>
                  </li>
                ) : (
                  <li key={d.zoneKey}>
                    <a className="underline" href={href()}>Fichier d&apos;impression · {label} (PNG haute résolution, taille réelle{patternOf(zoneOf(d.zoneKey)?.anchor) ? ", fond perdu compris" : " transparent"}{item.roster?.length ? ", identique sur toutes les pièces" : ""})</a>
                    {patternOf(zoneOf(d.zoneKey)?.anchor)?.mirror && <> · <a className="underline" href={`${href()}&copie=2`}>seconde pièce (miroir)</a></>}
                  </li>
                );
              })}
            </ul>
            {item.roster?.length ? <p className="text-xs text-muted">Commande d&apos;équipe : la liste complète des pièces (taille, nom, numéro), à cocher au fur et à mesure, est à la fin de la fiche PDF.</p> : null}
          </Section>
          {images.length > 0 && (
            <Section title="Fichiers originaux" id="files">
              <ul className="grid gap-2 text-sm">{images.map((i) => <li key={i.url}><a href={i.url} className="underline" target="_blank" rel="noreferrer">{i.name}</a> <span className="text-muted">· {i.px}</span></li>)}</ul>
              <p className="text-xs text-muted">Images importées par le client, en pleine résolution. Liens valables 1 heure.</p>
            </Section>
          )}
          <Section title="Droits et contenu" id="report">
            <p className="text-sm text-muted">Marque, personnage protégé, photo d&apos;une personne sans accord, contenu interdit : refusez au BAT avec le motif adapté. En cas de doute, prévenez l&apos;équipe SAWWA.</p>
            <details>
              <summary className="cursor-pointer text-sm underline">Signaler cette création à SAWWA</summary>
              <ActionForm action={reportContent.bind(null, "order", f.order_id as string)} submitLabel="Envoyer le signalement" variant="secondary">
                <select name="reason" required className={inputClass} aria-label="Motif">
                  {Object.entries(REPORT_REASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <textarea name="details" rows={2} maxLength={1000} className={inputClass} placeholder="Ce que vous avez remarqué" aria-label="Détails" />
              </ActionForm>
            </details>
          </Section>
          <Section title="Historique" id="history">
            <ol className="grid gap-2 text-sm">
              {events.filter((e) => e.event !== "order_placed" && e.event !== "payment_confirmed").map((e, i) => (
                <li key={i} className="grid gap-0.5 border-l-2 border-ocre pl-3"><b>{EVENT_LABEL[e.event] ?? e.event}</b>{e.payload.comment && <span>{e.payload.comment}</span>}<span className="text-xs text-muted">{dateTime(e.at)}</span></li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
