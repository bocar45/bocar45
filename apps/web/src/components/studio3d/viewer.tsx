"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, ContactShadows } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Surface } from "@sawwa/design";
import { GARMENTS, bounds, distanceToOutline, inflate, outline, placeZone, pointInPolygon, uvFor, type GarmentKind, type ModelKind, type Panel, type Placement } from "./garment";
import { drawFabric, drawSurface, loadImages, type ImageCache } from "./paint";
import { motifTile, type AllOver, type PatternSpec } from "@sawwa/design";
import { hasWebGL } from "./support";

export interface Viewer3DProps {
  kind: ModelKind;
  garmentHex: string;
  surfaces: Surface[];
  zones: { key: string; label: string; maxWidthMm: number; maxHeightMm: number; pattern?: PatternSpec | null }[];
  /** E18b: continuous motif over the whole garment (cut-and-sew all-over products). */
  allOver?: AllOver | null;
  imageUrls: Record<string, string>;
  activeZone: string;
  /** Called when the GPU drops the WebGL context while in use (memory pressure, driver reset). */
  onContextLost?: () => void;
}

const PX_PER_MM = 2;
const M = 1 / 1000; // mm → metres (three.js units)

// ───────────────────────────── Textures ─────────────────────────────

function useCanvas(widthMm: number, heightMm: number) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(widthMm * PX_PER_MM));
    canvas.height = Math.max(2, Math.round(heightMm * PX_PER_MM));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }, [widthMm, heightMm]);
}

/** Free GPU memory when a texture or geometry is no longer used (model or product changed). */
function useDispose(...items: { dispose: () => void }[]) {
  useEffect(() => () => { for (const i of items) i.dispose(); }, items); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Repaint textures when the design, colour, images or fonts change (debounced), then ask for one frame. */
function usePaint(paint: () => void, deps: unknown[], images: ImageCache, urls: Record<string, string>) {
  const invalidate = useThree((s) => s.invalidate);
  const run = useRef(paint);
  run.current = paint;
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      await loadImages(urls, images);
      await document.fonts?.ready;
      if (!alive) return;
      run.current();
      invalidate();
    }, 120);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ───────────────────────────── Garments (tee, polo, hoodie, tote) ─────────────────────────────

