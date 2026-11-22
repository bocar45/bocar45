import { redirect } from "next/navigation";
import { LedgerStatement, type LedgerEntry } from "@/components/ledger-statement";
import { PageHeader } from "@/components/ui";
import { requireUser, vendorMembership } from "@/lib/auth";

export const metadata = { title: "Mon relevé" };

export default async function VendorOwnStatement() {
  const { supabase, memberships } = await requireUser("/pro/releve");
  const vendor = vendorMembership(memberships);
  if (!vendor) redirect("/pro");
  // RLS: a workshop reads only its own ledger.
  const { data } = await supabase.from("vendor_ledger").select("id, type, amount, note, at, fulfillment_id").eq("vendor_id", vendor.organization.id).order("at").order("id");
  return (
    <div className="grid gap-6">
      <PageHeader title="Mon relevé" back={{ href: "/pro", label: "Espace atelier" }} />
      <p className="max-w-2xl text-sm text-muted">Chaque commande livrée est créditée au montant convenu à l&apos;affectation. SAWWA vous verse le solde selon le calendrier convenu (Wave, Orange Money ou virement) ; chaque versement apparaît ici avec sa référence.</p>
      <LedgerStatement entries={(data ?? []) as LedgerEntry[]} orderLink={(fid) => `/pro/commandes/${fid}`} />
    </div>
  );
}
