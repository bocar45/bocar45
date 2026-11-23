"use client";

import { useEffect, useRef, useState } from "react";
import type { Surface } from "@sawwa/design";
import { drawSurface, loadImages, type ImageCache } from "../studio3d/paint";
import { PORTE_AREAS } from "./porte-areas";
import { PORTE_VIEWS } from "./porte-views";

/**
 * Photo-realistic preview (studio). The customer's design is printed on a real-looking photo of the product:
 * - T-shirts: people of six skin tones (warm brown by default), AI-generated portraits, each with a garment mask so
 *   the garment colour changes instantly while keeping folds and light;
 * - other products: the real product photo.
 * The design is multiplied with the fabric on light garments (folds show through the print), laid on top with the
 * fabric's shading on dark ones. A mug is wrapped on its cylinder.
 */
export type Area = [x: number, y: number, w: number, h: number];
export interface PhotoArea { x: number; y: number; w: number; h: number; wrapVisible?: number }
export interface PersonView { key: ViewKey; src: string; mask: string; areas: Record<string, Area> }
export interface Person { key: string; label: string; tone: string; src: string; mask: string; areas: Record<string, Area>; views?: PersonView[] }
/** Turntable order: face, 3/4 right, right profile, back, left profile, 3/4 left (the person turns on the spot). */
export type ViewKey = "face" | "q3d" | "pd" | "dos" | "pg" | "q3g";
const VIEW_ORDER: ViewKey[] = ["face", "q3d", "pd", "dos", "pg", "q3g"];
const VIEW_LABEL: Record<ViewKey, string> = { face: "Face", q3d: "3/4", pd: "Profil droit", dos: "Dos", pg: "Profil gauche", q3g: "3/4" };
/** Best view to see a zone being edited. */
const VIEW_FOR_ZONE: Record<string, ViewKey> = { back_center: "dos", left_sleeve: "pg", right_sleeve: "pd", front_center: "face", chest_left: "face" };
export interface PhotoMockupSpec { src?: string; areas?: Record<string, PhotoArea>; people?: Person[]; note?: string }

const area = (a: Area): PhotoArea => ({ x: a[0], y: a[1], w: a[2], h: a[3] });

const TONES: { key: string; label: string; tone: string }[] = [
  { key: "marron-homme", label: "Marron · homme", tone: "#8B5A3C" },
  { key: "marron-femme", label: "Marron · femme", tone: "#8F5E40" },
  { key: "fonce-homme", label: "Foncé · homme", tone: "#4A2E22" },
  { key: "metisse-femme", label: "Métisse · femme", tone: "#B07A55" },
  { key: "mat-homme", label: "Mat · homme", tone: "#B98B67" },
  { key: "clair-femme", label: "Clair · femme", tone: "#E2B999" },
];

/** People wearing one garment (AI portraits, warm brown first = default). File prefix: teint (T-shirt), hoodie, sweat, polo, cap. */
function peopleFor(garment: keyof typeof PORTE_AREAS): Person[] {
  const prefix = garment === "tshirt" ? "teint" : garment;
  return TONES.map((t) => {
    const base = { ...t, src: `/porte/${prefix}-${t.key}.jpg`, mask: `/porte/${prefix}-${t.key}.mask.png`, areas: PORTE_AREAS[garment][t.key] ?? {} };
    const turn = PORTE_VIEWS[`${prefix}-${t.key}`];
    if (!turn) return base;
    const views: PersonView[] = VIEW_ORDER.flatMap((v): PersonView[] => v === "face"
      ? [{ key: v, src: base.src, mask: base.mask, areas: base.areas }]
      : turn[v] ? [{ key: v, src: `/porte/${prefix}-${t.key}-${v}.jpg`, mask: `/porte/${prefix}-${t.key}-${v}.mask.png`, areas: turn[v]! }] : []);
    return { ...base, views };
  });
}
export const PEOPLE = peopleFor("tshirt");

const PHOTOS: { test: RegExp; spec: PhotoMockupSpec }[] = [
  { test: /hood/, spec: { people: peopleFor("hoodie") } },
  { test: /sweat|pull/, spec: { people: peopleFor("sweat") } },
  { test: /polo/, spec: { people: peopleFor("polo") } },
  { test: /casquette|cap/, spec: { people: peopleFor("cap") } },
  { test: /mug|tasse/, spec: { src: "/products/mug.jpg", areas: { wrap: { x: 0.06, y: 0.57, w: 0.4, h: 0.227, wrapVisible: 0.6 } }, note: "Face avant du mug" } },
  { test: /tote|sac/, spec: { src: "/products/tote.jpg", areas: { front_center: { x: 0.28, y: 0.5, w: 0.44, h: 0.377 } } } },
  { test: /t-?shirt|tee/, spec: { people: PEOPLE } },
];

