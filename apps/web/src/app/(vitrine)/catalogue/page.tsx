import { l } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { CatalogView } from "@/components/catalog-view";
import { loadPublicCatalog } from "@/lib/catalog-public";

export const revalidate = 600;
export const metadata = { title: "Catalogue", description: "T-shirts, hoodies, casquettes, mugs et objets à personnaliser, fabriqués à Dakar." };

export default async function CatalogPage() {
  const data = await loadPublicCatalog();
  const lang = await getLang();
  return (
    <CatalogView
      lang={lang}
      title={lang === "en" ? <>Choose, <em>personalise.</em></> : <>Choisissez, <em>personnalisez.</em></>}
      intro={l(lang, "Chaque produit est fabriqué par un atelier partenaire vérifié. Les prix affichés sont TTC, pour une pièce avec un marquage, et baissent avec la quantité.", "Every product is made by a vetted partner workshop. Prices include VAT, for one piece with one print, and drop with quantity.")}
      categories={data?.categories ?? []}
      products={data?.products ?? null}
    />
  );
}
