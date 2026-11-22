import Link from "next/link";
import { hasPlatformRole, requirePlatformRole } from "@/lib/auth";

export const metadata = { title: "Administration" };

export default async function AdminHome() {
  const { supabase, memberships } = await requirePlatformRole(["ops", "vendor_manager", "catalog", "support", "finance"], "/admin");
  const can = (r: Parameters<typeof hasPlatformRole>[1]) => hasPlatformRole(memberships, r);
  const [pending, products, rules, toPay, templates] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("kind", "vendor").eq("status", "pending"),
    supabase.from("base_products").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("price_rule_sets").select("version").eq("status", "active").maybeSingle(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "awaiting_payment"),
    supabase.from("templates").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);
  const tiles = [
    can(["ops", "support", "finance"]) && { href: "/admin/commandes", label: "Commandes à encaisser", value: String(toPay.count ?? 0) },
    can(["ops", "vendor_manager"]) && { href: "/admin/ateliers", label: "Candidatures d'ateliers à traiter", value: String(pending.count ?? 0) },
    can(["catalog", "ops", "vendor_manager"]) && { href: "/admin/catalogue", label: "Produits publiés", value: String(products.count ?? 0) },
    can(["catalog"]) && { href: "/admin/modeles", label: "Modèles prêts à personnaliser publiés", value: String(templates.count ?? 0) },
    can(["finance", "ops", "catalog"]) && { href: "/admin/regles-prix", label: "Règles de prix actives", value: rules.data ? `v${rules.data.version}` : "aucune" },
  ].filter(Boolean) as { href: string; label: string; value: string }[];
  return (
    <div className="grid gap-6">
      <h1 className="font-display text-3xl">Administration</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="grid gap-1 rounded-lg border border-line bg-surface p-4">
            <span className="text-sm text-muted">{t.label}</span>
            <b className="text-2xl tabular-nums">{t.value}</b>
          </Link>
        ))}
      </div>
    </div>
  );
}
