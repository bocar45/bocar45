import { notFound } from "next/navigation";
import type { Technique } from "@sawwa/catalog";
import { ActionForm } from "@/components/action-form";
import { PageHeader, Section, fr, inputClass } from "@/components/ui";
import { hasPlatformRole, requirePlatformRole } from "@/lib/auth";
import { REQUEST_STATUS, isQuoteValid, type B2bQuoteRow } from "@/lib/b2b";
import { fcfa } from "@/lib/orders";
import { createServiceClient } from "@/lib/supabase/server";
import { declineQuoteRequest, previewB2bQuote, sendB2bQuote } from "../actions";
import { QuoteBuilder } from "./quote-builder";

export const metadata = { title: "Devis B2B" };

export default async function AdminQuote({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ produit?: string }> }) {
  const { id } = await params;
  const { produit } = await searchParams;
  const { supabase, memberships } = await requirePlatformRole(["ops", "support", "finance"], `/admin/devis/${id}`);
  const canQuote = hasPlatformRole(memberships, ["ops", "support"]);
  const { data: r } = await supabase.from("quote_requests")
    .select("id, number, customer_id, organization_name, contact_name, phone, base_product_id, quantity, deadline, message, logo_path, design_id, status, staff_note, created_at, quotes:b2b_quotes(*)")
    .eq("id", id).maybeSingle();
  if (!r) notFound();
  const productId = produit || r.base_product_id;
  const [{ data: products }, { data: product }, logo, { data: design }] = await Promise.all([
    supabase.from("base_products").select("id, name").eq("status", "active").order("name"),
    productId ? supabase.from("base_products").select("id, name, variants:base_product_variants(color_key, size), zones(key, anchor, max_width_mm, max_height_mm, allowed_techniques)").eq("id", productId).maybeSingle() : Promise.resolve({ data: null }),
    // the customer's logo is in their private folder: a short signed link for the team
    r.logo_path ? createServiceClient().storage.from("design-assets").createSignedUrl(r.logo_path, 3600) : Promise.resolve({ data: null }),
    r.design_id ? supabase.from("designs").select("id, title, product:base_products(slug)").eq("id", r.design_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const quotes = ((r.quotes ?? []) as unknown as B2bQuoteRow[]).sort((a, b) => b.version - a.version);
  const variants = ((product?.variants ?? []) as { color_key: string; size: string }[]);
  const zones = ((product?.zones ?? []) as { key: string; anchor: { label?: string } | null; max_width_mm: number; max_height_mm: number; allowed_techniques: Technique[] }[])
    .map((z) => ({ key: z.key, label: z.anchor?.label ?? z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm, techniques: z.allowed_techniques }));
  const open = r.status === "new" || r.status === "quoted";
  return (
    <div className="grid gap-6">
      <PageHeader title={`Demande ${r.number}`} back={{ href: "/admin/devis", label: "Devis B2B" }} />
      <p><span className="rounded-full bg-sable px-3 py-1 text-sm font-bold">{REQUEST_STATUS[r.status] ?? r.status}</span></p>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Section title="Demande du client">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Organisation</dt><dd>{r.organization_name}</dd>
            <dt className="text-muted">Contact</dt><dd>{r.contact_name} · <a className="underline" href={`https://wa.me/${r.phone.replace("+", "")}`}>{r.phone}</a></dd>
            <dt className="text-muted">Quantité</dt><dd>{r.quantity} pièces</dd>
            {r.deadline && <><dt className="text-muted">Pour le</dt><dd>{new Date(r.deadline).toLocaleDateString("fr-SN")}</dd></>}
            <dt className="text-muted">Reçue le</dt><dd>{new Date(r.created_at).toLocaleString("fr-SN", { dateStyle: "short", timeStyle: "short" })}</dd>
            {r.message && <><dt className="text-muted">Besoin</dt><dd className="whitespace-pre-line">{r.message}</dd></>}
            {logo?.data?.signedUrl && <><dt className="text-muted">Logo</dt><dd><a className="underline" href={logo.data.signedUrl} target="_blank" rel="noreferrer">Ouvrir le logo (lien 1 h)</a></dd></>}
            {design && <><dt className="text-muted">Création</dt><dd>{design.title as string}</dd></>}
            {r.staff_note && <><dt className="text-muted">Note</dt><dd className="whitespace-pre-line">{r.staff_note}</dd></>}
          </dl>
          {quotes.length > 0 && (
            <ul className="grid gap-1 text-sm">
              {quotes.map((q) => (
                <li key={q.id}>v{q.version} · {fcfa(q.goods_total)} · {q.quantity} pc · {q.status === "sent" ? (isQuoteValid(q) ? `valable jusqu'au ${new Date(q.valid_until).toLocaleDateString("fr-SN")}` : "expiré") : q.status}</li>
              ))}
            </ul>
          )}
        </Section>
        {open && canQuote ? (
          <Section title={quotes.length ? "Nouvelle version du devis" : "Chiffrer le devis"}>
            <form className="flex flex-wrap items-end gap-2" method="get">
              <label className="grid gap-1 text-xs font-semibold text-muted">Produit
                <select name="produit" defaultValue={productId ?? ""} className={inputClass}>
                  <option value="" disabled>Choisir…</option>
                  {(products ?? []).map((p) => <option key={p.id} value={p.id}>{fr(p.name)}</option>)}
                </select>
              </label>
              <button type="submit" className="rounded-md border border-line bg-surface px-3 py-2 text-sm">Choisir</button>
            </form>
            {product && zones.length > 0 ? (
              <QuoteBuilder key={product.id} requestId={r.id} productId={product.id} defaultQuantity={r.quantity} zones={zones}
                colors={[...new Set(variants.map((v) => v.color_key))]} sizes={[...new Set(variants.map((v) => v.size))]}
                preview={previewB2bQuote} send={sendB2bQuote} />
            ) : <p className="text-sm text-muted">Choisissez un produit en vente pour chiffrer.</p>}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm">Décliner la demande</summary>
              <ActionForm action={declineQuoteRequest.bind(null, r.id)} submitLabel="Décliner" variant="secondary">
                <textarea name="note" rows={2} required minLength={5} className={inputClass} placeholder="Raison, visible par le client (ex. : quantité hors de nos capacités pour cette date)." />
              </ActionForm>
            </details>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
