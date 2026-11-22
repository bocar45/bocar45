import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Conditions générales de vente", alternates: { canonical: "/cgv" } };

export default function Terms() {
  return (
    <LegalPage title="Conditions générales de vente" updated="22/11/2026">
      <h2>1. Objet</h2>
      <p>SAWWA vend des produits personnalisés (vêtements, accessoires, objets) que le client crée dans le studio du site. SAWWA est le vendeur ; la fabrication est confiée à des ateliers partenaires vérifiés, au Sénégal.</p>
      <h2>2. Prix</h2>
      <p>Les prix sont en francs CFA (XOF), toutes taxes comprises, calculés selon le produit, la quantité, la technique et la taille du marquage. Le prix affiché au moment de la commande est figé avec la commande. Les frais de livraison sont indiqués avant la confirmation. Un devis pour une organisation fixe le prix pour la quantité indiquée pendant sa durée de validité (30 jours sauf mention contraire).</p>
      <h2>3. Commande et paiement</h2>
      <p>La commande est enregistrée avec la version exacte de la création. Pendant la phase pilote, le paiement se fait par Wave, Orange Money ou virement, après confirmation ; un acompte de 50 % peut être demandé pour les grosses quantités. [Moyens de paiement en ligne à compléter lors de leur mise en service.]</p>
      <h2>4. Bon à tirer (BAT) et corrections</h2>
      <ul>
        <li>L&apos;atelier vérifie chaque création avant de produire (BAT).</li>
        <li>Si une correction est nécessaire, le client peut la faire dans le studio, faire produire telle quelle ou annuler et être remboursé.</li>
        <li>Une correction qui augmente le prix n&apos;est appliquée qu&apos;avec l&apos;accord du client sur le supplément exact.</li>
      </ul>
      <h2>5. Contenus et droits</h2>
      <p>Le client déclare avoir le droit d&apos;utiliser les images, logos et textes qu&apos;il importe. Les créations reproduisant une marque, un personnage ou une œuvre protégés sans autorisation, ou un contenu illicite, sont refusées ; la commande est alors annulée et remboursée.</p>
      <h2>6. Fabrication et livraison</h2>
      <p>Le délai de fabrication indiqué court à partir de la validation du BAT. La livraison est assurée à Dakar et dans les régions indiquées, ou en retrait. [Zones et délais de livraison à compléter.]</p>
      <h2>7. Produits personnalisés et réclamations</h2>
      <p>Un produit fabriqué selon la création du client ne peut être ni repris ni échangé pour un changement d&apos;avis. En cas de défaut de fabrication, d&apos;erreur ou de non-réception, le client le signale depuis sa commande (photos à l&apos;appui) ; après examen, SAWWA propose une refabrication ou un remboursement partiel ou total. [Délai de réclamation à compléter.]</p>
      <h2>8. Droit applicable</h2>
      <p>Les présentes conditions sont soumises au droit sénégalais. [Juridiction compétente et médiation à compléter.]</p>
    </LegalPage>
  );
}