export function photoMockupFor(slug: string): PhotoMockupSpec | null {
  const s = slug.toLowerCase();
  return PHOTOS.find((p) => p.test.test(s))?.spec ?? null;
}

const imgCache = new Map<string, Promise<HTMLImageElement>>();
function loadImg(src: string): Promise<HTMLImageElement> {
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    imgCache.set(src, p);
  }
  return p;
}

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
};

interface RenderInput {
  photo: HTMLImageElement; mask: HTMLImageElement | null; areas: Record<string, PhotoArea>;
  surfaces: Surface[]; zones: { key: string; maxWidthMm: number; maxHeightMm: number }[];
  images: ImageCache; fontEl: Element; colorHex: string | undefined; activeZone: string | null;
}

/** Paints one preview into a canvas: recoloured garment (if a mask exists), then the design. */
function paint(c: HTMLCanvasElement, p: RenderInput) {
  const W = p.photo.naturalWidth, H = p.photo.naturalHeight;
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(p.photo, 0, 0);
  const color = p.colorHex && /^#[0-9A-Fa-f]{6}$/.test(p.colorHex) ? p.colorHex : "#FFFFFF";
  const light = isLight(color);

  // Garment colour: colour × fabric shading, cut by the mask. Instant (a few canvas operations).
  let shade: HTMLCanvasElement | null = null;
  if (p.mask && color.toUpperCase() !== "#FFFFFF") {
    const g = document.createElement("canvas"); g.width = W; g.height = H;
    const gx = g.getContext("2d")!;
    gx.fillStyle = color; gx.fillRect(0, 0, W, H);
    gx.globalCompositeOperation = "multiply"; gx.drawImage(p.photo, 0, 0);
    if (!light) { gx.globalCompositeOperation = "screen"; gx.globalAlpha = 0.07; gx.drawImage(p.photo, 0, 0); gx.globalAlpha = 1; }
    gx.globalCompositeOperation = "destination-in"; gx.drawImage(p.mask, 0, 0, W, H);
    ctx.drawImage(g, 0, 0);
    shade = g;
  }

  for (const s of p.surfaces) {
    const a = p.areas[s.zoneKey];
    const zone = p.zones.find((z) => z.key === s.zoneKey);
    if (!a || !zone || s.layers.length === 0) continue;
    const ppm = 3;
    const off = document.createElement("canvas");
    off.width = Math.round(zone.maxWidthMm * ppm); off.height = Math.round(zone.maxHeightMm * ppm);
    const o = off.getContext("2d")!;
    o.scale(ppm, ppm);
    drawSurface(o, s, { x: 0, y: 0, w: zone.maxWidthMm, h: zone.maxHeightMm }, p.images, p.fontEl);
    const dx = a.x * W, dy = a.y * H, dw = a.w * W, dh = a.h * H;
    ctx.save();
    if (a.wrapVisible) {
      ctx.globalCompositeOperation = "multiply";
      const ang = 1.1, slices = 120, visible = a.wrapVisible;
      for (let i = 0; i < slices; i++) {
        const u0 = -1 + (2 * i) / slices, u1 = -1 + (2 * (i + 1)) / slices;
        const t = (u: number) => 0.5 + (Math.asin(u * Math.sin(ang)) / ang) * (visible / 2);
        const sx0 = t(u0) * off.width, sx1 = t(u1) * off.width;
        ctx.globalAlpha = 0.75 + 0.25 * Math.cos(((u0 + u1) / 2) * 1.2);
        ctx.drawImage(off, sx0, 0, Math.max(1, sx1 - sx0), off.height, dx + ((u0 + 1) / 2) * dw, dy, dw / slices + 0.5, dh);
      }
    } else if (light) {
      // Light fabric: ink multiplied with the fabric, folds show through.
      ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.96;
      ctx.drawImage(off, dx, dy, dw, dh);
    } else {
      // Dark fabric: ink on top, then the fabric's light and folds over the print only.
      const t = document.createElement("canvas"); t.width = Math.round(dw); t.height = Math.round(dh);
      const tx = t.getContext("2d")!;
      tx.drawImage(off, 0, 0, t.width, t.height);
      const keep = document.createElement("canvas"); keep.width = t.width; keep.height = t.height;
      keep.getContext("2d")!.drawImage(t, 0, 0);
      // The white fabric photo carries the folds: multiply it over the ink, then keep only the ink's shape.
      tx.globalCompositeOperation = "multiply";
      tx.drawImage(p.photo, dx, dy, dw, dh, 0, 0, t.width, t.height);
      tx.globalCompositeOperation = "destination-in";
      tx.drawImage(keep, 0, 0);
      ctx.globalAlpha = 0.97; ctx.drawImage(t, dx, dy);
    }
    ctx.restore();
  }
  void shade;
  if (p.activeZone) {
    const act = p.areas[p.activeZone];
    if (act) {
      ctx.save();
      ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.strokeStyle = light ? "rgba(181,86,42,0.5)" : "rgba(255,255,255,0.45)";
      ctx.strokeRect(act.x * W, act.y * H, act.w * W, act.h * H);
      ctx.restore();
    }
  }
}

