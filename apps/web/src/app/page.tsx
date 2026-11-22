import Link from "next/link";

const steps = [
  { title: "Créez", text: "Choisissez un produit et ajoutez votre texte, votre logo ou vos photos dans le studio." },
  { title: "Vérifiez", text: "Un atelier partenaire contrôle votre fichier avant de produire (BAT)." },
  { title: "Recevez", text: "Fabriqué à Dakar, livré chez vous ou à retirer en point relais." },
];

export default function Home() {
  return (
    <div className="grid gap-16">
      <section className="grid max-w-3xl gap-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Donner forme aux idées</p>
        <h1 className="font-display text-5xl leading-tight">Votre idée, brodée, imprimée, livrée.</h1>
        <p className="max-w-prose text-lg text-muted">
          T-shirts, hoodies, casquettes, mugs : personnalisez, voyez le rendu, payez par Wave ou Orange Money. Un atelier
          partenaire le fabrique.
        </p>
        <p className="text-sm text-muted">Le catalogue et le studio ouvrent bientôt. Les ateliers peuvent déjà déposer leur candidature.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/pro/candidature" className="rounded-md bg-action px-4 py-3 font-bold text-on-action">
            Devenir atelier partenaire
          </Link>
        </div>
      </section>
      <section aria-labelledby="comment" className="grid gap-6">
        <h2 id="comment" className="font-display text-3xl">Comment ça marche</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="grid gap-2 rounded-xl border border-line bg-surface p-5">
              <span className="text-sm font-bold text-terra">Étape {i + 1}</span>
              <b className="text-lg">{s.title}</b>
              <p className="text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
