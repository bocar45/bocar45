import { categoryName, l } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog-view";
import { loadPublicCatalog } from "@/lib/catalog-public";

export const revalidate = 600;
// Pages are generated on first visit, then cached and refreshed every 10 minutes or when admins change data.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ categorie: string }> }) {
  const { categorie } = await params;
  const data = await loadPublicCatalog();
  const c = data?.categories.find((x) => x.slug === categorie);
  return { title: c ? c.name : "Catalogue" };
}

export default async function CategoryPage({ params }: { params: Promise<{ categorie: string }> }) {
  const { categorie } = await params;
  const data = await loadPublicCatalog();
  const category = data?.categories.find((c) => c.slug === categorie);
  if (data && !category) notFound();
  const lang = await getLang();
  const name = category ? categoryName(category, lang) : "Catalogue";
  return (
    <CatalogView
      lang={lang}
      title={lang === "en" ? <>{name} <em>made yours.</em></> : <>{name} <em>à votre image.</em></>}
      intro={l(lang, "Prix TTC pour une pièce avec un marquage. Les prix baissent automatiquement avec la quantité.", "Prices include VAT, for one piece with one print. Prices drop automatically with quantity.")}
      categories={data?.categories ?? []}
      products={data ? data.products.filter((p) => p.category.slug === categorie) : null}
      active={categorie}
    />
  );
}
