import Link from "next/link";
import { notFound } from "next/navigation";
import { parseDesign } from "@sawwa/design";
import { Studio } from "@/components/studio/studio";
import { isSupabaseConfigured } from "@/lib/env";
import { loadStudioProduct } from "@/lib/studio-data";
import { createClient } from "@/lib/supabase/server";
import { getStudioQuote, placeOrder, resubmitCorrection, saveDesign } from "./actions";

export const metadata = { title: "Studio de création" };

export default async function StudioPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ creation?: string; commande?: string }> }) {
  const { slug } = await params;
  const { creation, commande } = await searchParams;
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
      const paths = parsed.value.surfaces.flatMap((s) => s.layers).flatMap((l) => (l.type === "image" && l.src.startsWith("storage:design-assets/") ? [l.src.slice("storage:design-assets/".length)] : []));
      const urls: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("design-assets").createSignedUrls(paths, 3600);
        for (const s of signed ?? []) if (s.signedUrl && s.path) urls[`storage:design-assets/${s.path}`] = s.signedUrl;
      }
      initial = { id: data.id as string, title: data.title as string, document: parsed.value, urls };
    }
  }
  // E10: correcting an order opens the version that was ordered.
  let correction = null;
  if (user && commande) {
    const { data: o } = await supabase
      .from("orders")
      .select("id, number, items:order_items(version:design_versions(design_id, document)), fulfillments(status), events:status_events(event, payload, at)")
      .eq("id", commande).maybeSingle();
    const item = (o?.items as unknown as { version: { design_id: string; document: unknown } }[] | undefined)?.[0];
    const status = (o?.fulfillments as { status: string }[] | undefined)?.[0]?.status;
    const parsed = item ? parseDesign(item.version.document) : null;
    if (o && item && status === "changes_requested" && parsed?.ok && parsed.value.product === slug) {
      const { data: d } = await supabase.from("designs").select("id, title").eq("id", item.version.design_id).maybeSingle();
      const paths = parsed.value.surfaces.flatMap((s) => s.layers).flatMap((l) => (l.type === "image" && l.src.startsWith("storage:design-assets/") ? [l.src.slice("storage:design-assets/".length)] : []));
      const urls: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("design-assets").createSignedUrls(paths, 3600);
        for (const s of signed ?? []) if (s.signedUrl && s.path) urls[`storage:design-assets/${s.path}`] = s.signedUrl;
      }
      initial = { id: item.version.design_id, title: d?.title ?? "Ma création", document: parsed.value, urls };
      const last = ((o.events ?? []) as { event: string; payload: { comment?: string }; at: string }[]).filter((e) => e.event === "request_changes").sort((a, b) => b.at.localeCompare(a.at))[0];
      correction = { orderId: o.id as string, number: o.number as string, comment: last?.payload.comment ?? null };
    }
  }
  return <Studio product={product} quote={getStudioQuote} userId={user?.id ?? null} initial={initial} save={saveDesign} order={placeOrder} correction={correction} resubmit={resubmitCorrection} />;
}