/** Inflated panel built from the real pattern outline: grid inside the outline, edge vertices snapped onto it. */
function buildPanel(kind: GarmentKind, panel: Panel): THREE.BufferGeometry {
  const poly = outline(kind);
  const b = bounds(kind);
  const step = 4;
  const nx = Math.ceil((b.maxX - b.minX) / step) + 1;
  const ny = Math.ceil((b.maxY - b.minY) / step) + 1;
  const index = new Int32Array(nx * ny).fill(-1);
  const pos: number[] = [], uv: number[] = [], col: number[] = [];
  const sign = panel === "front" ? 1 : -1;
  const T = GARMENTS[kind].thickness;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let x = b.minX + i * step;
      let y = b.minY + j * step;
      if (!pointInPolygon(x, y, poly)) {
        // snap points just outside onto the outline, for a clean silhouette
        let best = { d: Infinity, x, y };
        for (let k = 0, l = poly.length - 1; k < poly.length; l = k++) {
          const [ax, ay] = poly[l]!; const [bx, by] = poly[k]!;
          const dx = bx - ax, dy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
          const px = ax + t * dx, py = ay + t * dy;
          const d = Math.hypot(x - px, y - py);
          if (d < best.d) best = { d, x: px, y: py };
        }
        if (best.d > step * 1.5) continue;
        x = best.x; y = best.y;
      }
      const d = distanceToOutline(x, y, poly);
      // soft folds: gentle waves that fade out in the flat middle of the panel, stronger towards hem and sleeves
      const folds = 3.2 * Math.sin(x / 38 + y / 55) * Math.cos(y / 47) * (1 - Math.exp(-d / 30)) * (0.4 + Math.min(1, y / 700));
      const z = (inflate(d, T) + folds) * sign;
      index[j * nx + i] = pos.length / 3;
      pos.push(x * M, -y * M, z * M);
      const [u, v] = uvFor(kind, panel, x, y);
      uv.push(u, v);
      const ao = 1 - 0.2 * Math.exp(-d / 24); // fold shadows towards the seams
      col.push(ao, ao, ao);
    }
  }
  const tri: number[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = index[j * nx + i]!, bq = index[j * nx + i + 1]!, c = index[(j + 1) * nx + i]!, d = index[(j + 1) * nx + i + 1]!;
      const add = (p: number, q: number, r: number) => { if (p >= 0 && q >= 0 && r >= 0) tri.push(...(panel === "front" ? [p, r, q] : [p, q, r])); };
      add(a, bq, c);
      add(bq, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(tri);
  g.computeVertexNormals();
  return g;
}

function paintGarmentPanel(ctx: CanvasRenderingContext2D, kind: GarmentKind, panel: Panel, p: Viewer3DProps, images: ImageCache, fontEl: Element) {
  const b = bounds(kind);
  const g = GARMENTS[kind];
  ctx.setTransform(PX_PER_MM, 0, 0, PX_PER_MM, -b.minX * PX_PER_MM, -b.minY * PX_PER_MM);
  drawFabric(ctx, p.garmentHex, b.maxX - b.minX, b.maxY - b.minY, b.minX, b.minY);
  // Neck opening and rib details, so the garment reads as a garment.
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  const neck = panel === "front" ? g.neckFront : g.neckBack;
  const nw = g.halfOutline[0]![0];
  if (kind !== "tote") {
    ctx.moveTo(-nw, -20);
    ctx.quadraticCurveTo(0, neck * 1.9, nw, -20);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-nw, -20);
    ctx.quadraticCurveTo(0, neck * 1.9, nw, -20);
    ctx.stroke();
  }
  if (kind === "hoodie") {
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(b.minX, 640, b.maxX - b.minX, 70); // waistband
    if (panel === "front") {
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-170, 640); ctx.lineTo(-130, 470); ctx.lineTo(130, 470); ctx.lineTo(170, 640);
      ctx.stroke(); // kangaroo pocket
    }
  }
  // E18b: all-over products — the continuous motif covers the whole panel, on the same grid as the print files
  if (p.allOver && p.zones.some((z) => z.pattern)) {
    const t = motifTile(p.allOver);
    const shapes = t.shapes.map((sh) => ({ path: new Path2D(sh.d), fill: sh.fill }));
    for (let x = Math.floor(b.minX / t.size) * t.size; x < b.maxX; x += t.size) {
      for (let y = Math.floor(b.minY / t.size) * t.size; y < b.maxY; y += t.size) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = t.background;
        ctx.fillRect(0, 0, t.size + 0.5, t.size + 0.5);
        for (const sh of shapes) { ctx.fillStyle = sh.fill; ctx.fill(sh.path); }
        ctx.restore();
      }
    }
  }
  for (const s of p.surfaces) {
    const zone = p.zones.find((z) => z.key === s.zoneKey);
    if (!zone) continue;
    const body = zone.pattern?.body;
    if (body) {
      // a pattern piece sits at its real place on the garment (sleeves: scaled onto the provisional sleeve area)
      if (body.panel !== panel) continue;
      const copies = zone.pattern!.mirror && zone.pattern!.quantity > 1 ? [false, true] : [false];
      for (const mirrored of copies) {
        ctx.save();
        const sx = body.w / zone.maxWidthMm, sy = body.h / zone.maxHeightMm;
        // the second piece of a left/right pair is the mirror image, on the other side of the garment (x → −x)
        if (mirrored) { ctx.translate(-body.x, body.y); ctx.scale(-sx, sy); } else { ctx.translate(body.x, body.y); ctx.scale(sx, sy); }
        drawSurface(ctx, s, { x: 0, y: 0, w: zone.maxWidthMm, h: zone.maxHeightMm }, images, fontEl);
        ctx.restore();
      }
      continue;
    }
    const pl = placeZone(kind, zone);
    if (pl.panel !== panel) continue;
    drawSurface(ctx, s, pl, images, fontEl);
  }
}