function usePreview(src: string, maskSrc: string | null) {
  const [imgs, setImgs] = useState<{ photo: HTMLImageElement; mask: HTMLImageElement | null } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([loadImg(src), maskSrc ? loadImg(maskSrc) : Promise.resolve(null)]).then(([photo, mask]) => { if (live) setImgs({ photo, mask }); }).catch(() => {});
    return () => { live = false; };
  }, [src, maskSrc]);
  return imgs;
}

function PreviewCanvas({ src, mask, areas, surfaces, zones, cache, tick, colorHex, activeZone, label, className }: {
  src: string; mask: string | null; areas: Record<string, PhotoArea>; surfaces: Surface[];
  zones: { key: string; maxWidthMm: number; maxHeightMm: number }[]; cache: ImageCache; tick: number;
  colorHex: string | undefined; activeZone: string | null; label: string; className: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const imgs = usePreview(src, mask);
  useEffect(() => {
    if (!ref.current || !imgs) return;
    paint(ref.current, { ...imgs, areas, surfaces, zones, images: cache, fontEl: ref.current, colorHex, activeZone });
  }, [imgs, areas, surfaces, zones, cache, tick, colorHex, activeZone]);
  return <canvas ref={ref} className={className} role="img" aria-label={label} />;
}

export function PhotoMockup({ spec, surfaces, zones, imageUrls, activeZone, colorHex }: {
  spec: PhotoMockupSpec;
  surfaces: Surface[];
  zones: { key: string; label: string; maxWidthMm: number; maxHeightMm: number }[];
  imageUrls: Record<string, string>;
  activeZone: string;
  colorHex?: string;
}) {
  const cache = useRef<ImageCache>(new Map());
  const [tick, setTick] = useState(0);
  const [personKey, setPersonKey] = useState(spec.people?.[0]?.key ?? "");
  const [all, setAll] = useState(false);
  useEffect(() => { let live = true; loadImages(imageUrls, cache.current).then(() => { if (live) setTick((t) => t + 1); }); return () => { live = false; }; }, [imageUrls]);

  const person = spec.people?.find((p) => p.key === personKey) ?? spec.people?.[0];
  const frames: PersonView[] = person?.views ?? (person ? [{ key: "face", src: person.src, mask: person.mask, areas: person.areas }] : []);
  const [viewKey, setViewKey] = useState<ViewKey>("face");
  const [spin, setSpin] = useState(false);
  const drag = useRef<{ x: number; idx: number } | null>(null);
  const idx = Math.max(0, frames.findIndex((f) => f.key === viewKey));
  // Editing a zone turns the person towards it (back print → back view, sleeve → profile).
  useEffect(() => {
    const want = VIEW_FOR_ZONE[activeZone];
    if (want && frames.some((f) => f.key === want)) { setViewKey(want); setSpin(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZone, personKey]);
  useEffect(() => {
    if (!spin || frames.length < 2) return;
    const t = setInterval(() => setViewKey((k) => frames[(frames.findIndex((f) => f.key === k) + 1) % frames.length]!.key), 1100);
    return () => clearInterval(t);
  }, [spin, frames]);
  const turnBy = (d: number) => { setSpin(false); setViewKey(frames[(idx + d + frames.length) % frames.length]!.key); };

  const single = frames.length <= 1;
  const toAreas = (a: Record<string, Area>) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, area(v)]));
  const areas = person ? toAreas(frames[idx]?.areas ?? person.areas) : (spec.areas ?? {});
  const shown = zones.filter((z) => areas[z.key]).map((z) => z.label);
  const recolors = Boolean(person);

  return (
    <div className="relative grid h-full grid-rows-[1fr_auto_auto] bg-[#F4F1EC]">
      <div className="relative min-h-0 touch-pan-y select-none overflow-hidden"
        onPointerDown={(e) => { if (!single) { drag.current = { x: e.clientX, idx }; setSpin(false); } }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const steps = Math.round((e.clientX - drag.current.x) / 70);
          const n = frames.length;
          setViewKey(frames[(((drag.current.idx - steps) % n) + n) % n]!.key);
        }}
        onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}
        style={{ cursor: single ? undefined : "grab" }}>
        {person ? frames.map((f, i) => (
          <PreviewCanvas key={f.key} src={f.src} mask={f.mask} areas={toAreas(f.areas)} surfaces={surfaces} zones={zones} cache={cache.current} tick={tick}
            colorHex={colorHex} activeZone={i === idx ? activeZone : null} label={`Aperçu réaliste · ${VIEW_LABEL[f.key]}`}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${i === idx ? "opacity-100" : "opacity-0"}`} />
        )) : (
          <PreviewCanvas src={spec.src ?? ""} mask={null} areas={areas} surfaces={surfaces} zones={zones} cache={cache.current} tick={tick}
            colorHex={undefined} activeZone={activeZone} label="Aperçu réaliste de votre création" className="absolute inset-0 h-full w-full object-contain" />
        )}
        <span className="absolute bottom-2 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-brun shadow">
          Aperçu réaliste{spec.note ? ` · ${spec.note}` : ""}{!single ? ` · ${VIEW_LABEL[frames[idx]!.key]}` : ""}{shown.length ? ` · ${shown.join(", ")}` : ""}
        </span>
        {!single && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 p-1 text-xs font-bold text-brun shadow">
            <button type="button" onClick={() => turnBy(-1)} aria-label="Tourner vers la gauche" className="rounded-full px-2 py-1 hover:bg-sable">⟲</button>
            <button type="button" onClick={() => setSpin((s) => !s)} aria-pressed={spin} className={`rounded-full px-3 py-1 ${spin ? "bg-brun text-ivoire" : "hover:bg-sable"}`}>{spin ? "Pause" : "Faire tourner"}</button>
            <button type="button" onClick={() => turnBy(1)} aria-label="Tourner vers la droite" className="rounded-full px-2 py-1 hover:bg-sable">⟳</button>
          </div>
        )}
        {!recolors && colorHex && !/^#F{6}$/i.test(colorHex) && (
          <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-brun shadow">
            <span className="size-3 rounded-full border border-brun/30" style={{ background: colorHex }} aria-hidden="true" />
            Photo du modèle blanc
          </span>
        )}
      </div>
      {!single && (
        <div className="flex flex-wrap items-center justify-center gap-1 border-t border-line bg-white/70 px-3 py-1.5 text-xs font-bold" role="group" aria-label="Angle de vue">
          {frames.map((f, i) => (
            <button key={f.key} type="button" onClick={() => { setSpin(false); setViewKey(f.key); }} aria-pressed={i === idx}
              className={`rounded-full px-2.5 py-1 ${i === idx ? "bg-brun text-ivoire" : "text-brun hover:bg-sable"}`}>{VIEW_LABEL[f.key]}</button>
          ))}
        </div>
      )}
      {spec.people && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-white/70 px-3 py-2">
          <span className="text-xs font-bold text-muted">Porté par</span>
          {spec.people.map((p) => (
            <button key={p.key} type="button" onClick={() => setPersonKey(p.key)} aria-pressed={p.key === person?.key} title={p.label} aria-label={p.label}
              className={`size-7 rounded-full border-2 ${p.key === person?.key ? "border-terra ring-2 ring-terra ring-offset-1" : "border-white"}`} style={{ background: p.tone }} />
          ))}
          <button type="button" onClick={() => setAll(true)} className="ml-auto rounded-full bg-brun px-3 py-1.5 text-xs font-bold text-ivoire">Voir sur tous</button>
        </div>
      )}
      {all && spec.people && (
        <div role="dialog" aria-modal="true" aria-label="Votre création portée par tous" className="fixed inset-0 z-50 grid place-items-center bg-brun/70 p-4" onClick={() => setAll(false)}>
          <div className="max-h-full w-full max-w-5xl overflow-auto rounded-[24px] bg-ivoire p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <b className="text-lg">Votre création, portée par tous</b>
              <button type="button" onClick={() => setAll(false)} className="rounded-full border border-line px-3 py-1 text-sm font-bold">Fermer</button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {spec.people.map((p) => (
                <figure key={p.key} className="overflow-hidden rounded-xl bg-[#F4F1EC]">
                  <PreviewCanvas src={p.src} mask={p.mask} areas={Object.fromEntries(Object.entries(p.areas).map(([k, v]) => [k, area(v)]))} surfaces={surfaces} zones={zones}
                    cache={cache.current} tick={tick} colorHex={colorHex} activeZone={null} label={`Porté · ${p.label}`} className="h-auto w-full" />
                  <figcaption className="px-3 py-2 text-xs font-semibold">{p.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
