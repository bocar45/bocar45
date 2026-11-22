import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth";

export const metadata = { title: "Administration" };

export default async function AdminHome() {
  const { supabase } = await requirePlatformRole(["ops", "vendor_manager", "catalog", "support", "finance"], "/admin");
  const { count, error } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("kind", "vendor")
    .eq("status", "pending");
  return (
    <div className="grid gap-6">
      <h1 className="font-display text-3xl">Administration</h1>
      {error ? (
        <p role="alert" className="text-error">⚠ Lecture impossible : {error.message}</p>
      ) : (
        <Link href="/admin/ateliers" className="w-fit rounded-lg border border-line bg-surface p-4">
          <span className="block text-sm text-muted">Candidatures d&apos;ateliers à traiter</span>
          <b className="text-2xl tabular-nums">{count ?? 0}</b>
        </Link>
      )}
    </div>
  );
}
