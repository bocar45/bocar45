import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Mentions légales", alternates: { canonical: "/mentions-legales" } };

export default function LegalNotice() {
  return (
    <LegalPage title="Mentions légales" updated="22/11/2026">
      <h2>Éditeur</h2>
      <p>SAWWA — [raison sociale, forme juridique, capital], [adresse du siège, Dakar, Sénégal], NINEA [à compléter], RCCM [à compléter]. Directeur de la publication : [nom].</p>
      <p>Contact : [adresse e-mail], [numéro WhatsApp].</p>
      <h2>Hébergement</h2>
      <p>Site : Vercel Inc. (États-Unis), région d&apos;exécution Paris (cdg1). Données et fichiers : Supabase (région Paris, eu-west-3).</p>
      <h2>Propriété intellectuelle</h2>
      <p>La marque SAWWA, son logo et les contenus du site sont protégés. Les créations des clients restent leur propriété ; ils accordent à SAWWA et à ses ateliers partenaires le droit de les reproduire pour fabriquer leurs commandes.</p>
      <h2>Signaler un contenu</h2>
      <p>Un contenu qui porte atteinte à vos droits ou à la loi peut être signalé depuis le site (« Signaler ») ou à [adresse e-mail]. Nous répondons sous 48 h.</p>
    </LegalPage>
  );
}
