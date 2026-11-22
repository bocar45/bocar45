import Link from "next/link";
import { TECHNIQUE_LABEL } from "@sawwa/catalog";
import { fcfa, type PublicProduct } from "@/lib/catalog-public";
import { ProductArt, artKindFor, tileFor } from "./product-art";

export function ProductCard({ product, index }: { product: PublicProduct; index: number }) {
  const first = product.colors[0];
  const bg = tileFor(first?.hex ?? "#F2E9D8", index);
  const light = first && first.hex.toUpperCase() !== "#2A1A12";
  return (
    <Link href={`/produits/${product.slug}`} className="group grid gap-4">
      <div className={`trame relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[24px] ${bg}`}>
        <ProductArt
          kind={artKindFor(`${product.slug} ${product.category.slug}`)}
          color={first?.hex ?? "#F2E9D8"}
          ink={light ? "#2A1A12" : "#F2E9D8"}
          className="w-[72%] transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-105 motion-reduce:transition-none"
        />
        {product.colors.length > 1 && (
          <span className="absolute bottom-3 left-3 flex gap-1 rounded-full bg-ivoire/90 px-2 py-1">
            {product.colors.slice(0, 6).map((c) => <span key={c.key} className="size-3 rounded-full border border-brun/20" style={{ background: c.hex }} />)}
          </span>
        )}
      </div>
      <div className="grid gap-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">{product.category.name}</span>
        <b className="text-lg leading-tight group-hover:underline">{product.name}</b>
        {product.price ? (
          <span className="text-sm">
            dès <b className="text-terra-700">{fcfa(product.price.fromUnitPrice)}</b>
            {product.price.fromQuantity > 1 && <span className="text-muted"> (min. {product.price.fromQuantity} pc)</span>}
          </span>
        ) : (
          <span className="text-sm text-muted">Bientôt disponible</span>
        )}
        {product.price && (
          <span className="text-xs text-muted">{product.price.techniques.map((t) => TECHNIQUE_LABEL[t]).join(" · ")}</span>
        )}
      </div>
    </Link>
  );
}
