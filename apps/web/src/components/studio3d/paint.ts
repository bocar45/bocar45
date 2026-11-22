import { FONTS, visibleLayers, type Layer, type Surface } from "@sawwa/design";

/**
 * Paints studio surfaces onto a 2D canvas (browser only), with the page's real fonts: this canvas becomes the texture
 * of the 3D model. Same geometry as the studio and the production renderer: mm, layer centre, rotation in degrees.
 */

export type ImageCache = Map<string, HTMLImageElement>;

/** Resolve the actual font-family behind the CSS variables set by next/font (e.g. --font-anton). */
export function resolveFontFamily(css: string, el: Element): string {
  return css.replace(/var\((--[\w-]+)\)/g, (_, name: string) => getComputedStyle(el).getPropertyValue(name).trim() || "sans-serif");
}

export async function loadImages(urls: Record<string, string>, cache: ImageCache): Promise<void> {
  await Promise.all(Object.entries(urls).map(([src, url]) => {
    if (!url || cache.get(src)?.src === url) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { cache.set(src, img); resolve(); };
      img.onerror = () => resolve();
      img.src = url;
    });
  }));
}

function drawLayer(ctx: CanvasRenderingContext2D, l: Layer, images: ImageCache, fontEl: Element) {
  ctx.save();
  ctx.translate(l.xMm, l.yMm);
  ctx.rotate((l.rotation * Math.PI) / 180);
  if (l.type === "text") {
    const f = FONTS[l.font];
    ctx.font = `${l.italic ? "italic " : ""}${f.weight} ${l.sizeMm}px ${resolveFontFamily(f.css, fontEl)}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx && l.letterSpacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${l.letterSpacing * l.sizeMm}px`;
    ctx.fillStyle = l.fill;
    ctx.fillText(l.text, 0, 0);
  } else if (l.type === "image") {
    const img = images.get(l.src);
    if (img) ctx.drawImage(img, -l.widthMm / 2, -l.heightMm / 2, l.widthMm, l.heightMm);
  } else {
    ctx.fillStyle = l.fill;
    ctx.beginPath();
    const w = l.widthMm, h = l.heightMm;
    if (l.shape === "circle") ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (l.shape === "losange") { ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, 0); ctx.lineTo(0, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath(); }
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw one surface into a zone whose top-left corner is (x, y) in the canvas' current units (mm), clipped to the zone.
 * The caller has already scaled the context to pixels-per-mm.
 */
export function drawSurface(
  ctx: CanvasRenderingContext2D, surface: Surface, zone: { x: number; y: number; w: number; h: number },
  images: ImageCache, fontEl: Element,
) {
  ctx.save();
  ctx.translate(zone.x, zone.y);
  ctx.beginPath();
  ctx.rect(0, 0, zone.w, zone.h);
  ctx.clip();
  for (const l of visibleLayers(surface)) drawLayer(ctx, l, images, fontEl);
  ctx.restore();
}

/** Base colour, plus a subtle knit texture for textiles (mm units). */
export function drawFabric(ctx: CanvasRenderingContext2D, hex: string, w: number, h: number, x0: number, y0: number, knit = true) {
  ctx.fillStyle = hex;
  ctx.fillRect(x0, y0, w, h);
  if (!knit) return;
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#000";
  for (let y = y0; y < y0 + h; y += 3) ctx.fillRect(x0, y, w, 1);
  ctx.globalAlpha = 1;
}
