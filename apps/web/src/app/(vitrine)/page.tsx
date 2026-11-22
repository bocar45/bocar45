import { jsonLd, organizationJsonLd, siteUrl } from "@/lib/seo";
import Link from "next/link";
import { ProductArt, type ArtKind } from "@/components/product-art";

const OCCASIONS = ["Tabaski", "Mariages", "Navétanes", "Baptêmes", "Korité", "Rentrée", "Magal", "Anniversaires", "Entreprises", "Associations", "Fin d'année", "Saint-Valentin"];

const UNIVERS: { slug: string; title: string; text: string; bg: string; fg: string; art: ArtKind; artColor: string; ink: string }[] = [
  { slug: "vetements", title: "Vêtements", text: "T-shirts, hoodies, polos — brodés ou imprimés.", bg: "bg-terra", fg: "text-ivoire", art: "tee", artColor: "#F2E9D8", ink: "#2A1A12" },
  { slug: "accessoires", title: "Accessoires", text: "Casquettes, tote bags, bonnets.", bg: "bg-indigo", fg: "text-ivoire", art: "cap", artColor: "#C9923E", ink: "#2A1A12" },
  { slug: "cadeaux-photo", title: "Cadeaux photo", text: "Mugs, coussins, souvenirs à offrir.", bg: "bg-ocre", fg: "text-brun", art: "mug", artColor: "#FBF7EF", ink: "#2A1A12" },
  { slug: "objets", title: "Objets", text: "Gourdes, carnets, objets d'entreprise.", bg: "bg-olive", fg: "text-ivoire", art: "bottle", artColor: "#2A1A12", ink: "#F2E9D8" },
];

const STEPS = [
  { n: "01", title: "Choisir", text: "Un produit, une couleur, une technique : impression ou broderie." },
  { n: "02", title: "Créer", text: "Votre texte, votre logo, vos photos dans le studio — ou un modèle prêt à personnaliser." },
  { n: "03", title: "Vérifier", text: "L'atelier contrôle votre fichier avant de produire. Rien ne part sans bon à tirer." },
  { n: "04", title: "Recevoir", text: "Livré à Dakar et dans les régions, ou à retirer en point relais." },
];

