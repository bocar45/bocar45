import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { requirePlatformRole } from "@/lib/auth";
import { REQUEST_STATUS } from "@/lib/b2b";
import { READ_FAILED, logError } from "@/lib/log";

export const metadata = { title: "Devis B2B" };

export default async function AdminQuotes({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { supabase } = await requirePlatformRole(["ops", "support", "finance"], "/admin/devis");
  const { vue } = await searchParams;
  const open = vue !== "toutes";
  let q = supabase.from("quote_requests").select("id, number, organization_name, quantity, deadline, status, created_at").order("created_at", { ascending: true }).limit(200);
  if (open) q = q.in("status", ["new", "quoted"]);
  const { data, error } = await q;
  if (error) logError("admin_quotes_read_failed", error);
  const late = (at: string) => Date.now() - Date.parse(at) > 24 * 3600 * 1000;
  return (
    <div className="grid gap-6">
      <PageHeader title="Devis B2B" back={{ href: "/admin", label: "Administration" }} />
      <nav className="flex gap-2 text-sm">
        <Link href="/admin/devis" aria-current={open ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${open ? "bg-brun text-ivoire" : "border border-line"}`}>À traiter</Link>
        <Link href="/admin/devis?vue=toutes" aria-current={!open ? "page" : undefined} className={`rounded-full px-3 py-1.5 ${!open ? "bg-brun text-ivoire" : "border border-line"}`}>Toutes</Link>
      </nav>
      {error && <p role="alert" className="text-error">⚠ {READ_FAILED}</p>}
      {data?.length === 0 && <Empty>Aucune demande {open ? "à traiter" : ""}.</Empty>}
      <ul className="grid gap-2">
        {(data ?? []).map((r) => (
          <li key={r.id}>
            <Link href={`/admin/devis/${r.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-3 text-sm hover:border-terra">
              <b className="tabular-nums">{r.number}</b>
              <span>{r.organization_name} · {r.quantity} pc</span>
              {r.deadline && <span className="text-muted">pour le {new Date(r.deadline).toLocaleDateString("fr-SN")}</span>}
              {r.status === "new" && late(r.created_at) && <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-bold text-error">+24 h</span>}
              <span className="ml-auto rounded-full bg-sable px-3 py-1 text-xs font-bold">{REQUEST_STATUS[r.status] ?? r.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
