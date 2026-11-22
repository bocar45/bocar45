import { motifCover, motifFrame, motifTile, pathD, piecePolygons, type AllOver, type FontKey, type Layer, type PatternSpec, type Surface, visibleLayers } from "@sawwa/design";

/** Font files used for production rendering (static instances, see fonts/README.md). */
export const PRODUCTION_FONTS: Record<FontKey, { family: string; weight: number; italicFile?: string; file: string }> = {
  manrope: { family: "Manrope", weight: 800, file: "Manrope-ExtraBold.ttf" },
  fraunces: { family: "Fraunces", weight: 600, file: "Fraunces-SemiBold.ttf", italicFile: "Fraunces-SemiBoldItalic.ttf" },
  anton: { family: "Anton", weight: 400, file: "Anton-Regular.ttf" },
  playfair: { family: "Playfair Display", weight: 700, file: "PlayfairDisplay-Bold.ttf", italicFile: "PlayfairDisplay-BoldItalic.ttf" },
  caveat: { family: "Caveat", weight: 700, file: "Caveat-Bold.ttf" },
  grotesk: { family: "Space Grotesk", weight: 700, file: "SpaceGrotesk-Bold.ttf" },
};

export const fontFiles = () => [...new Set(Object.values(PRODUCTION_FONTS).flatMap((f) => [f.file, ...(f.italicFile ? [f.italicFile] : [])]))];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => Number(n.toFixed(3)).toString();

function layerSvg(l: Layer, images: Record<string, string>): string {
  const t = `translate(${num(l.xMm)} ${num(l.yMm)}) rotate(${num(l.rotation)})`;
  if (l.type === "text") {
    const f = PRODUCTION_FONTS[l.font];
    // No italic file for this font: synthetic slant, as the browser does in the studio.
    const synthetic = l.italic && !f.italicFile ? " skewX(-12)" : "";
    const spacing = l.letterSpacing ? ` letter-spacing="${num(l.letterSpacing * l.sizeMm)}"` : "";
    return `<g transform="${t}${synthetic}"><text text-anchor="middle" dominant-baseline="central" font-family="${esc(f.family)}" font-weight="${f.weight}"${l.italic && f.italicFile ? ' font-style="italic"' : ""} font-size="${num(l.sizeMm)}" fill="${esc(l.fill)}"${spacing}>${esc(l.text)}</text></g>`;
  }
  if (l.type === "image") {
    const href = images[l.src];
    if (!href) throw new Error(`missing image ${l.src}`);
    return `<g transform="${t}"><image href="${esc(href)}" x="${num(-l.widthMm / 2)}" y="${num(-l.heightMm / 2)}" width="${num(l.widthMm)}" height="${num(l.heightMm)}" preserveAspectRatio="none"/></g>`;
  }
  if (l.type === "vector") {
    // Paths were validated (isSafePathData) when the document was parsed; attributes are escaped anyway.
    const paths = l.paths.map((p) => `<path d="${esc(p.d)}" fill="${esc(p.fill)}"/>`).join("");
    return `<g transform="${t}"><svg x="${num(-l.widthMm / 2)}" y="${num(-l.heightMm / 2)}" width="${num(l.widthMm)}" height="${num(l.heightMm)}" viewBox="0 0 ${num(l.viewWidth)} ${num(l.viewHeight)}" preserveAspectRatio="none">${paths}</svg></g>`;
  }
  const w = l.widthMm, h = l.heightMm;
  const shape = l.shape === "circle"
    ? `<ellipse rx="${num(w / 2)}" ry="${num(h / 2)}" fill="${esc(l.fill)}"/>`
    : l.shape === "losange"
      ? `<polygon points="0,${num(-h / 2)} ${num(w / 2)},0 0,${num(h / 2)} ${num(-w / 2)},0" fill="${esc(l.fill)}"/>`
      : `<rect x="${num(-w / 2)}" y="${num(-h / 2)}" width="${num(w)}" height="${num(h)}" fill="${esc(l.fill)}"/>`;
  return `<g transform="${t}">${shape}</g>`;
}

/**
 * Production SVG of one zone: real size in mm (viewBox), pixel size for the requested resolution,
 * transparent background, clipped to the zone. Same geometry as the studio.
 */
export function renderSurfaceSvg(
  surface: Surface, zone: { maxWidthMm: number; maxHeightMm: number; pattern?: PatternSpec | null },
  opts: { dpi: number; images: Record<string, string>; allOver?: AllOver | null; mirror?: boolean; cutLine?: boolean },
) {
  const W = zone.maxWidthMm, H = zone.maxHeightMm;
  const widthPx = Math.round((W / 25.4) * opts.dpi);
  const heightPx = Math.round((H / 25.4) * opts.dpi);
  const p = zone.pattern ?? null;
  // the second piece of a left/right pair is the mirror image (outline and designs), the cut line is for the sheet only
  const flip = opts.mirror ? ` transform="matrix(-1 0 0 1 ${W} 0)"` : "";
  // E18b: a pattern piece is printed up to its bleed line; the continuous motif goes underneath, anchored on the garment
  const clip = p ? `<path d="${pathD(piecePolygons(p).print)}"${flip}/>` : `<rect width="${W}" height="${H}"/>`;
  let defs = `<clipPath id="z">${clip}</clipPath>`;
  let background = "";
  if (p && opts.allOver) {
    const t = motifTile(opts.allOver);
    const f = motifFrame(p, W, Boolean(opts.mirror));
    const c = motifCover(f, W, H);
    defs += `<pattern id="m" patternUnits="userSpaceOnUse" x="0" y="0" width="${num(t.size)}" height="${num(t.size)}"><rect width="${num(t.size)}" height="${num(t.size)}" fill="${esc(t.background)}"/>${t.shapes.map((s) => `<path d="${esc(s.d)}" fill="${esc(s.fill)}"/>`).join("")}</pattern>`;
    background = `<g transform="matrix(${f.s} 0 0 1 ${num(f.tx)} ${num(f.ty)})"><rect x="${num(c.x)}" y="${num(c.y)}" width="${num(c.w)}" height="${num(c.h)}" fill="url(#m)"/></g>`;
  }
  const body = visibleLayers(surface).map((l) => layerSvg(l, opts.images)).join("");
  const cut = p && opts.cutLine ? `<path d="${pathD(piecePolygons(p).cut)}" fill="none" stroke="#B5562A" stroke-width="${num(Math.max(W, H) / 400)}"${flip}/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs><g clip-path="url(#z)">${background}<g${flip}>${body}</g></g>${cut}</svg>`;
  return { svg, widthPx, heightPx };
}