export default function Home() {
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd(siteUrl())) }} />
      {/* Hero */}
      <section className="trame relative overflow-hidden bg-brun text-ivoire">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="grid gap-8">
            <p className="eyebrow flex items-center gap-3 text-ocre"><span className="losange" aria-hidden="true" /> Studio de création · Dakar</p>
            <h1 className="display text-[clamp(3.2rem,8vw,6.5rem)]">
              Donner forme <em>aux idées.</em>
            </h1>
            <p className="max-w-xl text-lg text-ivoire/75">
              Vos t-shirts, hoodies, casquettes et mugs, imaginés par vous, vérifiés et fabriqués par nos ateliers partenaires. Pour une
              personne, une équipe ou toute une entreprise.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/catalogue" className="btn btn-terra">Explorer le catalogue <span aria-hidden="true">→</span></Link>
              <Link href="/catalogue#equipes" className="btn btn-ghost-light">Commande d&apos;équipe</Link>
            </div>
            <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-ivoire/85">
              {["BAT vérifié par l'atelier", "Wave · Orange Money · carte", "Fabriqué à Dakar"].map((t) => (
                <li key={t} className="flex items-center gap-2"><span className="losange !h-2 !w-2" aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[560px]" aria-hidden="true">
            <div className="absolute inset-[6%] rounded-full bg-terra" />
            <div className="absolute inset-[6%] rounded-full border-[10px] border-ocre/40 [clip-path:inset(0_0_50%_0)]" />
            <ProductArt kind="tee" color="#F2E9D8" className="absolute left-[12%] top-[8%] w-[72%] drop-shadow-2xl" />
            <ProductArt kind="mug" color="#FBF7EF" className="absolute bottom-[2%] right-[0%] w-[38%] drop-shadow-xl" />
            <ProductArt kind="cap" color="#2F4B7C" ink="#F2E9D8" className="absolute bottom-[6%] left-[-2%] w-[36%] drop-shadow-xl" />
            <span className="absolute right-[2%] top-[14%] rotate-3 rounded-full bg-ivoire px-4 py-2 text-sm font-extrabold text-brun shadow-lg">Brodé · 8 couleurs</span>
            <span className="absolute left-[2%] top-[46%] -rotate-3 rounded-full bg-ocre px-4 py-2 text-sm font-extrabold text-brun shadow-lg">Aperçu en 3D</span>
          </div>
        </div>
      </section>
      <div className="bande" aria-hidden="true" />

      {/* Occasions */}
      <section aria-label="Occasions" className="overflow-hidden bg-ocre py-4 text-brun">
        <div className="marquee">
          {[...OCCASIONS, ...OCCASIONS].map((o, i) => (
            <span key={i} className="display flex items-center gap-12 whitespace-nowrap text-3xl italic">
              {o} <span className="losange !bg-brun !h-3 !w-3" aria-hidden="true" />
            </span>
          ))}
        </div>
      </section>

      {/* Univers */}
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="display on-light max-w-2xl text-5xl md:text-6xl">Tout ce qui peut porter <em>une idée.</em></h2>
          <Link href="/catalogue" className="font-bold underline decoration-terra decoration-2 underline-offset-4">Voir tout le catalogue</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {UNIVERS.map((u) => (
            <Link key={u.slug} href={`/catalogue/${u.slug}`} className={`group relative grid min-h-[380px] content-between overflow-hidden rounded-[28px] p-6 ${u.bg} ${u.fg}`}>
              <div className="trame absolute inset-0 opacity-60" aria-hidden="true" />
              <div className="relative grid gap-2">
                <h3 className="display text-4xl">{u.title}</h3>
                <p className="text-sm opacity-80">{u.text}</p>
              </div>
              <ProductArt kind={u.art} color={u.artColor} ink={u.ink} className="relative mx-auto w-[78%] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105 motion-reduce:transition-none" />
              <span className="relative font-bold">Découvrir →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="bg-sable/60">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24">
          <div className="grid gap-3">
            <p className="eyebrow flex items-center gap-3 text-terra"><span className="losange" aria-hidden="true" /> Comment ça marche</p>
            <h2 className="display on-light max-w-3xl text-5xl">De l&apos;idée à l&apos;objet, <em>sans mauvaise surprise.</em></h2>
          </div>
          <ol className="grid gap-8 md:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="grid content-start gap-3 border-t-2 border-brun pt-5">
                <span className="display text-6xl italic text-terra">{s.n}</span>
                <b className="text-xl">{s.title}</b>
                <p className="text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Équipes */}
      <section className="trame bg-indigo-900 text-ivoire">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 lg:grid-cols-2">
          <div className="grid gap-6">
            <p className="eyebrow text-ocre">Équipes · associations · entreprises</p>
            <h2 className="display text-5xl md:text-6xl">Votre équipe, <em>vos couleurs.</em></h2>
            <p className="max-w-lg text-ivoire/75">Maillots de Navétanes, tenues d&apos;association, polos brodés pour l&apos;entreprise : un seul design, toutes les tailles, des noms et numéros pour chacun.</p>
            <dl className="grid grid-cols-2 gap-6">
              {[["10+", "pièces : prix dégressifs automatiques"], ["S → 5XL", "répartition par tailles en une commande"], ["Noms", "et numéros individuels"], ["50 %", "d'acompte pour les grosses commandes"]].map(([k, v]) => (
                <div key={k} className="grid gap-1 border-l-2 border-ocre pl-4">
                  <dt className="display text-4xl">{k}</dt>
                  <dd className="text-sm text-ivoire/70">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href="/catalogue#equipes" className="btn btn-ivoire w-fit">Préparer une commande d&apos;équipe</Link>
          </div>
          <div className="relative flex items-end justify-center gap-2" aria-hidden="true">
            <ProductArt kind="tee" color="#B5562A" ink="#F2E9D8" className="w-1/3 -rotate-6" />
            <ProductArt kind="tee" color="#F2E9D8" className="w-[38%] -translate-y-6" />
            <ProductArt kind="tee" color="#C9923E" className="w-1/3 rotate-6" />
          </div>
        </div>
      </section>

      {/* Ateliers */}
      <section className="mx-auto max-w-7xl px-4 pt-24">
        <div className="trame relative grid gap-6 overflow-hidden rounded-[32px] bg-terra p-10 text-ivoire md:grid-cols-[1.3fr_auto] md:items-center md:p-14">
          <div className="grid gap-4">
            <p className="eyebrow text-brun">Imprimeurs · brodeurs · ateliers</p>
            <h2 className="display text-4xl md:text-5xl">Vous avez un atelier ? <em className="!text-brun">Recevez des commandes payées d&apos;avance.</em></h2>
            <p className="max-w-xl text-ivoire/85">Fichiers prêts à produire, fiche technique claire, paiement par Wave, Orange Money ou virement. Sans abonnement.</p>
          </div>
          <Link href="/pro/candidature" className="btn btn-brun w-fit">Devenir atelier partenaire</Link>
        </div>
      </section>
    </>
  );
}
