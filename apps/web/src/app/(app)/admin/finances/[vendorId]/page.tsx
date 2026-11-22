import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { LedgerStatement, type LedgerEntry } from "@/components/ledger-statement";
import { PageHeader, Section, inputClass } from "@/components/ui";
import { hasPlatformRole, requirePlatformRole } from "@/lib/auth";
import { recordAdjustment, recordPayout } from "../actions";

export const metadata = { title: "Relevé atelier" };

export default async function VendorStatement({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const { supabase, memberships } = await requirePlatformRole(["finance", "ops"], `/admin/finances/${vendorId}`);
  const canPay = hasPlatformRole(memberships, ["finance"]);
  const [{ data: vendor }, { data: entries }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", vendorId).eq("kind", "vendor").maybeSingle(),
    supabase.from("vendor_ledger").select("id, type, amount, note, at, fulfillment_id").eq("vendor_id", vendorId).order("at").order("id"),
  ]);
  if (!vendor) notFound();
  return (
    <div className="grid gap-6">
      <PageHeader title={`Relevé · ${vendor.name}`} back={{ href: "/admin/finances", label: "Finances" }} />
      <LedgerStatement entries={(entries ?? []) as LedgerEntry[]} />
      {canPay && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Enregistrer un versement">
            <ActionForm action={recordPayout.bind(null, vendorId)} submitLabel="Enregistrer le versement">
              <input name="amount" required inputMode="numeric" className={inputClass} placeholder="Montant (FCFA)" aria-label="Montant (FCFA)" />
              <select name="method" className={inputClass} aria-label="Moyen"><option value="wave">Wave</option><option value="orange_money">Orange Money</option><option value="virement">Virement</option><option value="especes">Espèces</option></select>
              <input name="reference" required minLength={3} className={inputClass} placeholder="Référence de la transaction" aria-label="Référence" />
            </ActionForm>
            <p className="text-xs text-muted">Effectuez d&apos;abord le versement (Wave, Orange Money, banque), puis enregistrez-le ici avec sa référence. Le montant ne peut pas dépasser le solde dû.</p>
          </Section>
          <Section title="Ajustement">
            <ActionForm action={recordAdjustment.bind(null, vendorId)} submitLabel="Enregistrer l'ajustement" variant="secondary">
              <input name="amount" required inputMode="numeric" className={inputClass} placeholder="Montant signé (ex. 2000 ou -1500)" aria-label="Montant (FCFA)" />
              <input name="note" required minLength={5} className={inputClass} placeholder="Justification" aria-label="Justification" />
            </ActionForm>
          </Section>
        </div>
      )}
    </div>
  );
}