function Garment({ kind, props, images, fontEl }: { kind: GarmentKind; props: Viewer3DProps; images: ImageCache; fontEl: Element }) {
  const b = bounds(kind);
  const front = useCanvas(b.maxX - b.minX, b.maxY - b.minY);
  const back = useCanvas(b.maxX - b.minX, b.maxY - b.minY);
  const geo = useMemo(() => ({ front: buildPanel(kind, "front"), back: buildPanel(kind, "back") }), [kind]);
  useDispose(geo.front, geo.back, front.texture, back.texture);
  usePaint(() => {
    for (const [panel, c] of [["front", front], ["back", back]] as const) {
      const ctx = c.canvas.getContext("2d")!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.canvas.width, c.canvas.height);
      paintGarmentPanel(ctx, kind, panel, props, images, fontEl);
      c.texture.needsUpdate = true;
    }
  }, [props.surfaces, props.garmentHex, props.imageUrls, props.allOver, kind], images, props.imageUrls);
  const y0 = ((b.minY + b.maxY) / 2) * M;
  return (
    <group position={[0, y0, 0]}>
      <mesh geometry={geo.front} castShadow><meshStandardMaterial map={front.texture} vertexColors roughness={0.92} /></mesh>
      <mesh geometry={geo.back} castShadow><meshStandardMaterial map={back.texture} vertexColors roughness={0.92} /></mesh>
      {kind === "hoodie" && (
        // folded hood resting on the back, below the shoulder line seen from the front
        <mesh position={[0, -0.01, -0.075]} scale={[0.16, 0.13, 0.1]} rotation={[-0.35, 0, 0]}>
          <sphereGeometry args={[1, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color={props.garmentHex} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ───────────────────────────── Mug, bottle ─────────────────────────────

function Cylindrical({ kind, props, images, fontEl }: { kind: "mug" | "bottle"; props: Viewer3DProps; images: ImageCache; fontEl: Element }) {
  const r = kind === "mug" ? 41 : 36;
  const h = kind === "mug" ? 95 : 200;
  const circ = 2 * Math.PI * r;
  const tex = useCanvas(circ, h);
  useDispose(tex.texture);
  usePaint(() => {
    const ctx = tex.canvas.getContext("2d")!;
    ctx.setTransform(PX_PER_MM, 0, 0, PX_PER_MM, 0, 0);
    drawFabric(ctx, props.garmentHex, circ, h, 0, 0, false);
    const s = props.surfaces.find((x) => props.zones.some((z) => z.key === x.zoneKey));
    const zone = s && props.zones.find((z) => z.key === s.zoneKey);
    if (s && zone) {
      const w = Math.min(zone.maxWidthMm, circ);
      // the print band is centred on the side that faces the viewer (texture centre)
      drawSurface(ctx, s, { x: circ / 2 - w / 2, y: (h - zone.maxHeightMm) / 2, w, h: zone.maxHeightMm }, images, fontEl);
    }
    tex.texture.needsUpdate = true;
  }, [props.surfaces, props.garmentHex, props.imageUrls], images, props.imageUrls);
  return (
    <group position={[0, (h / 2) * M, 0]}>
      {/* thetaStart = π: the texture seam sits at the back, its centre faces the camera */}
      <mesh castShadow>
        <cylinderGeometry args={[r * M, r * M, h * M, 96, 1, true, Math.PI, Math.PI * 2]} />
        <meshStandardMaterial map={tex.texture} roughness={kind === "mug" ? 0.25 : 0.35} metalness={kind === "bottle" ? 0.4 : 0} />
      </mesh>
      <mesh position={[0, -h * M / 2, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[r * M, 64]} /><meshStandardMaterial color="#ddd" /></mesh>
      {kind === "mug" ? (
        <>
          <mesh><cylinderGeometry args={[(r - 3) * M, (r - 3) * M, h * M, 64, 1, true]} /><meshStandardMaterial color="#f4f1ea" side={THREE.BackSide} /></mesh>
          <mesh position={[0, h * M / 2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[(r - 1.5) * M, 1.5 * M, 8, 64]} /><meshStandardMaterial color={props.garmentHex} roughness={0.25} /></mesh>
          <mesh position={[(r + 14) * M, 0, 0]} rotation={[0, 0, 0]}><torusGeometry args={[24 * M, 5 * M, 16, 48, Math.PI * 1.1]} /><meshStandardMaterial color={props.garmentHex} roughness={0.25} /></mesh>
        </>
      ) : (
        <mesh position={[0, (h / 2 + 18) * M, 0]}><cylinderGeometry args={[18 * M, 20 * M, 36 * M, 48]} /><meshStandardMaterial color="#2a1a12" roughness={0.5} /></mesh>
      )}
    </group>
  );
}

// ───────────────────────────── Cap ─────────────────────────────

function Cap({ props, images, fontEl }: { props: Viewer3DProps; images: ImageCache; fontEl: Element }) {
  const R = 95;
  const W = 2 * Math.PI * R;
  const H = (Math.PI / 2) * R;
  const tex = useCanvas(W, H);
  useDispose(tex.texture);
  usePaint(() => {
    const ctx = tex.canvas.getContext("2d")!;
    ctx.setTransform(PX_PER_MM, 0, 0, PX_PER_MM, 0, 0);
    drawFabric(ctx, props.garmentHex, W, H, 0, 0);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo((i * W) / 6, 0); ctx.lineTo((i * W) / 6, H); ctx.stroke(); } // panel seams
    for (const s of props.surfaces) {
      const zone = props.zones.find((z) => z.key === s.zoneKey);
      if (!zone) continue;
      const front = !/side|cote|back|arriere|left|right/.test(zone.key);
      const cx = front ? W * 0.25 : /right|droit/.test(zone.key) ? 0 : /back|arriere/.test(zone.key) ? W * 0.75 : W * 0.5;
      // sphere u=0.25 faces +z (the camera); v grows from the brim (bottom of the canvas) to the top
      drawSurface(ctx, s, { x: cx - zone.maxWidthMm / 2, y: H - 15 - zone.maxHeightMm, w: zone.maxWidthMm, h: zone.maxHeightMm }, images, fontEl);
    }
    tex.texture.needsUpdate = true;
  }, [props.surfaces, props.garmentHex, props.imageUrls], images, props.imageUrls);
  return (
    <group position={[0, 0.02, 0]}>
      <mesh castShadow scale={[1, 0.78, 1]}>
        <sphereGeometry args={[R * M, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={tex.texture} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, (R - 10) * M]} rotation={[-Math.PI / 2 + 0.12, 0, 0]} scale={[1, 0.78, 1]}>
        <circleGeometry args={[(R * 0.95) * M, 48, 0, Math.PI]} />
        <meshStandardMaterial color={props.garmentHex} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, R * 0.78 * M, 0]}><sphereGeometry args={[7 * M, 16, 12]} /><meshStandardMaterial color={props.garmentHex} /></mesh>
    </group>
  );
}

// ───────────────────────────── Scene and controls ─────────────────────────────

const VIEWS = { face: 0, dos: Math.PI, gauche: Math.PI / 2, droite: -Math.PI / 2, troisQuartsGauche: Math.PI / 4, troisQuartsDroite: -Math.PI / 4 } as const;
type View = keyof typeof VIEWS;

function Scene({ props, controls }: { props: Viewer3DProps; controls: React.RefObject<CameraControls | null> }) {
  const images = useMemo<ImageCache>(() => new Map(), []);
  const fontEl = useThree((s) => s.gl.domElement);
  const size = props.kind === "mug" ? 0.24 : props.kind === "bottle" ? 0.4 : props.kind === "cap" ? 0.33 : props.kind === "tote" ? 0.7 : props.kind === "hoodie" ? 1.45 : 1.05;
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const lost = (e: Event) => { e.preventDefault(); props.onContextLost?.(); };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, props]);
  // Look at the middle of the object: mug and bottle stand on the floor, garments are centred on the origin.
  const targetY = props.kind === "mug" ? 0.0475 : props.kind === "bottle" ? 0.1 : props.kind === "cap" ? 0.04 : 0;
  useEffect(() => {
    controls.current?.setLookAt(0, targetY + size * 0.12, size * 1.75, 0, targetY, 0, false);
  }, [size, targetY, controls]);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#d9ccb5", 1.6]} />
      <directionalLight position={[1.2, 2, 2.4]} intensity={1.35} castShadow />
      <directionalLight position={[-2, 1, 1.5]} intensity={0.55} />
      <directionalLight position={[0, 1, -2.5]} intensity={0.7} />
      {props.kind === "mug" || props.kind === "bottle" ? <Cylindrical kind={props.kind} props={props} images={images} fontEl={fontEl} />
        : props.kind === "cap" ? <Cap props={props} images={images} fontEl={fontEl} />
        : <Garment kind={props.kind} props={props} images={images} fontEl={fontEl} />}
      <ContactShadows position={[0, props.kind === "mug" || props.kind === "bottle" || props.kind === "cap" ? 0 : -0.39, 0]} opacity={0.35} scale={size * 2} blur={2.4} far={1} frames={1} />
      <CameraControls ref={controls} minDistance={size * 0.6} maxDistance={size * 3.5} smoothTime={0.35} />
    </>
  );
}


export default function Viewer3D(props: Viewer3DProps) {
  const controls = useRef<CameraControls | null>(null);
  const [supported] = useState(hasWebGL);
  const [backdrop, setBackdrop] = useState<"blanc" | "ivoire">("blanc");
  const zone = props.zones.find((z) => z.key === props.activeZone);
  const garment = props.kind !== "mug" && props.kind !== "bottle" && props.kind !== "cap";
  const view = (v: View) => controls.current?.rotateTo(VIEWS[v], Math.PI / 2.1, true);
  const focusZone = () => {
    if (!zone) return;
    if (garment) {
      const pl: Placement = placeZone(props.kind as GarmentKind, zone);
      // sleeves: three-quarter view, so the print faces the camera instead of the garment edge
      view(pl.panel === "back" ? "dos" : /sleeve|manche/.test(zone.key) ? (/right|droite/.test(zone.key) ? "troisQuartsDroite" : "troisQuartsGauche") : "face");
      controls.current?.dolly(0.25, true);
    } else view("face");
  };
  if (!supported) {
    return <p className="grid h-full place-items-center p-6 text-center text-sm text-muted">La vue 3D n&apos;est pas disponible sur cet appareil. L&apos;aperçu 2D reste à jour.</p>;
  }
  const btn = "rounded-full border border-line bg-white/90 px-3 py-1.5 text-xs font-bold text-brun hover:border-terra";
  return (
    <div className="relative h-full w-full" style={{ background: backdrop === "blanc" ? "#FFFFFF" : "#F2E9D8" }}>
      <Canvas flat frameloop="demand" dpr={[1, 1.5]} shadows camera={{ fov: 30, near: 0.01, far: 20, position: [0, 0.1, 1.8] }} gl={{ antialias: true }}
        aria-label={`Vue 3D du produit, zone ${zone?.label ?? ""}`}>
        <Scene props={props} controls={controls} />
      </Canvas>
      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        {(["face", "dos", "gauche", "droite"] as const).filter((v) => garment || v !== "dos").map((v) => (
          <button key={v} type="button" className={btn} onClick={() => view(v)}>{({ face: "Face", dos: "Dos", gauche: "Profil G", droite: "Profil D" } as const)[v]}</button>
        ))}
        {zone && <button type="button" className={btn} onClick={focusZone}>Zone : {zone.label}</button>}
        <button type="button" className={btn} onClick={() => { controls.current?.reset(true); }}>Recentrer</button>
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1.5" role="group" aria-label="Fond">
        {(["blanc", "ivoire"] as const).map((b) => (
          <button key={b} type="button" aria-pressed={backdrop === b} onClick={() => setBackdrop(b)} className={`${btn} ${backdrop === b ? "!border-brun" : ""}`} aria-label={b === "blanc" ? "Fond blanc" : "Fond ivoire"}>{b === "blanc" ? "Blanc" : "Ivoire"}</button>
        ))}
      </div>
      <span className="absolute bottom-3 left-3 max-w-[55%] truncate rounded-full bg-ivoire/90 px-3 py-1 text-[11px] font-bold text-brun" title="Glisser pour tourner, pincer ou molette pour zoomer">{garment ? GARMENTS[props.kind as GarmentKind].label : "Modèle provisoire"}</span>
    </div>
  );
}
