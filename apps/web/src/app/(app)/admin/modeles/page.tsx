import Link from "next/link";
import { OCCASIONS, isOccasion } from "@sawwa/catalog";
import { parseDesign, templateBlockers, templateFields } from "@sawwa/design";
import { ActionForm } from "@/components/action-form";
import { Empty, Field, PageHeader, StatusPill, fr, inputClass } from "@/components/ui";
import { requirePlatformRole } from "@/lib/auth";
import { READ_FAILED, logError } from "@/lib/log";
import { createTemplate, setTemplateStatus } from "./actions";

export const metadata = { title: "Modèles prêts à personnaliser" };

export default async function TemplatesAdmin() {
  const { supabase } = await requirePlatformRole(["catalog"], "/admin/modeles");
  const [{ data, error }, { data: products }] = await Promise.all([
    supabase.from("templates").select("id, slug, title, occasion, status, document, updated_at, product:base_products(slug, name, status)").order("updated_at", { ascending: false }),
    supabase.from("base_products").select("id, name, status").neq("status", "archived").order("updated_at", { ascending: false }),
  ]);
  if (error) logError("templates_admin_read_failed", error);
  return (
    <div className="grid gap-8">
      <PageHeader title="Modèles prêts à personnaliser" back={{ href: "/admin", label: "Administration" }} />
      <p className="max-w-3xl text-sm text-muted">
        Un modèle est une création faite dans le studio dont certains éléments sont marqués « photo du client » ou « texte du client ».
        Les autres éléments restent tels quels pour le client (verrouillez les décorations). Le client remplit ces champs dans un assistant,
        puis commande ou continue dans le studio complet.
      </p>

      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data?.length === 0 && <Empty>Aucun modèle. Créez le premier ci-dessous (ex. « Mug photo — Bonne fête maman »).</Empty>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-2">Modèle</th><th className="p-2">Produit</th><th className="p-2">Occasion</th><th className="p-2">Champs</th><th className="p-2">Statut</th><th className="p-2">Actions</th>
            </tr></thead>
            <tbody>
              {data.map((t) => {
                const product = t.product as unknown as { slug: string; name: unknown; status: string } | null;
                const parsed = parseDesign(t.document);
                const fields = parsed.ok ? templateFields(parsed.value) : [];
                const blockers = parsed.ok ? templateBlockers(parsed.value) : ["Document illisible."];
                return (
                  <tr key={t.id} className="border-b border-line align-top">
                    <td className="p-2"><b>{t.title}</b><div className="text-xs text-muted">{t.slug}</div></td>
                    <td className="p-2">{fr(product?.name)}{product?.status !== "active" && <div className="text-xs text-error">Produit pas en vente</div>}</td>
                    <td className="p-2">{isOccasion(t.occasion) ? OCCASIONS[t.occasion] : t.occasion}</td>
                    <td className="p-2">{fields.length ? fields.map((f) => `${f.kind === "photo" ? "📷" : "T"} ${f.label}`).join(" · ") : <span className="text-muted">aucun</span>}</td>
                    <td className="p-2"><StatusPill status={t.status as "draft" | "published" | "archived"} />
                      {t.status !== "published" && blockers.length > 0 && <ul className="mt-1 text-xs text-muted">{blockers.map((b) => <li key={b}>· {b}</li>)}</ul>}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        {product && <Link href={`/studio/${product.slug}?gabarit=${t.id}`} className="rounded-md border border-line bg-surface px-3 py-2">Modifier dans le studio</Link>}
                        {t.status !== "published" && <ActionForm action={setTemplateStatus.bind(null, t.id, "published")} submitLabel="Publier" className="contents" />}
                        {t.status === "published" && <>
                          <Link href={`/studio/${product?.slug}?modele=${t.slug}`} className="rounded-md border border-line bg-surface px-3 py-2">Voir comme un client</Link>
                          <ActionForm action={setTemplateStatus.bind(null, t.id, "draft")} submitLabel="Retirer de la galerie" variant="secondary" className="contents" />
                        </>}
                        {t.status !== "archived" && <ActionForm action={setTemplateStatus.bind(null, t.id, "archived")} submitLabel="Archiver" variant="secondary" className="contents" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="grid max-w-2xl gap-4">
        <h2 className="font-display text-2xl">Nouveau modèle</h2>
        <ActionForm action={createTemplate} submitLabel="Créer et ouvrir dans le studio">
          <Field label="Titre" htmlFor="title" hint="Tel que le client le verra. Ex. : Mug photo — Bonne fête maman">
            <input id="title" name="title" required minLength={2} maxLength={80} className={inputClass} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Produit" htmlFor="product_id">
              <select id="product_id" name="product_id" required className={inputClass}>
                {(products ?? []).map((p) => <option key={p.id} value={p.id}>{fr(p.name)}{p.status !== "active" ? " (brouillon)" : ""}</option>)}
              </select>
            </Field>
            <Field label="Occasion" htmlFor="occasion">
              <select id="occasion" name="occasion" required className={inputClass}>
                {Object.entries(OCCASIONS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description courte" htmlFor="description" hint="Facultatif, 300 caractères au plus.">
            <textarea id="description" name="description" rows={2} maxLength={300} className={inputClass} />
          </Field>
        </ActionForm>
      </section>
    </div>
  );
}
