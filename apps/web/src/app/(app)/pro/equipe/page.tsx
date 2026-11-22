import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { PageHeader, Section, inputClass } from "@/components/ui";
import { requireActiveVendor } from "@/lib/vendor";
import { inviteMember, setMember } from "./actions";

export const metadata = { title: "Mon équipe" };
const ROLE = { owner: "Propriétaire", manager: "Gérant", operator: "Opérateur" } as Record<string, string>;
const RIGHTS = [
  ["Propriétaire", "tout : équipe, offres et prix, disponibilités, relevé et versements, production"],
  ["Gérant", "offres et prix, disponibilités, relevé, production ; invite des opérateurs"],
  ["Opérateur", "production seulement : commandes, BAT, photos de contrôle, expédition"],
];

export default async function Team() {
  const { supabase, vendor, role, user } = await requireActiveVendor("/pro/equipe");
  if (role === "operator") redirect("/pro");
  const [{ data: team }, { data: invitations }] = await Promise.all([
    supabase.rpc("vendor_team", { p_vendor: vendor.id }),
    supabase.from("vendor_invitations").select("id, phone, role, expires_at").eq("vendor_id", vendor.id).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  return (
    <div className="grid gap-6">
      <PageHeader title="Mon équipe" back={{ href: "/pro", label: vendor.name }} />
      <ul className="grid gap-1 text-sm text-muted">{RIGHTS.map(([r, d]) => <li key={r}><b className="text-fg">{r}</b> : {d}</li>)}</ul>
      <Section title="Membres">
        <ul className="grid gap-2">
          {((team ?? []) as { user_id: string; role: string; phone: string | null }[]).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
              <b>{m.phone ? `+${m.phone.replace(/^\+/, "")}` : "—"}</b>
              <span className="rounded-full bg-sable px-2 py-0.5 text-xs font-bold">{ROLE[m.role] ?? m.role}</span>
              {m.user_id === user.id && <span className="text-muted">(vous)</span>}
              {role === "owner" && m.user_id !== user.id && (
                <span className="ml-auto flex flex-wrap gap-2">
                  {(["owner", "manager", "operator"] as const).filter((r) => r !== m.role).map((r) => (
                    <ActionForm key={r} action={setMember.bind(null, m.user_id, r)} submitLabel={`→ ${ROLE[r]}`} variant="secondary" className="contents" />
                  ))}
                  <ActionForm action={setMember.bind(null, m.user_id, null)} submitLabel="Retirer" variant="secondary" className="contents" />
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Inviter quelqu'un">
        <ActionForm action={inviteMember} submitLabel="Créer l'invitation" className="flex flex-wrap items-end gap-2">
          <input name="phone" required inputMode="tel" placeholder="77 123 45 67" aria-label="Téléphone" className={`${inputClass} max-w-xs`} />
          <select name="role" className={`${inputClass} max-w-xs`} aria-label="Rôle">
            <option value="operator">Opérateur</option>
            {role === "owner" && <option value="manager">Gérant</option>}
          </select>
        </ActionForm>
        {(invitations ?? []).length > 0 && (
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {(invitations ?? []).map((i) => <li key={i.id}>En attente : {i.phone} · {ROLE[i.role as string]} · jusqu&apos;au {new Date(i.expires_at).toLocaleDateString("fr-SN")}</li>)}
          </ul>
        )}
      </Section>
    </div>
  );
}
