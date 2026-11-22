import Link from "next/link";
import { hasPlatformRole, requireUser, vendorMembership } from "@/lib/auth";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const { user, memberships } = await requireUser("/compte");
  const vendor = vendorMembership(memberships);
  const isAdmin = hasPlatformRole(memberships, ["ops", "catalog", "vendor_manager", "support", "finance"]);
  return (
    <div className="grid max-w-xl gap-6">
      <h1 className="font-display text-3xl">Mon compte</h1>
      <p className="text-muted">Connecté avec {user.phone ? `+${user.phone.replace(/^\+/, "")}` : user.email}.</p>
      <ul className="grid gap-2">
        {vendor && <li><Link className="underline" href="/pro">Espace atelier : {vendor.organization.name}</Link></li>}
        {isAdmin && <li><Link className="underline" href="/admin">Administration SAWWA</Link></li>}
      </ul>
      <form action="/deconnexion" method="post">
        <button type="submit" className="rounded-md border border-line px-4 py-2">Se déconnecter</button>
      </form>
    </div>
  );
}
