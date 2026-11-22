import Link from "next/link";
import { requireUser, vendorMembership } from "@/lib/auth";

export const metadata = { title: "Espace atelier" };

const STATUS_TEXT = {
  pending: "Candidature reçue. L'équipe SAWWA vous contacte pour la commande test.",
  active: "Atelier actif. Les commandes que SAWWA vous affecte apparaissent dans « Mes commandes ».",
  suspended: "Compte suspendu. Contactez l'équipe SAWWA.",
  rejected: "Candidature non retenue pour le moment.",
} as const;

export default async function ProHome() {
  const { memberships } = await requireUser("/pro");
  const vendor = vendorMembership(memberships);
  if (!vendor) {
    return (
      <div className="grid max-w-xl gap-4">
        <h1 className="font-display text-3xl">Espace atelier</h1>
        <p className="text-muted">Vous n&apos;êtes rattaché à aucun atelier.</p>
        <Link href="/pro/candidature" className="w-fit rounded-md bg-action px-4 py-3 font-bold text-on-action">
          Déposer une candidature
        </Link>
      </div>
    );
  }
  const { name, status } = vendor.organization;
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-3xl">{name}</h1>
      <p role="status" className="rounded-lg border border-line bg-surface p-4">{STATUS_TEXT[status]}</p>
      {status === "active" && (
        <div className="flex flex-wrap gap-3">
          <Link href="/pro/commandes" className="btn btn-terra">Mes commandes</Link>
          <Link href="/pro/offres" className="btn btn-brun">Mes offres et mes prix</Link>
          <Link href="/pro/releve" className="btn btn-brun">Mon relevé</Link>
        </div>
      )}
    </div>
  );
}
