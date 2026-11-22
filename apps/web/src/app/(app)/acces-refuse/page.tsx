import Link from "next/link";

export const metadata = { title: "Accès refusé" };

export default function AccessDenied() {
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-3xl">Accès refusé</h1>
      <p className="text-muted">Votre compte n&apos;a pas les droits pour cette page. Si c&apos;est une erreur, contactez l&apos;équipe SAWWA.</p>
      <Link href="/" className="underline">Retour à l&apos;accueil</Link>
    </div>
  );
}
