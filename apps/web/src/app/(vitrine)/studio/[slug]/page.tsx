import Link from "next/link";
import { notFound } from "next/navigation";
import { Studio } from "@/components/studio/studio";
import { isSupabaseConfigured } from "@/lib/env";
import { loadStudioProduct } from "@/lib/studio-data";
import { getStudioQuote } from "./actions";

export const metadata = { title: "Studio de création" };

export default async function StudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto grid max-w-xl gap-4 px-4 py-16">
        <h1 className="display on-light text-4xl">Le studio se prépare</h1>
        <p className="text-muted">Le catalogue n&apos;est pas encore connecté. Revenez très bientôt.</p>
        <Link href="/" className="btn btn-terra w-fit">Retour à l&apos;accueil</Link>
      </div>
    );
  }
  const product = await loadStudioProduct(slug);
  if (!product || product.zones.length === 0) notFound();
  return <Studio product={product} quote={getStudioQuote} />;
}
