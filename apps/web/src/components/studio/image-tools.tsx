"use client";

import { useState } from "react";
import type { ImageLayer, Layer, VectorLayer } from "@sawwa/design";
import { putAsset } from "./asset-store";
import { TRACE_KEY, borderColor, dominantColors, cropPercent, flattenTransparency, halftone, hexToRgb, invert, opaqueBounds, crop, pixels, removeColor, tracedPaths, type Pixels, type Rect } from "./image-ops";

const MAX_SIDE = 4000; // processing limit in the browser; the print check still reports the resulting resolution
const field = "w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm";
const btn = "inline-flex items-center justify-center gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-sable disabled:opacity-40";

async function decode(url: string): Promise<Pixels> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return pixels(w, h, ctx.getImageData(0, 0, w, h).data);
}

async function encode(px: Pixels): Promise<{ src: string; url: string }> {
  const c = document.createElement("canvas");
  c.width = px.width; c.height = px.height;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/png"));
  const id = (crypto.randomUUID?.() ?? `${Date.now()}`).replace(/-/g, "").slice(0, 20);
  await putAsset(id, blob).catch(() => undefined);
  return { src: `idb:${id}`, url: URL.createObjectURL(blob) };
}

/** Layer geometry after keeping only `r` (source pixels) of an image: same mm per pixel, same place on the product. */
function croppedGeometry(l: ImageLayer, srcW: number, srcH: number, r: Rect) {
  const mmX = l.widthMm / srcW, mmY = l.heightMm / srcH;
  const dx = (r.x + r.w / 2 - srcW / 2) * mmX, dy = (r.y + r.h / 2 - srcH / 2) * mmY;
  const a = (l.rotation * Math.PI) / 180;
  return { widthMm: r.w * mmX, heightMm: r.h * mmY, xMm: l.xMm + dx * Math.cos(a) - dy * Math.sin(a), yMm: l.yMm + dx * Math.sin(a) + dy * Math.cos(a) };
}

