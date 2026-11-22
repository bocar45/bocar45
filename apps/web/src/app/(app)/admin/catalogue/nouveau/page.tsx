import { requirePlatformRole } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Field, PageHeader, fr, inputClass } from "@/components/ui";
import { createProduct } from "../actions";

export const metadata = { title: "Nouveau produit" };

export default async function NewProduct() {
  const { supabase } = await requirePlatformRole(["catalog"], "/admin/catalogue/nouveau");
  const { data: categories } = await supabase.from("categories").select("id, name").order("sort");
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title="Nouveau produit de référence" back={{ href: "/admin/catalogue", label: "Catalogue" }} />
      <ActionForm action={createProduct} submitLabel="Créer le brouillon">
        <Field label="Nom" htmlFor="name" hint="Tel que le client le verra. Ex. : T-shirt col rond 180 g">
          <input id="name" name="name" required minLength={3} className={inputClass} />
        </Field>
        <Field label="Catégorie" htmlFor="category_id">
          <select id="category_id" name="category_id" required className={inputClass}>
            {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{fr(c.name)}</option>)}
          </select>
        </Field>
        <Field label="Description" htmlFor="description">
          <textarea id="description" name="description" rows={3} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matière" htmlFor="material"><input id="material" name="material" placeholder="100 % coton" className={inputClass} /></Field>
          <Field label="Grammage (g/m²)" htmlFor="weight_gsm"><input id="weight_gsm" name="weight_gsm" inputMode="numeric" className={inputClass} /></Field>
        </div>
      </ActionForm>
    </div>
  );
}
