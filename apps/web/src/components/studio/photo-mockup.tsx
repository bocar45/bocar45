"use client";

import { useEffect, useRef, useState } from "react";
import type { Surface } from "@sawwa/design";
import { drawSurface, loadImages, type ImageCache } from "../studio3d/paint";

/**
 * Photo-realistic preview: the customer's design printed on the real product photo (the method used by print-on-demand
 * leaders). The design is multiplied with the photo, so the fabric's folds, light and grain show through the print.
 * Print areas are measured on each photo (fractions of the photo); a mug is wrapped on its cylinder.
 */
export interface PhotoArea { x: number; y: number; w: number; h: number; /** mug: part of the wrap width visible, wrapped on a cylinder */ wrapVisible?: number }
export interface PhotoMockupSpec { src: string; areas: Record<string, PhotoArea>; note?: string }

const PHOTOS: { test: RegExp; spec: PhotoMockupSpec }[] = [
  { test: /hood/, spec: { src: "/products/hoodie.jpg", areas: { back_center: { x: 0.33, y: 0.3, w: 0.33, h: 0.352 } }, note: "Vue de dos" } },
  { test: /sweat|pull/, spec: { src: "/products/sweat.jpg", areas: { front_center: { x: 0.3, y: 0.2, w: 0.4, h: 0.4 }, chest_left: { x: 0.56, y: 0.2, w: 0.12, h: 0.096 } } } },
  { test: /casquette|cap/, spec: { src: "/products/casquette.jpg", areas: { front_center: { x: 0.36, y: 0.38, w: 0.22, h: 0.097 } } } },
  { test: /mug|tasse/, spec: { src: "/products/mug.jpg", areas: { wrap: { x: 0.06, y: 0.57, w: 0.4, h: 0.227, wrapVisible: 0.6 } }, note: "Face avant du mug" } },
  { test: /tote|sac/, spec: { src: "/products/tote.jpg", areas: { front_center: { x: 0.28, y: 0.5, w: 0.44, h: 0.377 } } } },
  { test: /t-?shirt|tee/, spec: { src: "/products/tshirt.jpg", areas: { front_center: { x: 0.28, y: 0.2, w: 0.44, h: 0.44 }, chest_left: { x: 0.55, y: 0.2, w: 0.13, h: 0.104 } } } },
];

export function photoMockupFor(slug: string): PhotoMockupSpec | null {
  const s = slug.toLowerCase();
  return PHOTOS.find((p) => p.test.test(s))?.spec ?? null;
}

export function PhotoMockup({ spec, surfaces, zones, imageUrls, activeZone }: {
  spec: PhotoMockupSpec;
  surfaces: Surface[];
  zones: { key: string; label: string; maxWidthMm: number; maxHeightMm: number }[];
  imageUrls: Record<string, string>;
  activeZone: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cache = useRef<ImageCache>(new Map());
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.src = spec.src;
  }, [spec.src]);

  useEffect(() => { let live = true; loadImages(imageUrls, cache.current).then(() => { if (live) setTick((t) => t + 1); }); return () => { live = false; }; }, [imageUrls]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !photo) return;
    const W = photo.naturalWidth, H = photo.naturalHeight;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(photo, 0, 0);
    for (const s of surfaces) {
      const area = spec.areas[s.zoneKey];
      const zone = zones.find((z) => z.key === s.zoneKey);
      if (!area || !zone || s.layers.length === 0) continue;
      // Render the zone at print proportions, ~3 px/mm.
      const ppm = 3;
      const off = document.createElement("canvas");
      off.width = Math.round(zone.maxWidthMm * ppm); off.height = Math.round(zone.maxHeightMm * ppm);
      const o = off.getContext("2d")!;
      o.scale(ppm, ppm);
      drawSurface(o, s, { x: 0, y: 0, w: zone.maxWidthMm, h: zone.maxHeightMm }, cache.current, c);
      const dx = area.x * W, dy = area.y * H, dw = area.w * W, dh = area.h * H;
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      if (area.wrapVisible) {
        // Cylinder: screen column u ∈ [-1, 1] shows the wrap at angle asin(u·sin a); the middle of the wrap faces us.
        const a = 1.1, slices = 120, visible = area.wrapVisible;
        for (let i = 0; i < slices; i++) {
          const u0 = -1 + (2 * i) / slices, u1 = -1 + (2 * (i + 1)) / slices;
          const t = (u: number) => 0.5 + (Math.asin(u * Math.sin(a)) / a) * (visible / 2);
          const sx0 = t(u0) * off.width, sx1 = t(u1) * off.width;
          const shade = 0.75 + 0.25 * Math.cos(((u0 + u1) / 2) * 1.2);
          ctx.globalAlpha = shade;
          ctx.drawImage(off, sx0, 0, Math.max(1, sx1 - sx0), off.height, dx + ((u0 + 1) / 2) * dw, dy, dw / slices + 0.5, dh);
        }
      } else {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(off, dx, dy, dw, dh);
      }
      ctx.restore();
    }
    // Active zone outline, discreet.
    const act = spec.areas[activeZone];
    if (act) {
      ctx.save();
      ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(181,86,42,0.55)";
      ctx.strokeRect(act.x * W, act.y * H, act.w * W, act.h * H);
      ctx.restore();
    }
  }, [photo, surfaces, zones, spec, activeZone, tick]);

  const shown = zones.filter((z) => spec.areas[z.key]).map((z) => z.label);
  return (
    <div className="relative grid h-full place-items-center bg-[#F4F1EC]">
      <canvas ref={ref} className="h-full max-h-full w-auto max-w-full object-contain" aria-label="Aperçu photo réaliste de votre création sur le produit" role="img" />
      <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-brun shadow">
        Aperçu photo réaliste{spec.note ? ` · ${spec.note}` : ""} · {shown.join(", ")}
      </span>
    </div>
  );
}
