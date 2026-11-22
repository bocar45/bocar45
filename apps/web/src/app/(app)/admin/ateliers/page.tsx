import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth";
import { decideVendor } from "./actions";
import { READ_FAILED, TRY_AGAIN, logError } from "@/lib/log";

export const metadata = { title: "Ateliers" };

const LABEL = { pending: "En attente", active: "Actif", suspended: "Suspendu", rejected: "Refusé" } as const;

export default async function VendorsAdmin() {
  const { supabase } = await requirePlatformRole(["ops", "vendor_manager"], "/admin/ateliers");
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, ninea, status, created_at")
    .eq("kind", "vendor")
    .order("created_at", { ascending: false });

  if (error) logError("vendors_read_failed", error);
  return (
    <div className="grid gap-6">
      <h1 className="font-display text-3xl">Ateliers</h1>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data && data.length === 0 && (
        <p className="text-muted">Aucune candidature pour l&apos;instant. Elles arrivent depuis la page « Devenir atelier partenaire ».</p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="p-2">Atelier</th><th className="p-2">NINEA</th><th className="p-2">Statut</th><th className="p-2">Reçu le</th><th className="p-2">Décision</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="border-b border-line">
                  <td className="p-2 font-semibold"><Link className="underline" href={`/admin/ateliers/${o.id}`}>{o.name}</Link></td>
                  <td className="p-2 tabular-nums">{o.ninea ?? "—"}</td>
                  <td className="p-2">{LABEL[o.status as keyof typeof LABEL]}</td>
                  <td className="p-2 tabular-nums">{new Date(o.created_at).toLocaleDateString("fr-SN")}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      {o.status !== "active" && (
                        <form action={decideVendor.bind(null, o.id, "approve")}><button className="rounded-md bg-action px-3 py-1 font-bold text-on-action">Activer</button></form>
                      )}
                      {o.status === "pending" && (
                        <form action={decideVendor.bind(null, o.id, "reject")}><button className="rounded-md border border-line px-3 py-1">Refuser</button></form>
                      )}
                      {o.status === "active" && (
                        <form action={decideVendor.bind(null, o.id, "suspend")}><button className="rounded-md border border-line px-3 py-1">Suspendre</button></form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
