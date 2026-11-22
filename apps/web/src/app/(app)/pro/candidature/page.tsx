import { redirect } from "next/navigation";
import { requireUser, vendorMembership } from "@/lib/auth";
import { ApplyForm } from "./apply-form";

export const metadata = { title: "Candidature atelier" };

export default async function ApplyPage() {
  const { memberships } = await requireUser("/pro/candidature");
  if (vendorMembership(memberships)) redirect("/pro");
  return (
    <div className="grid max-w-xl gap-6">
      <h1 className="font-display text-3xl">Devenir atelier partenaire</h1>
      <p className="text-muted">
        Imprimeurs, brodeurs, ateliers de sublimation : SAWWA vous envoie des commandes payées d&apos;avance, avec des
        fichiers prêts à produire. Pas d&apos;abonnement.
      </p>
      <ApplyForm />
    </div>
  );
}
