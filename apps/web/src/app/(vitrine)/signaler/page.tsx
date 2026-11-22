import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { getSession } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/report-reasons";
import { reportContent } from "./actions";

export const metadata = { title: "Signaler un contenu", robots: { index: false } };

const field = "w-full rounded-md border border-line bg-surface px-3 py-2";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const { modele } = await searchParams;
  if (!modele || !/^[0-9a-f-]{36}$/.test(modele)) notFound();
  const session = await getSession();
  const { data: t } = session ? await session.supabase.from("templates").select("id, title").eq("id", modele).eq("status", "published").maybeSingle() : { data: null };
  return (
    <section className="mx-auto grid max-w-xl gap-4 px-4 py-12">
      <h1 className="display on-light text-4xl">Signaler un contenu</h1>
      {!session ? (
        <p>Connectez-vous pour signaler ce contenu. <Link className="underline" href={`/connexion?suite=${encodeURIComponent(`/signaler?modele=${modele}`)}`}>Se connecter</Link></p>
      ) : !t ? (
        <p className="text-muted">Ce modèle n&apos;existe pas ou n&apos;est plus publié.</p>
      ) : (
        <>
          <p>Modèle : <b>{t.title as string}</b>. L&apos;équipe SAWWA examine chaque signalement sous 48 h et retire le contenu s&apos;il enfreint nos règles.</p>
          <ActionForm action={reportContent.bind(null, "template", t.id as string)} submitLabel="Envoyer le signalement">
            <select name="reason" required className={field} aria-label="Motif">
              {Object.entries(REPORT_REASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <textarea name="details" rows={3} maxLength={1000} className={field} placeholder="Précisez si possible (ex. : titulaire des droits, lien vers l'original)." aria-label="Détails" />
          </ActionForm>
        </>
      )}
    </section>
  );
}