export function ImageTools({ layer, url, onReplace, onUrl }: {
  layer: ImageLayer; url: string | undefined;
  onReplace: (next: Layer) => void; onUrl: (src: string, url: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(20);
  const [cut, setCut] = useState({ left: 0, right: 0, top: 0, bottom: 0 });
  const [pitch, setPitch] = useState(1.5);
  const [ink, setInk] = useState("#2A1A12");
  const [colors, setColors] = useState(3);
  const [dropBg, setDropBg] = useState(true);

  const run = async (label: string, op: (px: Pixels) => Promise<void>) => {
    if (!url) { setError("Image indisponible : rechargez la page."); return; }
    setBusy(label); setError(null);
    try { await op(await decode(url)); } catch { setError("Cette opération n'a pas pu être appliquée à l'image. Essayez avec une autre image ou un autre réglage."); }
    finally { setBusy(null); }
  };
  const replacePixels = async (px: Pixels, name: string, geometry?: Partial<ImageLayer>) => {
    const out = await encode(px);
    onUrl(out.src, out.url);
    onReplace({ ...layer, ...geometry, src: out.src, name, pxWidth: px.width, pxHeight: px.height });
  };
  const base = layer.name.replace(/\.[a-z]+$/i, "");

  return (
    <section className="grid gap-3 rounded-xl border border-line p-3" aria-label="Outils d'image">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Outils d&apos;image</h3>
      <div className="grid gap-2">
        <label className="grid gap-1 text-xs font-semibold text-muted">Tolérance du fond ({tolerance})
          <input type="range" min={2} max={60} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!!busy} onClick={() => run("fond", async (px) => {
            const out = removeColor(px, borderColor(px), tolerance);
            const b = opaqueBounds(out);
            if (!b) throw new Error("empty");
            await replacePixels(crop(out, b), `${base}-sans-fond.png`, croppedGeometry(layer, px.width, px.height, b));
          })}>Retirer le fond</button>
          <button type="button" className={btn} disabled={!!busy} onClick={() => run("inverser", async (px) => replacePixels(invert(px), `${base}-inverse.png`))}>Inverser</button>
          <button type="button" className={btn} disabled={!!busy} onClick={() => run("rogner", async (px) => {
            const b = opaqueBounds(px);
            if (!b) throw new Error("empty");
            await replacePixels(crop(px, b), `${base}-rogne.png`, croppedGeometry(layer, px.width, px.height, b));
          })}>Rogner les bords vides</button>
        </div>
      </div>

      <details className="grid gap-2">
        <summary className="cursor-pointer text-sm font-semibold">Recadrer</summary>
        <div className="grid grid-cols-4 gap-2 pt-2">
          {(["left", "right", "top", "bottom"] as const).map((k) => (
            <label key={k} className="grid gap-1 text-xs text-muted">{({ left: "Gauche", right: "Droite", top: "Haut", bottom: "Bas" } as const)[k]} %
              <input type="number" min={0} max={45} value={cut[k]} className={field} onChange={(e) => setCut((c) => ({ ...c, [k]: Math.max(0, Math.min(45, Number(e.target.value) || 0)) }))} />
            </label>
          ))}
        </div>
        <button type="button" className={`${btn} w-fit`} disabled={!!busy} onClick={() => run("recadrer", async (px) => {
          const out = cropPercent(px, cut);
          const r: Rect = { x: px.width * cut.left / 100, y: px.height * cut.top / 100, w: out.width, h: out.height };
          await replacePixels(out, `${base}-recadre.png`, croppedGeometry(layer, px.width, px.height, r));
          setCut({ left: 0, right: 0, top: 0, bottom: 0 });
        })}>Appliquer le recadrage</button>
      </details>

      <details className="grid gap-2">
        <summary className="cursor-pointer text-sm font-semibold">Effet trame (sérigraphie, DTF)</summary>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <label className="grid gap-1 text-xs text-muted">Pas des points (mm)
            <input type="number" min={0.5} max={5} step={0.5} value={pitch} className={field} onChange={(e) => setPitch(Math.max(0.5, Math.min(5, Number(e.target.value) || 1.5)))} />
          </label>
          <label className="grid gap-1 text-xs text-muted">Couleur d&apos;encre
            <input type="color" value={ink} onChange={(e) => setInk(e.target.value.toUpperCase())} className="h-8 w-full cursor-pointer rounded border border-line" />
          </label>
        </div>
        <button type="button" className={`${btn} w-fit`} disabled={!!busy} onClick={() => run("trame", async (px) => {
          const pxPerMm = px.width / layer.widthMm;
          await replacePixels(halftone(px, pitch * pxPerMm, hexToRgb(ink)), `${base}-trame.png`);
        })}>Appliquer la trame</button>
      </details>

      <details className="grid gap-2">
        <summary className="cursor-pointer text-sm font-semibold">Vectoriser en aplats (broderie, sérigraphie)</summary>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <label className="grid gap-1 text-xs text-muted">Nombre de couleurs
            <input type="number" min={2} max={6} value={colors} className={field} onChange={(e) => setColors(Math.max(2, Math.min(6, Number(e.target.value) || 3)))} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs"><input type="checkbox" checked={dropBg} onChange={(e) => setDropBg(e.target.checked)} /> Retirer le fond</label>
        </div>
        <button type="button" className={`${btn} w-fit`} disabled={!!busy} onClick={() => run("vectoriser", async (px) => {
          const { default: ImageTracer } = await import("imagetracerjs");
          // trace at ≤ 1000 px: plenty for a logo, fast in the browser
          const s = Math.min(1, 1000 / Math.max(px.width, px.height));
          let src = flattenTransparency(px);
          if (s < 1) {
            const c = document.createElement("canvas");
            c.width = Math.round(px.width * s); c.height = Math.round(px.height * s);
            const tmp = document.createElement("canvas"); tmp.width = px.width; tmp.height = px.height;
            tmp.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(src.data), src.width, src.height), 0, 0);
            const ctx = c.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(tmp, 0, 0, c.width, c.height);
            src = pixels(c.width, c.height, ctx.getImageData(0, 0, c.width, c.height).data);
          }
          // Exact palette: the logo's own colours (+ background or transparency key, dropped afterwards).
          const bg = borderColor(src);
          const isKey = Math.hypot(bg[0] - TRACE_KEY[0], bg[1] - TRACE_KEY[1], bg[2] - TRACE_KEY[2]) < 60;
          const opaque = removeColor(src, isKey ? TRACE_KEY : bg, 12, false);
          const palette = [...dominantColors(opaque, colors), isKey ? TRACE_KEY : bg];
          const svg = ImageTracer.imagedataToSVG(src, {
            pal: palette.map(([r, g, b]) => ({ r, g, b, a: 255 })), colorquantcycles: 1,
            pathomit: 8, ltres: 1, qtres: 1, roundcoords: 1, blurradius: 0, strokewidth: 0, viewbox: true,
          });
          const paths = tracedPaths(svg, dropBg && !isKey ? bg : null);
          if (paths.length === 0) throw new Error("no paths");
          const vector: VectorLayer = {
            id: layer.id, type: "vector", name: `${base} (vectoriel)`, viewWidth: src.width, viewHeight: src.height, paths,
            xMm: layer.xMm, yMm: layer.yMm, rotation: layer.rotation, widthMm: layer.widthMm, heightMm: layer.heightMm,
            ...(layer.hidden ? { hidden: true } : {}), ...(layer.locked ? { locked: true } : {}),
          };
          onReplace(vector);
        })}>Vectoriser</button>
        <p className="text-xs text-muted">Idéal pour un logo simple. Le résultat est net à toutes les tailles ; vous pouvez ensuite changer chaque couleur.</p>
      </details>

      {busy && <p role="status" className="text-xs text-muted">Traitement en cours…</p>}
      {error && <p role="alert" className="text-xs text-error">⚠ {error}</p>}
    </section>
  );
}
