import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Confidentialité", alternates: { canonical: "/confidentialite" } };

export default function Privacy() {
  return (
    <LegalPage title="Politique de confidentialité" updated="22/11/2026">
      <p>SAWWA traite vos données conformément à la loi sénégalaise n° 2008-12 sur la protection des données à caractère personnel. [Numéro de déclaration auprès de la Commission de protection des données personnelles (CDP) à compléter.]</p>
      <h2>Données collectées et pourquoi</h2>
      <ul>
        <li>Numéro de téléphone ou e-mail : connexion à votre compte (code par SMS ou e-mail).</li>
        <li>Nom, téléphone, adresse de livraison : traitement et livraison de vos commandes.</li>
        <li>Vos créations et les images que vous importez : fabrication de vos commandes ; elles sont stockées dans un espace privé, visibles par vous, par l&apos;atelier chargé de votre commande et par l&apos;équipe SAWWA.</li>
        <li>Données techniques (journal des erreurs, adresse IP pour limiter les abus) : sécurité du service.</li>
      </ul>
      <h2>Ce que nous ne faisons pas</h2>
      <ul>
        <li>Pas de revente de vos données, pas de publicité ciblée.</li>
        <li>Le détourage automatique des photos se fait sur votre appareil : la photo n&apos;est envoyée à aucun service extérieur pour cela.</li>
      </ul>
      <h2>Destinataires</h2>
      <p>L&apos;atelier partenaire affecté à votre commande (création, tailles, adresse de livraison nécessaire à l&apos;expédition) ; nos prestataires techniques d&apos;hébergement (Vercel, Supabase), d&apos;envoi de SMS et de paiement, liés par contrat. [Liste des prestataires à compléter.]</p>
      <h2>Durées de conservation</h2>
      <p>Compte : tant qu&apos;il est actif. Commandes et pièces comptables : durée légale. Images importées non commandées : [durée à fixer]. [À compléter avec le juriste.]</p>
      <h2>Vos droits</h2>
      <p>Accès, rectification, opposition et suppression : écrivez à [adresse e-mail]. Vous pouvez aussi saisir la CDP.</p>
    </LegalPage>
  );
}
