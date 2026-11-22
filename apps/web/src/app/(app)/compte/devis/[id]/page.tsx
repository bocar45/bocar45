import Link from "next/link";
import { notFound } from "next/navigation";
import { TECHNIQUE_LABEL, type Technique } from "@sawwa/catalog";
import { ActionForm } from "@/components/action-form";
import { PageHeader, Section, fr } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { REQUEST_STATUS, isQuoteValid, type B2bQuoteRow } from "@/lib/b2b";
import { fcfa } from "@/lib/orders";
import { cancelQuoteRequest } from "@/app/(vitrine)/devis/actions";

export const metadata = { title: "Devis" };

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser(`/compte/devis/${id}`);
  const { data: r } = await supabase.from("quote_requests")
    .select("id, number, organization_name, contact_name, quantity, deadline, message, status, staff_note, created_at, product:base_products(name), quotes:b2b_quotes(id, version, unit_price, color_key, sizes, quantity, decorations, goods_total, setup_fee, tax, deposit_due, lead_time_days, customer_note, valid_until, status, order_id, product:base_products(slug, name))")
    .eq("id", id).maybeSingle();
  if (!r) notFound();
  const quotes = ((r.quotes ?? []) as unknown as (B2bQuoteRow & { product: { slug: string; name: unknown } | null })[]).sort((a, b) => b.version - a.version);
  const current = quotes.find((q) => q.status === "sent" || q.status === "accepted") ?? null;
  const valid = current ? isQuoteValid(current) : false;
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader title={`Devis ${r.number}`} back={{ href: "/compte/devis", label: "Mes devis" }} />
      <p><span className="rounded-full bg-sable px-3 py-1 text-sm font-bold">{REQUEST_STATUS[r.status] ?? r.status}</span></p>
      <Section title="Votre demande">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Organisation</dt><dd>{r.organization_name} · {r.contact_name}</dd>
          <dt className="text-muted">Quantité</dt><dd>{r.quantity} pièces</dd>
          {r.product && <><dt className="text-muted">Produit</dt><dd>{fr((r.product as unknown as { name: unknown }).name)}</dd></>}
          {r.deadline && <><dt className="text-muted">Pour le</dt><dd>{new Date(r.deadline).toLocaleDateString("fr-SN")}</dd></>}
          {r.message && <><dt className="text-muted">Besoin</dt><dd className="whitespace-pre-line">{r.message}</dd></>}
        </dl>
      </Section>

      {r.status === "declined" && <p className="rounded-xl bg-error/10 p-4 text-sm">Nous ne pouvons pas donner suite à cette demande.{r.staff_note ? ` ${r.staff_note}` : ""}</p>}
      {r.status === "new" && <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">L&apos;équipe SAWWA prépare votre devis (réponse sous 24 h ouvrées). Vous le retrouverez ici.</p>}

      {current && (
        <Section title={`Notre proposition (version ${current.version})`}>
          <div className="grid gap-2 rounded-2xl bg-brun p-5 text-ivoire">
            <span className="text-sm text-ivoire/75">{fr(current.product?.name)} · {current.quantity} pièces{current.sizes ? ` (${Object.entries(current.sizes).map(([s, n]) => `${s} × ${n}`).join(", ")})` : " · tailles au choix"}</span>
            <b className="display text-4xl">{fcfa(current.goods_total)} <span className="font-sans text-sm text-ivoire/70">TTC, hors livraison</span></b>
            <span className="text-sm text-ivoire/80">Soit {fcfa(current.unit_price)} la pièce{current.setup_fee ? `, dont ${fcfa(current.setup_fee)} de préparation` : ""} · TVA {fcfa(current.tax)}</span>
            {current.deposit_due != null && <span className="text-sm text-ivoire/80">Acompte à la commande : {fcfa(current.deposit_due)}</span>}
            <span className="text-sm text-ivoire/80">Fabrication en {current.lead_time_days} jours ouvrés après validation du BAT</span>
          </div>
          <ul className="grid gap-1 text-sm">
            {current.decorations.map((d) => (
              <li key={`${d.zoneKey}-${d.technique}`}>· {d.zoneKey} : {TECHNIQUE_LABEL[d.technique as Technique] ?? d.technique}, jusqu&apos;à {Math.round(d.widthMm / 10)} × {Math.round(d.heightMm / 10)} cm{d.colors > 1 ? `, ${d.colors} couleurs` : ""}</li>
            ))}
          </ul>
          {current.customer_note && <p className="whitespace-pre-line text-sm">{current.customer_note}</p>}
          {current.status === "accepted" ? (
            <p className="text-sm text-ok">✓ Devis commandé{current.order_id ? <> — <Link className="underline" href={`/compte/commandes/${current.order_id}`}>voir la commande</Link></> : ""}.</p>
          ) : valid ? (
            <div className="grid gap-2">
              <Link href={`/studio/${current.product?.slug}?devis=${current.id}`} className="btn btn-terra w-fit">Créer et commander au prix du devis →</Link>
              <p className="text-xs text-muted">Valable jusqu&apos;au {new Date(current.valid_until).toLocaleDateString("fr-SN")}. Dans le studio, placez votre logo dans les zones prévues : le prix reste celui du devis tant que le marquage ne dépasse pas ce qui a été devisé.</p>
            </div>
          ) : (
            <p className="text-sm text-error">Ce devis a expiré le {new Date(current.valid_until).toLocaleDateString("fr-SN")}. Faites une nouvelle demande : nous le mettrons à jour.</p>
          )}
        </Section>
      )}

      {(r.status === "new" || r.status === "quoted") && (
        <ActionForm action={cancelQuoteRequest.bind(null, r.id)} submitLabel="Annuler cette demande" variant="secondary" />
      )}
    </div>
  );
}
