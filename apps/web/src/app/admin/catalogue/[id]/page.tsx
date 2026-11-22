import { notFound } from "next/navigation";
import { TECHNIQUES, TECHNIQUE_LABEL, publishBlockers, type Technique } from "@sawwa/catalog";
import { hasPlatformRole, requirePlatformRole } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Empty, Field, PageHeader, Section, StatusPill, fr, inputClass } from "@/components/ui";
import { addColor, addView, addZone, deleteVariant, deleteZone, setProductStatus, updateProduct } from "../actions";

export const metadata = { title: "Produit" };

type Variant = { id: string; color_key: string; color_hex: string; size: string };
type View = { id: string; key: string; mockup_assets: { label?: string } };
type Zone = { id: string; key: string; view_id: string; max_width_mm: number; max_height_mm: number; allowed_techniques: Technique[]; anchor: { label?: string; note?: string } };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, memberships } = await requirePlatformRole(["catalog", "ops", "vendor_manager"], `/admin/catalogue/${id}`);
  const canEdit = hasPlatformRole(memberships, ["catalog"]);
  const { data: p } = await supabase
    .from("base_products")
    .select("id, slug, name, description, attributes, status, variants:base_product_variants(id, color_key, color_hex, size), views:product_views(id, key, mockup_assets, sort), zones(id, key, view_id, max_width_mm, max_height_mm, allowed_techniques, anchor)")
    .eq("id", id)
    .single();
  if (!p) notFound();

  const variants = (p.variants ?? []) as Variant[];
  const views = (p.views ?? []) as View[];
  const zones = (p.zones ?? []) as Zone[];
  const attributes = (p.attributes ?? {}) as { material?: string | null; weight_gsm?: number | null };
  const colors = Object.values(
    variants.reduce<Record<string, { key: string; hex: string; items: Variant[] }>>((acc, v) => {
      (acc[v.color_key] ??= { key: v.color_key, hex: v.color_hex, items: [] }).items.push(v);
      return acc;
    }, {}),
  );
  const blockers = publishBlockers({
    name: fr(p.name), variants: variants.length, views: views.length, zones: zones.length,
    zonesWithoutTechnique: zones.filter((z) => z.allowed_techniques.length === 0).length,
  });
  const viewLabel = (viewId: string) => { const v = views.find((x) => x.id === viewId); return v?.mockup_assets?.label ?? v?.key ?? "—"; };

  return (
    <div className="grid gap-6">
      <PageHeader title={fr(p.name)} back={{ href: "/admin/catalogue", label: "Catalogue" }}>
        <StatusPill status={p.status} />
      </PageHeader>

      <Section title="Publication" id="pub">
        {p.status !== "active" && blockers.length > 0 && (
          <ul className="list-inside list-disc text-muted">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        )}
        {p.status === "active" && <p className="text-muted">Visible par les clients et proposable par les ateliers.</p>}
        {canEdit && (
          <div className="flex flex-wrap gap-3">
            {p.status !== "active" && <ActionForm action={setProductStatus.bind(null, id, "active")} submitLabel="Publier" className="contents" />}
            {p.status === "active" && <ActionForm action={setProductStatus.bind(null, id, "draft")} submitLabel="Repasser en brouillon" variant="secondary" className="contents" />}
            {p.status !== "archived" && <ActionForm action={setProductStatus.bind(null, id, "archived")} submitLabel="Archiver" variant="secondary" className="contents" />}
          </div>
        )}
      </Section>

      <Section title="Informations" id="infos">
        {canEdit ? (
          <ActionForm action={updateProduct.bind(null, id)} submitLabel="Enregistrer">
            <Field label="Nom" htmlFor="name"><input id="name" name="name" defaultValue={fr(p.name)} required className={inputClass} /></Field>
            <Field label="Description" htmlFor="description"><textarea id="description" name="description" rows={3} defaultValue={fr(p.description)} className={inputClass} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Matière" htmlFor="material"><input id="material" name="material" defaultValue={attributes.material ?? ""} className={inputClass} /></Field>
              <Field label="Grammage (g/m²)" htmlFor="weight_gsm"><input id="weight_gsm" name="weight_gsm" inputMode="numeric" defaultValue={attributes.weight_gsm ?? ""} className={inputClass} /></Field>
            </div>
          </ActionForm>
        ) : (
          <p className="text-muted">{fr(p.description) || "Pas de description."}</p>
        )}
      </Section>

      <Section title="Couleurs et tailles" id="variants">
        {colors.length === 0 && <Empty>Aucune couleur. Ajoutez par exemple « Ivoire », #F2E9D8, tailles S, M, L, XL.</Empty>}
        <ul className="grid gap-3">
          {colors.map((c) => (
            <li key={c.key} className="flex flex-wrap items-center gap-3">
              <span className="inline-block size-6 rounded-full border border-line" style={{ background: c.hex }} aria-hidden="true" />
              <b className="min-w-24">{c.key.replace(/_/g, " ")}</b>
              <span className="text-xs text-muted tabular-nums">{c.hex}</span>
              <span className="flex flex-wrap gap-2">
                {c.items.map((v) => (
                  <span key={v.id} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-sm">
                    {v.size}
                    {canEdit && <ActionForm action={deleteVariant.bind(null, id, v.id)} submitLabel="×" pendingLabel="…" variant="secondary" className="contents" />}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
        {canEdit && (
          <ActionForm action={addColor.bind(null, id)} submitLabel="Ajouter la couleur" className="grid gap-3 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end">
            <Field label="Couleur" htmlFor="color_label"><input id="color_label" name="color_label" placeholder="Ivoire" className={inputClass} /></Field>
            <Field label="Code" htmlFor="color_hex"><input id="color_hex" name="color_hex" placeholder="#F2E9D8" className={inputClass} /></Field>
            <Field label="Tailles" htmlFor="sizes"><input id="sizes" name="sizes" placeholder="S, M, L, XL" className={inputClass} /></Field>
          </ActionForm>
        )}
      </Section>

      <Section title="Vues" id="views">
        {views.length === 0 ? <Empty>Aucune vue. Ajoutez « Devant », puis « Dos »…</Empty> : (
          <p>{views.map((v) => v.mockup_assets?.label ?? v.key).join(" · ")}</p>
        )}
        {canEdit && (
          <ActionForm action={addView.bind(null, id)} submitLabel="Ajouter la vue" className="flex flex-wrap items-end gap-3">
            <Field label="Nom de la vue" htmlFor="view_label"><input id="view_label" name="view_label" placeholder="Devant" className={inputClass} /></Field>
          </ActionForm>
        )}
      </Section>

      <Section title="Zones de personnalisation" id="zones">
        {zones.length === 0 && <Empty>Aucune zone. Une zone = une surface imprimable sur une vue, avec ses dimensions maximales réelles.</Empty>}
        {zones.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="p-2">Zone</th><th className="p-2">Vue</th><th className="p-2 text-right">Max (mm)</th><th className="p-2">Techniques</th><th className="p-2" />
              </tr></thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className="border-b border-line align-top">
                    <td className="p-2"><b>{z.anchor?.label ?? z.key}</b>{z.anchor?.note && <div className="text-xs text-muted">{z.anchor.note}</div>}</td>
                    <td className="p-2">{viewLabel(z.view_id)}</td>
                    <td className="p-2 text-right tabular-nums">{z.max_width_mm} × {z.max_height_mm}</td>
                    <td className="p-2">{z.allowed_techniques.map((t) => TECHNIQUE_LABEL[t]).join(", ")}</td>
                    <td className="p-2">{canEdit && <ActionForm action={deleteZone.bind(null, id, z.id)} submitLabel="Supprimer" pendingLabel="…" variant="secondary" className="contents" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && views.length > 0 && (
          <ActionForm action={addZone.bind(null, id)} submitLabel="Ajouter la zone">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nom de la zone" htmlFor="zone_label"><input id="zone_label" name="zone_label" placeholder="Poitrine gauche" className={inputClass} /></Field>
              <Field label="Vue" htmlFor="view_id">
                <select id="view_id" name="view_id" className={inputClass}>{views.map((v) => <option key={v.id} value={v.id}>{v.mockup_assets?.label ?? v.key}</option>)}</select>
              </Field>
              <Field label="Largeur max (mm)" htmlFor="max_width_mm"><input id="max_width_mm" name="max_width_mm" inputMode="numeric" className={inputClass} /></Field>
              <Field label="Hauteur max (mm)" htmlFor="max_height_mm"><input id="max_height_mm" name="max_height_mm" inputMode="numeric" className={inputClass} /></Field>
            </div>
            <Field label="Repère de position" htmlFor="anchor" hint="Pour l'atelier. Ex. : centré, 70 mm sous le col">
              <input id="anchor" name="anchor" className={inputClass} />
            </Field>
            <fieldset className="grid gap-2">
              <legend className="font-semibold">Techniques possibles</legend>
              <div className="flex flex-wrap gap-3">
                {TECHNIQUES.map((t) => (
                  <label key={t} className="inline-flex items-center gap-2 rounded-md border border-line px-2 py-1">
                    <input type="checkbox" name="techniques" value={t} /> {TECHNIQUE_LABEL[t]}
                  </label>
                ))}
              </div>
            </fieldset>
          </ActionForm>
        )}
      </Section>
    </div>
  );
}
