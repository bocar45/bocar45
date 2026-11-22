"use client";

import { useState } from "react";
import { ProductArt, tileFor, type ArtKind } from "./product-art";

export function ProductShowcase({ kind, colors, name }: { kind: ArtKind; colors: { key: string; hex: string; sizes: string[] }[]; name: string }) {
  const [i, setI] = useState(0);
  const c = colors[i] ?? { key: "ivoire", hex: "#F2E9D8", sizes: [] };
  const dark = ["#2A1A12", "#24221F", "#000000", "#1C120C"].includes(c.hex.toUpperCase());
  return (
    <div className="grid gap-5">
      <div className={`trame relative grid aspect-square place-items-center overflow-hidden rounded-[32px] transition-colors duration-300 ${tileFor(c.hex)}`}>
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
