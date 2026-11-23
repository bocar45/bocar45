"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductPhoto } from "@/lib/product-photos";
import { ProductArt, tileFor, type ArtKind } from "./product-art";

export function ProductShowcase({ kind, colors, name, photo }: { kind: ArtKind; colors: { key: string; hex: string; sizes: string[] }[]; name: string; photo?: ProductPhoto | null }) {
  const [i, setI] = useState(0);
  const c = colors[i] ?? { key: "ivoire", hex: "#F2E9D8", sizes: [] };
  const dark = ["#2A1A12", "#24221F", "#000000", "#1C120C"].includes(c.hex.toUpperCase());
  return (
    <div className="grid gap-5">
      {photo && (
        <div className="relative aspect-[4/5] overflow-hidden rounded-[32px] bg-sable">
          <Image src={photo.src} alt={photo.alt} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          <span className="absolute left-4 top-4 rounded-full bg-ivoire px-3 py-1 text-xs font-bold text-brun">Produit vierge · personnalisé dans le studio</span>
        </div>
      )}
      <div className={`trame relative ${photo ? "hidden" : "grid"} aspect-square place-items-center overflow-hidden rounded-[32px] transition-colors duration-300 ${tileFor(c.hex)}`}>
        <div className="absolute inset-[12%] rounded-full bg-brun/25" aria-hidden="true" />
        <ProductArt kind={kind} color={c.hex} ink={dark ? "#F2E9D8" : "#2A1A12"} className="relative w-[78%] drop-shadow-2xl" label={`${name}, couleur ${c.key.replace(/_/g, " ")}`} />
        <span className="absolute left-4 top-4 rounded-full bg-ivoire px-3 py-1 text-xs font-bold text-brun">Aperçu illustré · exemple de design</span>
      </div>
      {colors.length > 0 && (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-bold">Couleur : <span className="font-normal capitalize">{c.key.replace(/_/g, " ")}</span></legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((col, idx) => (
              <button key={col.key} type="button" onClick={() => setI(idx)} aria-pressed={idx === i} aria-label={col.key.replace(/_/g, " ")}
                className={`size-10 rounded-full border-2 ${idx === i ? "border-terra ring-2 ring-terra ring-offset-2 ring-offset-ivoire" : "border-brun/20"}`}
                style={{ background: col.hex }} />
            ))}
          </div>
          {c.sizes.length > 0 && <p className="text-sm text-muted">Tailles : {c.sizes.join(" · ")}</p>}
        </fieldset>
      )}
    </div>
  );
}
