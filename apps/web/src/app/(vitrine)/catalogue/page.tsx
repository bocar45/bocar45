import { CatalogView } from "@/components/catalog-view";
import { loadPublicCatalog } from "@/lib/catalog-public";

export const revalidate = 600;
export const metadata = { title: "Catalogue", description: "T-shirts, hoodies, casquettes, mugs et objets à personnaliser, fabriqués à Dakar." };

export default async function CatalogPage() {
  const data = await loadPublicCatalog();
  return (
    <CatalogView
      title={<>Choisissez, <em>personnalisez.</em></>}
      intro="Chaque produit est fabriqué par un atelier partenaire vérifié. Les prix affichés sont TTC, pour une pièce avec un marquage, et baissent avec la quantité."
      categories={data?.categories ?? []}
      products={data?.products ?? null}
    />
  );
}
