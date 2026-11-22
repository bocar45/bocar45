import { ActionForm } from "@/components/action-form";
import { PageHeader, Section, inputClass } from "@/components/ui";
import { requireActiveVendor } from "@/lib/vendor";
import { addClosure, removeClosure, saveCapacity } from "./actions";

export const metadata = { title: "Disponibilités" };

export default async function Availability() {
  const { supabase, vendor, canManage } = await requireActiveVendor("/pro/disponibilites");
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: profile }, { data: closures }] = await Promise.all([
    supabase.from("vendor_profiles").select("capacity_per_day").eq("organization_id", vendor.id).maybeSingle(),
    supabase.from("vendor_closures").select("id, starts_on, ends_on, reason").eq("vendor_id", vendor.id).gte("ends_on", today).order("starts_on"),
  ]);
  const d = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString("fr-SN", { weekday: "short", day: "numeric", month: "long" });
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title="Disponibilités" back={{ href: "/pro", label: vendor.name }} />
      <p className="text-sm text-muted">SAWWA en tient compte avant de vous affecter une commande : pas de commande pendant une fermeture, et une alerte si votre charge dépasse votre délai. Jours ouvrés : du lundi au samedi.</p>
      <Section title="Capacité">
        {canManage ? (
          <ActionForm action={saveCapacity} submitLabel="Enregistrer" className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">Pièces personnalisées par jour
              <input name="capacity" inputMode="numeric" defaultValue={profile?.capacity_per_day ?? ""} className={`${inputClass} w-40`} />
            </label>
          </ActionForm>
        ) : <p className="text-sm">{profile?.capacity_per_day ? `${profile.capacity_per_day} pièces par jour` : "Non déclarée"}</p>}
      </Section>
      <Section title="Fermetures à venir">
        {(closures ?? []).length === 0 && <p className="text-sm text-muted">Aucune fermeture prévue.</p>}
        <ul className="grid gap-2">
          {(closures ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
              <b>Du {d(c.starts_on)} au {d(c.ends_on)}</b>{c.reason && <span className="text-muted">{c.reason}</span>}
              {canManage && <span className="ml-auto"><ActionForm action={removeClosure.bind(null, c.id)} submitLabel="Supprimer" variant="secondary" className="contents" /></span>}
            </li>
          ))}
        </ul>
        {canManage && (
          <ActionForm action={addClosure} submitLabel="Ajouter la fermeture" className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-sm">Du<input type="date" name="from" required min={today} className={inputClass} /></label>
            <label className="grid gap-1 text-sm">Au<input type="date" name="to" required min={today} className={inputClass} /></label>
            <label className="grid gap-1 text-sm">Motif<input name="reason" maxLength={200} placeholder="Tabaski, congés, maintenance…" className={inputClass} /></label>
          </ActionForm>
        )}
      </Section>
    </div>
  );
}
