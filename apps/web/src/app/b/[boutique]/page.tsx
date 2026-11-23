import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TECHNIQUE_LABEL } from "@sawwa/catalog";
import { fcfaIn, l, productName, techniqueLabel } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { productPhotoFor } from "@/lib/product-photos";
import { loadStorefront } from "@/lib/storefront";

/**
 * E25 — White-label storefront (SAWWA Business). The page is branded with the workshop's name and colours;
 * the studio, prices (its own price grid, priced by @sawwa/pricing), proof and order flow are SAWWA's.
 * The SAWWA header and footer are hidden by CSS (see globals.css, [data-white-label]).
 */
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ boutique: string }> }): Promise<Metadata> {
  const { boutique } = await params;
  const s = await loadStorefront(boutique);
  if (!s) return { title: "Boutique introuvable", robots: { index: false } };
  return { title: { absolute: s.name }, description: s.tagline || undefined, robots: s.isDemo ? { index: false } : undefined };
}

export default async function StorefrontPage({ params }: { params: Promise<{ boutique: string }> }) {
  const { boutique } = await params;
  const [s, lang] = await Promise.all([loadStorefront(boutique), getLang()]);
  if (!s) notFound();
  const { primary, accent, onPrimary } = s.theme;
  return (
    <div data-white-label className="min-h-dvh bg-[#FAF8F4] text-[#1C1C1C]">
      <header style={{ background: primary, color: onPrimary }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <b className="text-xl tracking-tight">{s.name}</b>
          {s.contactPhone && <a href={`tel:${s.contactPhone}`} className="text-sm font-semibold underline-offset-4 hover:underline">{s.contactPhone}</a>}
        </div>
        <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-14 pt-8">
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">{l(lang, "Personnalisez vos produits en ligne.", "Customise your products online.")}</h1>
          {s.tagline && <p className="max-w-2xl text-lg opacity-85">{s.tagline}</p>}
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold opacity-90">
            {[l(lang, "Prix immédiat", "Instant price"), l(lang, "Aperçu 3D", "3D preview"), l(lang, "BAT avant fabrication", "Proof before production")].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="size-2 rotate-45" style={{ background: accent }} aria-hidden="true" />{t}</li>
            ))}
          </ul>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-12">
        {s.isDemo && (
          <p className="rounded-xl border border-[#E3DCCF] bg-white px-4 py-3 text-sm">
            {l(lang, "Boutique de démonstration : atelier fictif, aucune commande réelle n'est fabriquée.", "Demo storefront: fictitious workshop, no real order is produced.")}
          </p>
        )}
        {s.products.length === 0 ? (
          <p>{l(lang, "Cette boutique n'a pas encore de produits.", "This shop has no products yet.")}</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {s.products.map((p) => {
              const photo = productPhotoFor(`${p.slug} ${p.category.slug}`);
              return (
                <li key={p.id} className="grid overflow-hidden rounded-2xl border border-[#E3DCCF] bg-white">
                  <div className="relative aspect-[4/5] bg-[#EFEAE1]">
                    {photo && <Image src={photo.src} alt={lang === "en" ? photo.altEn : photo.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />}
                  </div>
                  <div className="grid gap-2 p-5">
                    <b className="text-lg">{productName(p, lang)}</b>
                    {p.price && (
                      <span className="text-sm">
                        {l(lang, "dès", "from")} <b>{fcfaIn(lang, p.price.fromUnitPrice)}</b>
                        {p.price.bestVolume && p.price.bestVolume.unitPrice < p.price.fromUnitPrice && (
                          <span className="text-[#6B645A]"> · {fcfaIn(lang, p.price.bestVolume.unitPrice)} {l(lang, "dès", "from")} {p.price.bestVolume.quantity} pc</span>
                        )}
                      </span>
                    )}
                    {p.price && <span className="text-xs text-[#6B645A]">{p.price.techniques.map((t) => techniqueLabel(t, TECHNIQUE_LABEL[t], lang)).join(" · ")}</span>}
                    <Link href={`/studio/${p.slug}?boutique=${s.slug}`} className="mt-2 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 font-bold" style={{ background: accent, color: "#1C1C1C" }}>
                      {l(lang, "Personnaliser", "Customise")} <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="border-t border-[#E3DCCF]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-[#6B645A]">
          <span>© {s.name}</span>
          <Link href="/" className="font-semibold hover:underline">{l(lang, "Boutique propulsée par SAWWA", "Shop powered by SAWWA")}</Link>
        </div>
      </footer>
    </div>
  );
}
