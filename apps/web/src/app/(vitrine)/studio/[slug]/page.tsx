import Link from "next/link";
import { notFound } from "next/navigation";
import { parseDesign, type RosterEntry } from "@sawwa/design";
import { getSession, hasPlatformRole } from "@/lib/auth";
import { signedDesignUrls } from "@/lib/orders";
import { publishedTemplate, templateForEdit } from "@/lib/templates";
import { Studio } from "@/components/studio/studio";
import { isSupabaseConfigured } from "@/lib/env";
import { loadStudioProduct } from "@/lib/studio-data";
import { createClient } from "@/lib/supabase/server";
import { getStudioQuote, placeOrder, resubmitCorrection, saveDesign } from "./actions";
import { saveTemplate } from "./template-actions";

export const metadata = { title: "Studio de création" };

export default async function StudioPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ creation?: string; commande?: string; modele?: string; gabarit?: string }> }) {
  const { slug } = await params;
  const { creation, commande, modele, gabarit } = await searchParams;
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
      assistant = { slug: t.slug, title: t.title, description: t.description };
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
  return <Studio product={product} quote={getStudioQuote} userId={user?.id ?? null} initial={initial} save={saveDesign} order={placeOrder} correction={correction} resubmit={resubmitCorrection}
    assistant={assistant} template={template} saveTemplate={saveTemplate} />;
}
