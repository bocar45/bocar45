import type { PlatformRuleSet } from "@sawwa/pricing";
import { hasPlatformRole, requirePlatformRole } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Empty, Field, PageHeader, Section, StatusPill, inputClass } from "@/components/ui";
import { activateRuleSet, createRuleSet } from "./actions";
import { READ_FAILED, logError } from "@/lib/log";

export const metadata = { title: "Règles de prix" };

const pct = (bps: number) => `${(bps / 100).toLocaleString("fr-FR")} %`;
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export default async function RulesPage() {
  const { supabase, memberships } = await requirePlatformRole(["finance", "ops", "catalog"], "/admin/regles-prix");
  const canEdit = hasPlatformRole(memberships, ["finance"]);
  const { data, error } = await supabase.from("price_rule_sets").select("id, version, status, rules, activated_at").order("version", { ascending: false });
  const active = data?.find((r) => r.status === "active");
  const base = (active?.rules ?? null) as PlatformRuleSet | null;

  if (error) logError("price_rules_read_failed", error);
  return (
    <div className="grid gap-6">
      <PageHeader title="Règles de prix SAWWA" back={{ href: "/admin", label: "Administration" }} />
      <p className="max-w-prose text-muted">
        Prix public TTC = coût atelier × (1 + marge), jamais moins que coût + marge minimale, puis TVA et arrondi au pas supérieur.
        Une version activée ne se modifie plus : on en crée une nouvelle. Les commandes passées gardent le prix calculé avec leur version.
      </p>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data?.length === 0 && <Empty>Aucune règle. Sans version active, aucun prix public ne peut être calculé.</Empty>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-2">Version</th><th className="p-2 text-right">Marge</th><th className="p-2 text-right">Marge min / pièce</th><th className="p-2 text-right">TVA</th><th className="p-2 text-right">Arrondi</th><th className="p-2">Acompte</th><th className="p-2">Statut</th><th className="p-2" />
            </tr></thead>
            <tbody>
              {data.map((r) => {
                const rules = r.rules as PlatformRuleSet;
                return (
                  <tr key={r.id} className="border-b border-line">
                    <td className="p-2 tabular-nums">v{r.version}</td>
                    <td className="p-2 text-right tabular-nums">{pct(rules.defaultMarginBps)}</td>
                    <td className="p-2 text-right tabular-nums">{fcfa(rules.minMarginPerUnit)}</td>
                    <td className="p-2 text-right tabular-nums">{pct(rules.vatBps)}</td>
                    <td className="p-2 text-right tabular-nums">{fcfa(rules.priceStep)}</td>
                    <td className="p-2">{rules.deposit ? `${pct(rules.deposit.bps)} dès ${fcfa(rules.deposit.thresholdTotal)}` : "—"}</td>
                    <td className="p-2"><StatusPill status={r.status as "draft" | "active" | "retired"} /></td>
                    <td className="p-2">{canEdit && r.status === "draft" && <ActionForm action={activateRuleSet.bind(null, r.id)} submitLabel="Activer" pendingLabel="…" className="contents" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <Section title="Nouvelle version" id="new">
          <ActionForm action={createRuleSet} submitLabel="Créer le brouillon">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Marge (%)" htmlFor="margin_pct"><input id="margin_pct" name="margin_pct" inputMode="decimal" defaultValue={base ? base.defaultMarginBps / 100 : 35} className={inputClass} /></Field>
              <Field label="Marge minimale par pièce (FCFA)" htmlFor="min_margin"><input id="min_margin" name="min_margin" inputMode="numeric" defaultValue={base?.minMarginPerUnit ?? 500} className={inputClass} /></Field>
              <Field label="TVA (%)" htmlFor="vat_pct"><input id="vat_pct" name="vat_pct" inputMode="decimal" defaultValue={base ? base.vatBps / 100 : 18} className={inputClass} /></Field>
              <Field label="Arrondi des prix (FCFA)" htmlFor="price_step"><input id="price_step" name="price_step" inputMode="numeric" defaultValue={base?.priceStep ?? 50} className={inputClass} /></Field>
              <Field label="Acompte à partir de (FCFA TTC)" htmlFor="deposit_threshold"><input id="deposit_threshold" name="deposit_threshold" inputMode="numeric" defaultValue={base?.deposit?.thresholdTotal ?? 150000} className={inputClass} /></Field>
              <Field label="Acompte (%)" htmlFor="deposit_pct"><input id="deposit_pct" name="deposit_pct" inputMode="decimal" defaultValue={base?.deposit ? base.deposit.bps / 100 : 50} className={inputClass} /></Field>
            </div>
          </ActionForm>
        </Section>
      )}
    </div>
  );
}
