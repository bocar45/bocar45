import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PageHeader, Section, fr, inputClass } from "@/components/ui";
import { requireActiveVendor } from "@/lib/vendor";
import { saveStorefront } from "./actions";

export const metadata = { title: "Ma boutique" };

/** E27: the workshop's white-label storefront (SAWWA Business), self-service. */
export default async function MyStorefront() {
  const { supabase, vendor, canManage } = await requireActiveVendor("/pro/boutique");
  const [{ data: shop }, { data: offers }] = await Promise.all([
    supabase.from("storefronts").select("slug, name, tagline, theme, contact_phone, product_ids, status, is_demo").eq("vendor_id", vendor.id).order("created_at").limit(1).maybeSingle(),
    canManage
      ? supabase.from("vendor_offers").select("base_product_id, product:base_products(name)").eq("vendor_id", vendor.id).eq("status", "active")
      : Promise.resolve({ data: [] as { base_product_id: string; product: unknown }[] }),
  ]);
  const theme = (shop?.theme ?? { primary: "#1F2A44", accent: "#C9923E", onPrimary: "#FFFFFF" }) as { primary: string; accent: string; onPrimary: string };
  const selected = new Set<string>((shop?.product_ids as string[] | undefined) ?? []);

  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader title="Ma boutique" back={{ href: "/pro", label: vendor.name }} />
      <p className="text-sm text-muted">
        Une vitrine à votre nom et à vos couleurs : vos clients personnalisent vos produits dans le studio SAWWA, voient le prix tout de suite
        (votre grille de prix) et valident un BAT. Partagez son lien sur WhatsApp, Instagram ou votre site.
      </p>
      {shop && (
        <p className="rounded-lg border border-line bg-surface p-3 text-sm">
          {shop.status === "active" ? <>En ligne : <Link className="font-bold underline" href={`/b/${shop.slug}`}>/b/{shop.slug}</Link></> : <>Brouillon : la boutique n&apos;est pas visible du public.</>}
          {shop.is_demo && <span className="text-muted"> · boutique de démonstration</span>}
        </p>
      )}
      {!canManage ? (
        <p className="text-sm">Seuls le propriétaire et les gérants de l&apos;atelier modifient la boutique.</p>
      ) : (
        <Section title={shop ? "Modifier la boutique" : "Créer ma boutique"}>
          <ActionForm action={saveStorefront} submitLabel="Enregistrer" className="grid gap-4">
            <label className="grid gap-1 text-sm">Nom de la boutique
              <input name="name" required minLength={2} maxLength={60} defaultValue={shop?.name ?? vendor.name} className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm">Adresse (lettres, chiffres et tirets)
              <span className="flex items-center gap-1"><span className="text-muted">/b/</span><input name="slug" maxLength={40} defaultValue={shop?.slug ?? ""} placeholder="calculée à partir du nom" className={inputClass} /></span>
            </label>
            <label className="grid gap-1 text-sm">Phrase d&apos;accroche
              <input name="tagline" maxLength={140} defaultValue={shop?.tagline ?? ""} placeholder="Impression et broderie à Dakar, livré en 4 jours" className={inputClass} />
            </label>
            <div className="flex flex-wrap gap-6">
              <label className="grid gap-1 text-sm">Couleur principale<input type="color" name="primary" defaultValue={theme.primary} className="h-10 w-20" /></label>
              <label className="grid gap-1 text-sm">Couleur des boutons<input type="color" name="accent" defaultValue={theme.accent} className="h-10 w-20" /></label>
              <label className="grid gap-1 text-sm">Téléphone (facultatif)<input name="phone" inputMode="tel" defaultValue={shop?.contact_phone ?? ""} placeholder="77 123 45 67" className={inputClass} /></label>
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-bold">Produits proposés (vos offres actives)</legend>
              {(offers ?? []).length === 0 && <p className="text-sm text-muted">Aucune offre active : créez d&apos;abord vos offres dans <Link href="/pro/offres" className="underline">Mes offres et mes prix</Link>.</p>}
              {(offers ?? []).map((o) => (
                <label key={o.base_product_id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="products" value={o.base_product_id} defaultChecked={selected.has(o.base_product_id)} />
                  {fr((o.product as { name?: unknown } | null)?.name)}
                </label>
              ))}
            </fieldset>
            <label className="grid gap-1 text-sm">Statut
              <select name="status" defaultValue={shop?.status === "active" ? "active" : "draft"} className={inputClass}>
                <option value="draft">Brouillon (invisible)</option>
                <option value="active">En ligne</option>
              </select>
            </label>
          </ActionForm>
        </Section>
      )}
    </div>
  );
}
