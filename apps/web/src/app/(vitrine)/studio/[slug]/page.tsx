import { getLang } from "@/lib/lang";
import { l } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { templateMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { parseDesign, type RosterEntry } from "@sawwa/design";
import { getSession, hasPlatformRole } from "@/lib/auth";
import { signedDesignUrls } from "@/lib/orders";
import { publishedTemplate, templateForEdit } from "@/lib/templates";
import { Studio, type B2bForStudio } from "@/components/studio/studio";
import { isQuoteValid, type B2bQuoteRow } from "@/lib/b2b";
import { isSupabaseConfigured } from "@/lib/env";
import { loadStudioProduct } from "@/lib/studio-data";
import { createClient } from "@/lib/supabase/server";
import { getStorefrontStudioQuote, getStudioQuote, placeOrder, placeStorefrontOrder, resubmitCorrection, saveDesign } from "./actions";
import { storefrontForStudio } from "@/lib/storefront";
import { saveTemplate } from "./template-actions";

/** E24c: each published template is its own indexable page (title, description, canonical with ?modele=). */
export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ modele?: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { modele } = await searchParams;
  if (modele && isSupabaseConfigured()) {
    const t = await publishedTemplate(modele, slug).catch(() => null);
    if (t) return templateMetadata(t);
  }
  return { title: "Studio de création", alternates: { canonical: `/studio/${slug}` } };
}

export default async function StudioPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ creation?: string; commande?: string; modele?: string; gabarit?: string; devis?: string; boutique?: string }> }) {
  const { slug } = await params;
  const { creation, commande, modele, gabarit, devis, boutique } = await searchParams;
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto grid max-w-xl gap-4 px-4 py-16">
        <h1 className="display on-light text-4xl">Le studio se prépare</h1>
        <p className="text-muted">Le catalogue n&apos;est pas encore connecté. Revenez très bientôt.</p>
        <Link href="/" className="btn btn-terra w-fit">Retour à l&apos;accueil</Link>
      </div>
    );
  }
  const product = await loadStudioProduct(slug);
  if (!product || product.zones.length === 0) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let initial = null;
  if (user && creation) {
    const { data } = await supabase.from("designs").select("id, title, document").eq("id", creation).maybeSingle();
    const parsed = data ? parseDesign(data.document) : null;
    if (data && parsed?.ok && parsed.value.product === slug) {
      initial = { id: data.id as string, title: data.title as string, document: parsed.value, urls: await signedDesignUrls(supabase, parsed.value) };
    }
  }
  // E10: correcting an order opens the version that was ordered.
  let correction = null;
  if (user && commande) {
    const { data: o } = await supabase
      .from("orders")
      .select("id, number, items:order_items(roster, version:design_versions(design_id, document)), fulfillments(status), events:status_events(event, payload, at)")
      .eq("id", commande).maybeSingle();
    const item = (o?.items as unknown as { roster: RosterEntry[] | null; version: { design_id: string; document: unknown } }[] | undefined)?.[0];
    const status = (o?.fulfillments as { status: string }[] | undefined)?.[0]?.status;
    const parsed = item ? parseDesign(item.version.document) : null;
    if (o && item && status === "changes_requested" && parsed?.ok && parsed.value.product === slug) {
      const { data: d } = await supabase.from("designs").select("id, title").eq("id", item.version.design_id).maybeSingle();
      initial = { id: item.version.design_id, title: d?.title ?? "Ma création", document: parsed.value, urls: await signedDesignUrls(supabase, parsed.value) };
      const last = ((o.events ?? []) as { event: string; payload: { comment?: string }; at: string }[]).filter((e) => e.event === "request_changes").sort((a, b) => b.at.localeCompare(a.at))[0];
      correction = { orderId: o.id as string, number: o.number as string, comment: last?.payload.comment ?? null, roster: item.roster };
    }
  }
  // E15: a customer opens a published template (assistant), or the catalogue team edits one.
  let assistant = null;
  if (!initial && !correction && modele) {
    const t = await publishedTemplate(modele, slug);
    if (t) {
      initial = { id: null, title: t.title, document: t.document, urls: t.urls };
      assistant = { id: t.id, slug: t.slug, title: t.title, description: t.description };
    }
  }
  let template = null;
  if (!initial && !correction && gabarit) {
    const session = await getSession();
    if (!session || !hasPlatformRole(session.memberships, ["catalog"])) notFound();
    const t = await templateForEdit(gabarit);
    if (!t || t.productSlug !== slug) notFound();
    initial = { id: null, title: t.title, document: t.document, urls: t.urls };
    template = { id: t.id, title: t.title, status: t.status };
  }
  // E17: designing the order of an accepted B2B quote (the customer's own quote, still valid, for this product).
  let b2b: B2bForStudio | null = null;
  if (devis && !user) redirect(`/connexion?suite=${encodeURIComponent(`/studio/${slug}?devis=${devis}`)}`);
  if (user && devis && !correction && !template) {
    const { data: qrow } = await supabase.from("b2b_quotes").select("*, request:quote_requests(number), product:base_products(slug)").eq("id", devis).maybeSingle();
    const q = qrow as (B2bQuoteRow & { request: { number: string } | null; product: { slug: string } | null }) | null;
    if (q && q.product?.slug === slug && isQuoteValid(q)) {
      b2b = { id: q.id, number: q.request?.number ?? "", quantity: q.quantity, sizes: q.sizes, colorKey: q.color_key, goodsTotal: q.goods_total,
        depositDue: q.deposit_due, leadTimeDays: q.lead_time_days, validUntil: q.valid_until, decorations: q.decorations };
    }
  }
  // E27: opened from a white-label storefront → that workshop's prices and the shop's colours.
  const shop = boutique && !b2b && !template ? await storefrontForStudio(boutique, slug) : null;
  const studio = <Studio product={product} b2b={b2b} quote={shop ? getStorefrontStudioQuote.bind(null, shop.slug) : getStudioQuote} userId={user?.id ?? null} initial={initial} save={saveDesign} order={shop ? placeStorefrontOrder.bind(null, shop.slug) : placeOrder} correction={correction} resubmit={resubmitCorrection}
    assistant={assistant} template={template} saveTemplate={saveTemplate} />;
  if (!shop) return studio;
  const lang = await getLang();
  return (
    <>
      <div style={{ background: shop.theme.primary, color: shop.theme.onPrimary }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
          <span>{l(lang, "Vous personnalisez chez", "You are customising at")} <b>{shop.name}</b> · {l(lang, "prix de cet atelier", "this workshop's prices")}</span>
          <Link href={`/b/${shop.slug}`} className="font-bold underline-offset-4 hover:underline">← {l(lang, "Retour à la boutique", "Back to the shop")}</Link>
        </div>
      </div>
      {studio}
    </>
  );
}
