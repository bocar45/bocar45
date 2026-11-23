import Link from "next/link";
import { TECHNIQUE_LABEL } from "@sawwa/catalog";
import type { PublicProduct } from "@/lib/catalog-public";
import { categoryName, fcfaIn, l, productName, techniqueLabel, type Lang } from "@/lib/i18n";
import Image from "next/image";
import { productPhotoFor } from "@/lib/product-photos";
import { ProductArt, artKindFor, tileFor } from "./product-art";

export function ProductCard({ product, index, lang = "fr" }: { product: PublicProduct; index: number; lang?: Lang }) {
  const first = product.colors[0];
  const bg = tileFor(first?.hex ?? "#F2E9D8", index);
  const light = first && first.hex.toUpperCase() !== "#2A1A12";
  const photo = productPhotoFor(`${product.slug} ${product.category.slug}`);
  return (
    <Link href={`/produits/${product.slug}`} className="group grid gap-4">
      <div className={`trame relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[24px] ${bg}`}>
        {photo ? (
          <Image src={photo.src} alt={lang === "en" ? photo.altEn : photo.alt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
        ) : (
          <ProductArt
            kind={artKindFor(`${product.slug} ${product.category.slug}`)}
            color={first?.hex ?? "#F2E9D8"}
            ink={light ? "#2A1A12" : "#F2E9D8"}
            className="w-[72%] transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-105 motion-reduce:transition-none"
          />
        )}
        {product.colors.length > 1 && (
          <span className="absolute bottom-3 left-3 flex gap-1 rounded-full bg-ivoire/90 px-2 py-1">
            {product.colors.slice(0, 6).map((c) => <span key={c.key} className="size-3 rounded-full border border-brun/20" style={{ background: c.hex }} />)}
          </span>
        )}
      </div>
      <div className="grid gap-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">{categoryName(product.category, lang)}</span>
        <b className="text-lg leading-tight group-hover:underline">{productName(product, lang)}</b>
        {product.price ? (
          <span className="text-sm">
            {l(lang, "dès", "from")} <b className="text-terra-700">{fcfaIn(lang, product.price.fromUnitPrice)}</b>
            {product.price.fromQuantity > 1 && <span className="text-muted"> (min. {product.price.fromQuantity} pc)</span>}
          </span>
        ) : (
          <span className="text-sm text-muted">{l(lang, "Bientôt disponible", "Coming soon")}</span>
        )}
        {product.price && (
          <span className="text-xs text-muted">{product.price.techniques.map((t) => techniqueLabel(t, TECHNIQUE_LABEL[t], lang)).join(" · ")}</span>
        )}
      </div>
    </Link>
  );
}
