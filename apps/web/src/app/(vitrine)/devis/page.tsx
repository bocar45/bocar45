import { l } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { requestQuote } from "./actions";
import { QuoteForm } from "./quote-form";

export const metadata = {
  title: "Devis pour associations et entreprises",
  description: "Tenues d'équipe, t-shirts d'événement, cadeaux d'entreprise : demandez un devis, réponse sous 24 h, prix ferme 30 jours.",
};

const fr = (v: unknown) => (v && typeof v === "object" && "fr" in v ? String((v as { fr: unknown }).fr ?? "") : "");

export default async function QuotePage() {
  const lang = await getLang();
  const session = isSupabaseConfigured() ? await getSession() : null;
  let products: { id: string; name: string }[] = [];
  let designs: { id: string; title: string }[] = [];
  if (session) {
    const [{ data: p }, { data: d }] = await Promise.all([
      session.supabase.from("base_products").select("id, name").eq("status", "active").order("name"),
      session.supabase.from("designs").select("id, title").order("updated_at", { ascending: false }).limit(30),
    ]);
    products = (p ?? []).map((x) => ({ id: x.id as string, name: fr(x.name) }));
    designs = (d ?? []) as { id: string; title: string }[];
  }
  return (
    <>
      <section className="trame bg-indigo-900 text-ivoire">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 pb-12 pt-14">
          <p className="eyebrow text-ocre">{l(lang, "Équipes · associations · entreprises", "Teams · associations · companies")}</p>
          <h1 className="display text-5xl md:text-6xl">{lang === "en" ? <>One quote, <em>a firm price.</em></> : <>Un devis, <em>un prix ferme.</em></>}</h1>
          <p className="max-w-2xl text-ivoire/80">{l(lang, "Dites-nous ce qu'il vous faut. L'équipe SAWWA vous répond sous 24 h ouvrées avec un prix ferme pendant 30 jours, calculé avec les tarifs de nos ateliers partenaires.", "Tell us what you need. The SAWWA team replies within one working day with a price that holds for 30 days, based on our partner workshops' rates.")}</p>
        </div>
      </section>
      <div className="bande" aria-hidden="true" />
      <section className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
        {!session ? (
          <div className="grid gap-3 rounded-2xl border border-line bg-surface p-6">
            <p>{l(lang, "Connectez-vous avec votre numéro de téléphone pour demander un devis et le retrouver dans votre compte.", "Sign in with your phone number to request a quote and find it in your account.")}</p>
            <Link href={`/connexion?suite=${encodeURIComponent("/devis")}`} className="btn btn-terra w-fit">{l(lang, "Se connecter", "Sign in")}</Link>
          </div>
        ) : (
          <QuoteForm userId={session.user.id} products={products} designs={designs} defaultPhone={session.user.phone ? `+${session.user.phone.replace(/^\+/, "")}` : ""} action={requestQuote} />
        )}
      </section>
    </>
  );
}
