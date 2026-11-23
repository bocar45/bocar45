"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { TECHNIQUE_LABEL, type Technique } from "@sawwa/catalog";
import {
  ALL_OVER_MOTIFS, FONTS, MAX_DOCUMENT_CHARS, blankPieces, blocking, checkSurface, coverCrop, decorationsFor, effectiveDpi, emptyDocument, fillPhoto, fillText, needsRoster, parseDesign, personalize, preflight, templateFields, widestPiece,
  type AllOver, type DesignDocument, type FieldRef, type MotifKind, type PatternSpec, type RosterEntry, type FontKey, type Layer, type ShapeKind, type Surface, type TextLayer,
} from "@sawwa/design";
import { DELIVERY_OPTIONS, type DeliveryKey } from "@/lib/shipping";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { Viewer3DBoundary } from "../studio3d/boundary";
import { modelKindFor } from "../studio3d/garment";
import { hasWebGL, preferredMode, type StudioMode } from "../studio3d/support";

import { PhotoMockup, photoMockupFor } from "./photo-mockup";
const Viewer3D = dynamic(() => import("../studio3d/viewer"), {
  ssr: false,
  loading: () => <p className="grid h-full place-items-center text-sm text-muted">Chargement de la vue 3D…</p>,
});
import { getAsset, loadDraft, putAsset, saveDraft } from "./asset-store";
import { LayerShape, StudioCanvas, isDark } from "./canvas";
import { ImageTools } from "./image-tools";
import { PerItemEditor, RosterEditor } from "./roster-panel";
import { RightsGate } from "./rights-gate";
import { AssistantPanel, FieldEditor, TemplateSavePanel } from "./template-panels";
import { moveLayerToZone } from "./move";
import { useHistory } from "./use-history";
import { useLang } from "@/components/lang-context";
import { fcfaIn, l } from "@/lib/i18n";
import { fitsQuote } from "@/lib/b2b-rules";
import { needsRightsDeclaration } from "@/lib/design-ownership";

export interface StudioZoneProps { key: string; label: string; viewLabel: string; maxWidthMm: number; maxHeightMm: number; techniques: Technique[]; pattern?: PatternSpec | null }
export interface StudioProps {
  product: { slug: string; name: string; categorySlug: string; colors: { key: string; hex: string; sizes: string[] }[]; zones: StudioZoneProps[] };
  quote: (slug: string, colorKey: string, quantity: number, decorations: ReturnType<typeof decorationsFor>) => Promise<
    { ok: true; unitPrice: number; total: number; quantity: number; leadTimeDays: number; depositDue: number | null; setupFee: number } | { ok: false; message: string }
  >;
  userId: string | null;
  /** Starting document: a saved design (id), or a template for the assistant / the catalogue team (id null). */
  initial: { id: string | null; title: string; document: DesignDocument; urls: Record<string, string> } | null;
  save: (input: { id: string | null; slug: string; title: string; document: unknown; rightsDeclared?: boolean }) => Promise<{ ok: true; id: string } | { error: string }>;
  order: (input: {
    designId: string; sizes: Record<string, number>; delivery: string; acceptWarnings: boolean; roster?: RosterEntry[] | null; quoteId?: string;
    address: { name: string; phone: string; district: string; landmark: string; city: string };
  }) => Promise<{ ok: true; orderId: string; number: string } | { error: string }>;
  /** E10: the studio opened to correct an order waiting for a correction. */
  correction?: { orderId: string; number: string; comment: string | null; roster?: RosterEntry[] | null } | null;
  resubmit?: (input: { orderId: string; document: unknown; acceptWarnings: boolean; acceptedSurcharge: number | null }) => Promise<{ ok: true; surcharge: number } | { error: string; surcharge?: number }>;
  /** E15: a ready-to-personalise template opened by a customer (assistant first). */
  assistant?: { id: string; slug: string; title: string; description: string } | null;
  /** E15: a template edited by the catalogue team. */
  template?: { id: string; title: string; status: string } | null;
  saveTemplate?: (input: { id: string; slug: string; document: unknown }) => Promise<{ ok: true } | { error: string }>;
  /** E17: the customer creates the design of an accepted B2B quote; the price is the quoted one. */
  b2b?: B2bForStudio | null;
}

export interface B2bForStudio {
  id: string; number: string; quantity: number; sizes: Record<string, number> | null; colorKey: string;
  goodsTotal: number; depositDue: number | null; leadTimeDays: number; validUntil: string;
  decorations: { zoneKey: string; technique: string; widthMm: number; heightMm: number; colors: number }[];
}

/** The rights declaration belongs to an account (a shared phone must not declare for someone else). */
const rightsKey = (userId: string) => `sawwa:droits-images:${userId}`;
const SWATCHES = ["#2A1A12", "#F2E9D8", "#FFFFFF", "#000000", "#B5562A", "#C9923E", "#2F4B7C", "#68705A", "#A4262C"];
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 12);
const btn = "inline-flex items-center justify-center gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-sable disabled:opacity-40";
const field = "w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm";

export function Studio({ product, quote, userId, initial, save, order, correction, resubmit, assistant, template, saveTemplate, b2b }: StudioProps) {
  const lang = useLang();
  const t = (fr: string, en: string) => l(lang, fr, en);
  const router = useRouter();
  const draftKey = `sawwa:studio:${product.slug}${correction ? `:commande:${correction.orderId}` : template ? `:gabarit:${template.id}` : b2b ? `:devis:${b2b.id}` : assistant ? `:modele:${assistant.slug}` : initial ? `:${initial.id}` : ""}`;
  const [assistantOpen, setAssistantOpen] = useState(Boolean(assistant));
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  // E18d: rights declaration before importing images (once per device, recorded on the design when saved).
  const [rightsOk, setRightsOk] = useState(false);
  const [rightsGate, setRightsGate] = useState<null | (() => void)>(null);
  useEffect(() => {
    // signed out: the declaration lives only in this page (asked again once signed in, before saving)
    if (!userId) return;
    try { setRightsOk(Boolean(localStorage.getItem(rightsKey(userId)))); } catch { /* storage blocked */ }
  }, [userId]);
  const requireRights = (go: () => void) => { if (rightsOk) go(); else setRightsGate(() => go); };
  // E16: one line per piece (size, name, number) when a text changes on every piece; kept on this device.
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  useEffect(() => {
    if (correction?.roster) { setRoster(correction.roster); return; } // frozen with the order
    try { const r = JSON.parse(localStorage.getItem(`${draftKey}:liste`) ?? "[]"); if (Array.isArray(r)) setRoster(r.slice(0, 500)); } catch { /* no saved list */ }
  }, [draftKey, correction?.roster]);
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(`${draftKey}:liste`, JSON.stringify(roster)); } catch { /* storage full or blocked */ } }, 400);
    return () => clearTimeout(t);
  }, [roster, draftKey]);
  const [designId, setDesignId] = useState<string | null>(initial?.id ?? null);
  const [title, setTitle] = useState(initial?.title ?? "Ma création");
  const [saving, setSaving] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const history = useHistory<DesignDocument>(emptyDocument(product.slug, b2b?.colorKey ?? product.colors[0]?.key ?? ""));
  const doc = history.value;
  const [zoneKey, setZoneKey] = useState(product.zones[0]?.key ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 2D by default on small screens (the editor stays in view, the 3D module loads only on demand) and without WebGL.
  const [mode, setMode] = useState<StudioMode>("edit");
  // Photo-realistic preview on the real product photo by default; the 3D model stays available.
  const photoSpec = photoMockupFor(`${product.slug} ${product.categorySlug}`);
  const [preview, setPreview] = useState<"photo" | "3d">(photoSpec ? "photo" : "3d");
  const [webgl, setWebgl] = useState(true);
  // 3D failed to download (network) or lost its GPU context: show why and let the person retry.
  const [viewerFailed, setViewerFailed] = useState<null | "network">(null);
  const [viewerKey, setViewerKey] = useState(0);
  useEffect(() => {
    const ok = hasWebGL();
    setWebgl(ok);
    setMode(preferredMode(ok || Boolean(photoSpec), window.innerWidth));
  }, []);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<Awaited<ReturnType<StudioProps["quote"]>> | null>(null);
  const [pricing, startPricing] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const zone = product.zones.find((z) => z.key === zoneKey) ?? product.zones[0]!;
  const color = product.colors.find((c) => c.key === doc.colorKey) ?? product.colors[0] ?? { key: "", hex: "#F2E9D8", sizes: [] };
  const surface: Surface = doc.surfaces.find((s) => s.zoneKey === zone.key) ?? { zoneKey: zone.key, technique: zone.techniques[0] ?? "dtf", layers: [] };
  const selected = surface.layers.find((l) => l.id === selectedId) ?? null;
  const teamMode = needsRoster(doc);
  /** E18b: cut-and-sew product printed all over (its zones are pattern pieces). */
  const allOverProduct = product.zones.some((z) => z.pattern);
  const previewEntry = teamMode && previewIdx !== null ? roster[previewIdx] : undefined;
  /** What is shown: the design, or one personalised piece of the team list. */
  const shownDoc = previewEntry ? personalize(doc, previewEntry) : doc;
  const shownSurface = shownDoc.surfaces.find((s) => s.zoneKey === zone.key) ?? surface;
  const ink = isDark(color.hex) ? "#F2E9D8" : "#2A1A12";

  // ── Restore the draft kept on this device (a saved design or a template being edited opens as stored) ──
  useEffect(() => {
    if (initial && !assistant) {
      history.reset(initial.document);
      setUrls(initial.urls);
      setRestored(true);
      return;
    }
    const saved = loadDraft<DesignDocument>(draftKey);
    const parsed = saved ? parseDesign(saved) : null;
    const start = parsed?.ok && parsed.value.product === product.slug ? parsed.value : initial?.document ?? null;
    if (start) {
      history.reset(b2b ? { ...start, colorKey: b2b.colorKey } : start);
      if (initial) setUrls(initial.urls);
      const ids = start.surfaces.flatMap((s) => s.layers).flatMap((l) => (l.type === "image" && !l.src.startsWith("storage:") ? [l.src] : []));
      void Promise.all(ids.map(async (src) => {
        const blob = await getAsset(src.replace(/^idb:/, ""));
        return blob ? ([src, URL.createObjectURL(blob)] as const) : null;
      })).then((pairs) => setUrls((u) => ({ ...u, ...Object.fromEntries(pairs.filter((x): x is readonly [string, string] => x !== null)) })));
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => saveDraft(draftKey, doc), 400);
    return () => clearTimeout(t);
  }, [doc, draftKey, restored]);

  // ── Surface editing helpers ──
  const updateSurface = useCallback((d: DesignDocument, fn: (s: Surface) => Surface): DesignDocument => {
    const existing = d.surfaces.find((s) => s.zoneKey === zone.key);
    const base = existing ?? { zoneKey: zone.key, technique: zone.techniques[0] ?? "dtf", layers: [] };
    const next = fn(base);
    const surfaces = existing ? d.surfaces.map((s) => (s.zoneKey === zone.key ? next : s)) : [...d.surfaces, next];
    return { ...d, surfaces: surfaces.filter((s) => s.layers.length > 0 || s.zoneKey === zone.key) };
  }, [zone]);

  const patchLayer = (id: string, patch: Partial<Layer>) => (d: DesignDocument) =>
    updateSurface(d, (s) => ({ ...s, layers: s.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) }));
  const commitPatch = (id: string, patch: Partial<Layer>) => history.commit(patchLayer(id, patch));
  const addLayer = (layer: Layer) => {
    history.commit((d) => updateSurface(d, (s) => ({ ...s, layers: [...s.layers, layer] })));
    setSelectedId(layer.id);
    if (mode === "3d") setMode("split");
  };
  const removeLayer = (id: string) => {
    history.commit((d) => updateSurface(d, (s) => ({ ...s, layers: s.layers.filter((l) => l.id !== id) })));
    setSelectedId(null);
  };
  const duplicate = (l: Layer) => addLayer({ ...l, id: uid(), xMm: l.xMm + 8, yMm: l.yMm + 8, locked: false, field: undefined } as Layer);
  const reorder = (id: string, dir: 1 | -1) => history.commit((d) => updateSurface(d, (s) => {
    const i = s.layers.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.layers.length) return s;
    const layers = [...s.layers];
    [layers[i], layers[j]] = [layers[j]!, layers[i]!];
    return { ...s, layers };
  }));

  const W = zone.maxWidthMm;
  const H = zone.maxHeightMm;

  /** « Placer ici » : moves the selected element to another zone (see moveLayerToZone). */
  const moveToZone = (layerId: string, targetKey: string) => {
    const target = product.zones.find((z) => z.key === targetKey);
    if (!target || target.key === zone.key) return;
    history.commit((d) => moveLayerToZone(d, layerId, zone.key, { key: target.key, maxWidthMm: target.maxWidthMm, maxHeightMm: target.maxHeightMm, technique: target.techniques[0] ?? "dtf" }));
    setZoneKey(target.key);
  };
  const addText = () => addLayer({
    id: uid(), type: "text", text: "Votre texte", font: "manrope", sizeMm: Math.round(Math.min(40, Math.max(10, H * 0.09))),
    fill: ink, xMm: W / 2, yMm: H * 0.3, rotation: 0, widthMm: W * 0.5, heightMm: 20,
  });
  /** Team shirt: a name and a big number, different on every piece. */
  const addTeamTexts = () => {
    const nameSize = Math.round(Math.min(60, Math.max(10, W * 0.15)));
    const numSize = Math.round(Math.min(220, Math.max(20, H * 0.45)));
    const name: Layer = { id: uid(), type: "text", text: "NOM", font: "anton", sizeMm: nameSize, fill: ink, xMm: W / 2, yMm: H * 0.15, rotation: 0, widthMm: nameSize * 1.4, heightMm: nameSize * 1.2, perItem: { key: "name", maxLength: 12 } };
    const num: Layer = { id: uid(), type: "text", text: "10", font: "anton", sizeMm: numSize, fill: ink, xMm: W / 2, yMm: H * 0.6, rotation: 0, widthMm: numSize * 0.9, heightMm: numSize, perItem: { key: "number", maxLength: 2 } };
    history.commit((d) => updateSurface(d, (s) => ({ ...s, layers: [...s.layers, name, num] })));
    setSelectedId(num.id);
    setNotice("Nom et numéro ajoutés : ils changeront sur chaque pièce. Vous donnerez la liste à la commande.");
  };
  const addShape = (shape: ShapeKind) => {
    const s = Math.round(Math.min(W, H) * 0.3);
    addLayer({ id: uid(), type: "shape", shape, fill: "#B5562A", xMm: W / 2, yMm: H / 2, rotation: 0, widthMm: s, heightMm: s });
  };
  const importImage = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setNotice("Formats acceptés : PNG, JPG ou WebP.");
    if (file.size > 25 * 1024 * 1024) return setNotice("Image trop lourde (25 Mo maximum).");
    try {
      const bitmap = await createImageBitmap(file);
      const id = uid();
      await putAsset(id, file).catch(() => undefined);
      const src = `idb:${id}`;
      setUrls((u) => ({ ...u, [src]: URL.createObjectURL(file) }));
      const scale = Math.min((W * 0.6) / bitmap.width, (H * 0.6) / bitmap.height);
      addLayer({
        id: uid(), type: "image", src, name: file.name, pxWidth: bitmap.width, pxHeight: bitmap.height,
        xMm: W / 2, yMm: H / 2, rotation: 0, widthMm: Math.round(bitmap.width * scale), heightMm: Math.round(bitmap.height * scale),
      });
      setNotice(null);
    } catch {
      setNotice("Impossible de lire cette image.");
    }
  };

  // ── Save to the customer account: upload on-device images, then store the document ──
  /** Returns the saved design id and the exact document stored (images replaced by their storage paths). */
  const saveToAccount = async (rightsConfirmed = false): Promise<{ id: string; doc: DesignDocument } | null> => {
    if (!userId) {
      router.push(`/connexion?suite=${encodeURIComponent(`/studio/${product.slug}${assistant ? `?modele=${assistant.slug}` : ""}`)}`);
      return null;
    }
    // E18d: imported images need this account's declaration (asked here too, e.g. for a design opened on another device)
    if (needsRightsDeclaration(doc) && !rightsOk && !rightsConfirmed) {
      setRightsGate(() => () => { void saveToAccount(true); });
      setNotice("Confirmez vos droits sur les images importées pour enregistrer.");
      return null;
    }
    setSaving(true);
    setNotice(null);
    try {
      const supabase = createBrowserSupabase();
      let next = doc;
      const newUrls: Record<string, string> = {};
      for (const s of doc.surfaces) {
        for (const l of s.layers) {
          if (l.type !== "image" || l.src.startsWith("storage:")) continue;
          const blob = await getAsset(l.src.replace(/^idb:/, ""));
          if (!blob) throw new Error(`Image « ${l.name} » introuvable sur cet appareil : importez-la à nouveau.`);
          const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
          const path = `${userId}/${uid()}${uid()}.${ext}`;
          const { error } = await supabase.storage.from("design-assets").upload(path, blob, { contentType: blob.type, upsert: false });
          if (error) throw new Error(`L'image « ${l.name} » n'a pas pu être envoyée (format PNG, JPG ou WebP, 25 Mo maximum). Vérifiez votre connexion et réessayez.`);
          const src = `storage:design-assets/${path}`;
          newUrls[src] = urls[l.src] ?? "";
          next = { ...next, surfaces: next.surfaces.map((x) => ({ ...x, layers: x.layers.map((y) => (y.id === l.id ? { ...y, src } as Layer : y)) })) };
        }
      }
      if (next !== doc) { setUrls((u) => ({ ...u, ...newUrls })); history.commit(next); }
      if (JSON.stringify(next).length > MAX_DOCUMENT_CHARS) throw new Error("Création trop lourde à enregistrer : remplacez un élément vectorisé très détaillé par l'image d'origine, ou vectorisez avec moins de couleurs.");
      const r = await save({ id: designId, slug: product.slug, title, document: next, rightsDeclared: rightsOk || rightsConfirmed });
      if ("error" in r) throw new Error(r.error);
      setDesignId(r.id);
      setNotice("Création enregistrée dans votre compte.");
      return { id: r.id, doc: next };
    } catch (e) {
      setNotice((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── E15: template assistant (customer) and template saving (catalogue team) ──
  const fields = useMemo(() => templateFields(doc), [doc]);
  /** Template fields the customer left as they were (sample photo kept, empty text). */
  const unfilled = useMemo(() => (assistant ? fields.filter((f) => {
    if (f.kind === "text") return !f.text?.trim();
    const l = doc.surfaces.flatMap((s) => s.layers).find((x) => x.id === f.layerId);
    return l?.type === "image" && initial?.document.surfaces.some((s) => s.layers.some((x) => x.type === "image" && x.id === l.id && x.src === l.src));
  }) : []), [assistant, fields, doc, initial]);
  const fillPhotoField = async (f: FieldRef, file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setNotice("Formats acceptés : PNG, JPG ou WebP.");
    if (file.size > 25 * 1024 * 1024) return setNotice("Image trop lourde (25 Mo maximum).");
    if (!f.box) return;
    setPhotoBusy(f.layerId);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const r = coverCrop(bitmap.width, bitmap.height, f.box.widthMm, f.box.heightMm);
      const s = Math.min(1, 4000 / Math.max(r.w, r.h)); // enough for 300 dpi on 33 cm
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(r.w * s)); c.height = Math.max(1, Math.round(r.h * s));
      c.getContext("2d")!.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
      const type = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("encode"))), type, 0.92));
      const id = uid();
      const kept = await putAsset(id, blob).then(() => true, () => false);
      const src = `idb:${id}`;
      setUrls((u) => ({ ...u, [src]: URL.createObjectURL(blob) }));
      history.commit((d) => fillPhoto(d, f.layerId, { src, name: file.name, pxWidth: c.width, pxHeight: c.height }));
      setZoneKey(f.zoneKey);
      setNotice(kept ? null : "Photo ajoutée, mais cet appareil n'a pas pu la garder : enregistrez la création avant de recharger la page.");
    } catch {
      setNotice("Impossible de lire cette photo. Essayez une autre image (PNG, JPG ou WebP).");
    } finally {
      setPhotoBusy(null);
    }
  };
  const saveTemplateDoc = async () => {
    if (!template || !saveTemplate) return;
    setSaving(true);
    setNotice(null);
    try {
      const supabase = createBrowserSupabase();
      let next = doc;
      const newUrls: Record<string, string> = {};
      for (const l of doc.surfaces.flatMap((s) => s.layers)) {
        if (l.type !== "image" || l.src.startsWith("storage:")) continue;
        const blob = await getAsset(l.src.replace(/^idb:/, ""));
        if (!blob) throw new Error(`Image « ${l.name} » introuvable sur cet appareil : importez-la à nouveau.`);
        const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
        const path = `${template.id}/${uid()}${uid()}.${ext}`;
        const { error } = await supabase.storage.from("template-assets").upload(path, blob, { contentType: blob.type, upsert: false });
        if (error) throw new Error(`L'image « ${l.name} » n'a pas pu être envoyée (PNG, JPG ou WebP, 25 Mo maximum).`);
        const src = `storage:template-assets/${path}`;
        newUrls[src] = urls[l.src] ?? "";
        next = { ...next, surfaces: next.surfaces.map((x) => ({ ...x, layers: x.layers.map((y) => (y.id === l.id ? { ...y, src } as Layer : y)) })) };
      }
      if (next !== doc) { setUrls((u) => ({ ...u, ...newUrls })); history.commit(next); }
      const r = await saveTemplate({ id: template.id, slug: product.slug, document: next });
      if ("error" in r) throw new Error(r.error);
      setNotice("Modèle enregistré.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) history.redo(); else history.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); history.redo(); return; }
      if (!selected || selected.locked) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeLayer(selected.id); }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicate(selected); }
      const step = e.shiftKey ? 10 : 1;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const a = arrows[e.key];
      if (a) { e.preventDefault(); commitPatch(selected.id, { xMm: selected.xMm + a[0], yMm: selected.yMm + a[1] }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Preflight and live price ──
  const issuesByZone = useMemo(() => Object.fromEntries(doc.surfaces.map((s) => {
    const z = product.zones.find((x) => x.key === s.zoneKey);
    return [s.zoneKey, z ? checkSurface(s, z, doc.allOver) : []];
  })), [doc.surfaces, product.zones]);
  const zoneIssues = issuesByZone[zone.key] ?? [];
  const allIssues = [...Object.values(issuesByZone).flat(), ...blankPieces(doc, product.zones)];
  // Team order: the price follows the widest name/number of the list, exactly like the server (widestPiece).
  const decorations = useMemo(() => decorationsFor(teamMode ? widestPiece(doc, roster) : doc, product.zones.map((z) => ({ key: z.key, maxWidthMm: z.maxWidthMm, maxHeightMm: z.maxHeightMm, pattern: z.pattern ?? null }))), [doc, product.zones, teamMode, roster]);
  // E17: what the design prints must stay within the quote (same rule as the server).
  const quoteProblems = useMemo(() => (b2b ? fitsQuote(decorations, b2b.decorations, Object.fromEntries(product.zones.map((z) => [z.key, z.label]))) : []), [b2b, decorations, product.zones]);
  const decoKey = JSON.stringify(decorations);

  useEffect(() => {
    if (decorations.length === 0) { setPrice(null); return; }
    const t = setTimeout(() => startPricing(async () => {
      try {
        setPrice(await quote(product.slug, doc.colorKey, quantity, decorations));
      } catch {
        // A failing price must never take the studio down: the creation stays editable.
        setPrice({ ok: false, message: "Prix indisponible pour le moment. Votre création est conservée ; réessayez dans un instant." });
      }
    }), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoKey, quantity, doc.colorKey]);


  return (
    <div className="grid min-h-[calc(100dvh-64px)] grid-rows-[auto_1fr] bg-sable/40">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-ivoire px-4 py-3">
        <Link href={`/produits/${product.slug}`} className="text-sm text-muted underline">{t("← Produit", "← Product")}</Link>
        <b className="display on-light text-xl">{product.name}</b>
        {correction && <span className="rounded-full bg-ocre px-3 py-1 text-xs font-bold text-brun">Correction · {correction.number}</span>}
        {template && <span className="rounded-full bg-ocre px-3 py-1 text-xs font-bold text-brun">Modèle · {template.title}</span>}
        {b2b && <span className="rounded-full bg-indigo-900 px-3 py-1 text-xs font-bold text-ivoire">Devis {b2b.number} · {b2b.quantity} pièces</span>}
        {previewEntry && (
          <button type="button" onClick={() => setPreviewIdx(null)} className="rounded-full bg-indigo-900 px-3 py-1 text-xs font-bold text-ivoire">
            Aperçu pièce {previewIdx! + 1} : {[previewEntry.name, previewEntry.number, previewEntry.size].filter(Boolean).join(" · ")} ✕
          </button>
        )}
        {!webgl && <span className="text-xs text-muted">Vue 3D indisponible sur cet appareil : le studio fonctionne en 2D.</span>}
        <div className="flex items-center gap-1.5" role="group" aria-label="Couleur du produit">
          {product.colors.map((c) => (
            <button key={c.key} type="button" onClick={() => history.commit((d) => ({ ...d, colorKey: c.key }))} aria-pressed={c.key === color.key} aria-label={c.key}
              disabled={Boolean(correction || b2b) && c.key !== color.key} title={correction ? "La couleur ne change pas pendant une correction" : b2b ? "Couleur fixée par le devis" : undefined}
              className={`size-7 rounded-full border-2 disabled:cursor-not-allowed disabled:opacity-30 ${c.key === color.key ? "border-terra ring-2 ring-terra ring-offset-1" : "border-brun/20"}`} style={{ background: c.hex }} />
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={history.undo} disabled={!history.canUndo} aria-label={t("Annuler (Ctrl+Z)", "Undo (Ctrl+Z)")}>{t("↶ Annuler", "↶ Undo")}</button>
          <button type="button" className={btn} onClick={history.redo} disabled={!history.canRedo} aria-label={t("Rétablir (Ctrl+Maj+Z)", "Redo (Ctrl+Shift+Z)")}>{t("↷ Rétablir", "↷ Redo")}</button>
          <div className="flex rounded-full bg-brun p-1 text-sm font-bold" role="group" aria-label="Mode">
            {(["edit", "split", "3d"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} disabled={m !== "edit" && !webgl && !photoSpec}
                title={m !== "edit" && !webgl && !photoSpec ? "La 3D n'est pas disponible sur cet appareil" : undefined}
                className={`rounded-full px-4 py-1.5 disabled:cursor-not-allowed disabled:opacity-40 ${mode === m ? "bg-ivoire text-brun" : "text-ivoire"}`}>{(photoSpec ? { edit: "2D", split: "2D + aperçu", "3d": "Aperçu" } : { edit: "2D", split: "2D + 3D", "3d": "3D" } as const)[m]}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={`grid gap-0 ${assistantOpen ? "lg:grid-cols-[1fr_380px]" : "lg:grid-cols-[88px_1fr_340px]"}`}>
        {/* Tools (hidden while the customer fills a template in the assistant) */}
        <div className={`${assistantOpen ? "hidden" : "flex"} gap-2 overflow-x-auto border-b border-line bg-ivoire p-3 lg:flex-col lg:border-b-0 lg:border-r`}>
          <Tool label={t("Texte", "Text")} icon="T" onClick={addText} />
          <Tool label="Image" icon="▣" onClick={() => requireRights(() => fileInput.current?.click())} />
          <Tool label={t("Losange", "Diamond")} icon="◆" onClick={() => addShape("losange")} />
          <Tool label={t("Cercle", "Circle")} icon="●" onClick={() => addShape("circle")} />
          <Tool label={t("Carré", "Square")} icon="■" onClick={() => addShape("rect")} />
          <Tool label={t("Nom + n°", "Name + no.")} icon="10" onClick={addTeamTexts} />
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importImage(f); e.target.value = ""; }} />
        </div>

        {/* Canvas / preview */}
        <div className="grid grid-rows-[auto_1fr] gap-3 p-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("Zones à personnaliser", "Areas to personalise")}>
            {product.zones.map((z) => {
              const n = doc.surfaces.find((s) => s.zoneKey === z.key)?.layers.length ?? 0;
              const bad = blocking(issuesByZone[z.key] ?? []);
              return (
                <button key={z.key} role="tab" aria-selected={z.key === zone.key} type="button" onClick={() => { setZoneKey(z.key); setSelectedId(null); }}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${z.key === zone.key ? "bg-brun text-ivoire" : "border border-line bg-ivoire"}`}>
                  {z.label}{n > 0 && <span className={`ml-2 rounded-full px-1.5 text-xs ${bad ? "bg-error text-white" : "bg-ocre text-brun"}`}>{n}</span>}
                </button>
              );
            })}
          </div>
          <div className={`grid gap-3 ${mode === "split" ? "xl:grid-cols-2" : ""}`}>
            {mode !== "edit" && (
              // Fixed height: the 3D canvas fills its box, so the box must not depend on the canvas (no resize loop).
              <div className={`relative overflow-hidden rounded-[24px] border border-line ${mode === "3d" ? "h-[70vh] min-h-[420px]" : "h-[380px] xl:h-[520px]"}`}>
                {photoSpec && (
                  <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-full bg-brun p-1 text-xs font-bold">
                    {(["photo", "3d"] as const).map((v) => (
                      <button key={v} type="button" onClick={() => setPreview(v)} aria-pressed={preview === v}
                        className={`rounded-full px-3 py-1 ${preview === v ? "bg-ivoire text-brun" : "text-ivoire"}`}>{v === "photo" ? "Photo réaliste" : "3D"}</button>
                    ))}
                  </div>
                )}
                {photoSpec && preview === "photo" ? (
                  <PhotoMockup spec={photoSpec} surfaces={shownDoc.surfaces} zones={product.zones} imageUrls={urls} activeZone={zone.key} colorHex={color.hex} />
                ) : viewerFailed ? (
                  <div role="alert" className="grid h-full place-items-center gap-3 p-6 text-center text-sm">
                    <p className="max-w-sm text-muted">La vue 3D n&apos;a pas pu se charger (connexion interrompue ou carte graphique occupée). Votre création n&apos;est pas perdue et l&apos;édition 2D continue.</p>
                    <div className="flex gap-2">
                      <button type="button" className={btn} onClick={() => { setViewerFailed(null); setViewerKey((k) => k + 1); }}>Réessayer</button>
                      <button type="button" className={btn} onClick={() => { setViewerFailed(null); setMode("edit"); }}>Continuer en 2D</button>
                    </div>
                  </div>
                ) : (
                  <Viewer3DBoundary key={viewerKey} onFail={() => setViewerFailed("network")}>
                    <Viewer3D kind={modelKindFor(`${product.slug} ${product.categorySlug}`)} garmentHex={color.hex} surfaces={shownDoc.surfaces} allOver={doc.allOver ?? null}
                      zones={product.zones} imageUrls={urls} activeZone={zone.key} onContextLost={() => setViewerFailed("network")} />
                  </Viewer3DBoundary>
                )}
              </div>
            )}
            {mode !== "3d" && (
              <div className="relative h-[460px] overflow-hidden rounded-[24px] border border-line bg-ivoire xl:h-[520px]">
                <div className="absolute inset-0 p-4">
                  <StudioCanvas
                    surface={shownSurface}
                    zone={{ maxWidthMm: W, maxHeightMm: H, label: zone.label, pattern: zone.pattern ?? null }}
                    allOver={doc.allOver ?? null}
                    garmentColor={color.hex}
                    selectedId={selectedId}
                    issueLayerIds={new Set(zoneIssues.filter((i) => i.severity === "error" && i.layerId).map((i) => i.layerId!))}
                    imageUrls={urls}
                    onSelect={assistantOpen ? () => undefined : setSelectedId}
                    onPreview={(id, patch) => history.preview(patchLayer(id, patch))}
                    onCommit={() => history.commit((d) => d)}
                    // while a team piece is previewed, the shown text is not the sample: never store its size
                    onMeasure={previewEntry ? () => undefined : (id, w, h) => history.silent(patchLayer(id, { widthMm: Math.round(w * 10) / 10, heightMm: Math.round(h * 10) / 10 }))}
                  />
                </div>
                {surface.layers.length === 0 && !assistantOpen && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-6 grid place-items-center">
                    <p className="rounded-full bg-brun/85 px-4 py-2 text-sm font-semibold text-ivoire">{t("Ajoutez un texte, une image ou une forme avec les outils", "Add a text, an image or a shape with the tools")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          {notice && <p role="alert" className="text-sm text-error">⚠ {notice}</p>}
          {rightsGate && (
            <RightsGate onCancel={() => setRightsGate(null)}
              onAccept={() => { setRightsOk(true); if (userId) { try { localStorage.setItem(rightsKey(userId), new Date().toISOString()); } catch { /* storage blocked */ } } const go = rightsGate; setRightsGate(null); go(); }} />
          )}
        </div>

        {/* Side panel */}
        <aside className="grid content-start gap-5 border-t border-line bg-ivoire p-4 lg:border-l lg:border-t-0">
          {template && <TemplateSavePanel title={template.title} status={template.status} saving={saving} onSave={() => void saveTemplateDoc()} />}
          {assistantOpen && assistant ? (
            <AssistantPanel templateId={assistant.id} title={assistant.title} description={assistant.description} fields={fields} busy={photoBusy}
              onText={(f, text) => { history.commit((d) => fillText(d, f.layerId, text)); if (f.zoneKey !== zone.key) setZoneKey(f.zoneKey); }}
              onPhoto={(f, file) => void fillPhotoField(f, file)} guard={requireRights}
              onFree={() => setAssistantOpen(false)} />
          ) : null}
          {assistantOpen && unfilled.length > 0 && (
            <p className="rounded-lg bg-ocre/20 px-3 py-2 text-sm">ⓘ À personnaliser : {unfilled.map((f) => f.label).join(", ")}.</p>
          )}
          {!assistantOpen && (<>
          {allOverProduct && (
            <Panel title={t("Motif continu (tout le vêtement)", "All-over motif (whole garment)")}>
              <AllOverPicker value={doc.allOver ?? null} onChange={(allOver) => history.commit((d) => {
                const { allOver: _old, ...rest } = d;
                return allOver ? { ...rest, allOver } : rest;
              })} />
            </Panel>
          )}
          <Panel title={t("Technique pour cette zone", "Technique for this area")}>
            <div className="flex flex-wrap gap-2">
              {zone.techniques.map((t) => (
                <button key={t} type="button" aria-pressed={surface.technique === t}
                  onClick={() => history.commit((d) => updateSurface(d, (s) => ({ ...s, technique: t })))}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${surface.technique === t ? "bg-terra text-white" : "border border-line"}`}>{TECHNIQUE_LABEL[t]}</button>
              ))}
            </div>
          </Panel>

          {selected && product.zones.length > 1 && (
            <Panel title={t("Placer ici en un clic", "Move here in one click")}>
              <div className="flex flex-wrap gap-2">
                {product.zones.filter((z) => z.key !== zone.key).map((z) => (
                  <button key={z.key} type="button" className={btn} onClick={() => moveToZone(selected.id, z.key)}>{z.label}</button>
                ))}
              </div>
            </Panel>
          )}
          {selected ? (
            <Properties key={selected.id} layer={selected} zone={{ W, H }} onChange={(patch) => commitPatch(selected.id, patch)}
              imageUrl={selected.type === "image" ? urls[selected.src] : undefined}
              onReplace={(next) => history.commit((d) => updateSurface(d, (s) => ({ ...s, layers: s.layers.map((l) => (l.id === next.id ? next : l)) })))}
              onUrl={(src, url) => setUrls((u) => ({ ...u, [src]: url }))}
              onDelete={() => removeLayer(selected.id)} onDuplicate={() => duplicate(selected)} onReorder={(dir) => reorder(selected.id, dir)} onDone={() => setSelectedId(null)}
              templateMode={Boolean(template)} />
          ) : (
            <Panel title={`Calques · ${zone.label}`}>
              {surface.layers.length === 0 ? <p className="text-sm text-muted">{t("Aucun élément dans cette zone.", "Nothing in this area yet.")}</p> : (
                <ul className="grid gap-1.5">
                  {[...surface.layers].reverse().map((l) => (
                    <li key={l.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
                      <button type="button" className="min-w-0 flex-1 truncate text-left font-semibold" onClick={() => setSelectedId(l.id)}>{layerName(l)}</button>
                      <button type="button" className="text-xs text-muted" onClick={() => commitPatch(l.id, { hidden: !l.hidden })} aria-label={l.hidden ? "Afficher" : "Masquer"}>{l.hidden ? "Afficher" : "Masquer"}</button>
                      <button type="button" className="text-xs text-muted" onClick={() => commitPatch(l.id, { locked: !l.locked })} aria-label={l.locked ? "Déverrouiller" : "Verrouiller"}>{l.locked ? "🔒" : "🔓"}</button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          </>)}

          <Panel title={t("Vérification de fabrication", "Production check")}>
            {allIssues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ok">✓ {decorations.length ? t("Votre création peut être fabriquée telle quelle.", "Your design can be produced as it is.") : t("Rien à vérifier pour l'instant.", "Nothing to check yet.")}</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {allIssues.map((i, k) => (
                  <li key={k} className={`rounded-lg px-3 py-2 ${i.severity === "error" ? "bg-error/10 text-error" : "bg-ocre/20 text-fg"}`}>
                    {i.severity === "error" ? "⚠ " : "ⓘ "}{i.message}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t("Prix", "Price")}>
            {b2b ? (
              <div className="grid gap-2">
                <div className="grid gap-1 rounded-xl bg-indigo-900 p-4 text-ivoire">
                  <span className="display text-3xl">{fcfa(b2b.goodsTotal)} <span className="font-sans text-sm text-ivoire/70">TTC · prix du devis</span></span>
                  <span className="text-sm text-ivoire/80">{b2b.quantity} pièces{b2b.sizes ? ` (${Object.entries(b2b.sizes).map(([s, n]) => `${s} × ${n}`).join(", ")})` : ""} · livraison en plus</span>
                  {b2b.depositDue != null && <span className="text-sm text-ivoire/80">Acompte à la commande : {fcfa(b2b.depositDue)}</span>}
                  <span className="text-xs text-ivoire/60">Valable jusqu&apos;au {new Date(b2b.validUntil).toLocaleDateString("fr-SN")} · fabriqué en {b2b.leadTimeDays} jours ouvrés après le BAT</span>
                </div>
                <ul className="grid gap-1 text-xs text-muted">
                  {b2b.decorations.map((d) => <li key={`${d.zoneKey}-${d.technique}`}>Prévu : {product.zones.find((z) => z.key === d.zoneKey)?.label ?? d.zoneKey} · {TECHNIQUE_LABEL[d.technique as Technique] ?? d.technique} · jusqu&apos;à {Math.round(d.widthMm / 10)} × {Math.round(d.heightMm / 10)} cm</li>)}
                </ul>
                {quoteProblems.length > 0 && <ul className="grid gap-1 text-sm text-error">{quoteProblems.map((m) => <li key={m}>⚠ Hors devis : {m}</li>)}</ul>}
              </div>
            ) : (<>
            <div className="flex items-center gap-2">
              <label htmlFor="qty" className="text-sm">{t("Quantité", "Quantity")}</label>
              <input id="qty" type="number" min={1} max={5000} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))} className={`${field} w-24`} />
            </div>
            {decorations.length === 0 ? <p className="text-sm text-muted">{t("Le prix s'affiche dès que vous ajoutez un élément.", "The price appears as soon as you add something.")}</p>
              : !price ? <p className="text-sm text-muted">{t("Calcul…", "Calculating…")}</p>
              : price.ok ? (
                <div className={`grid gap-1 rounded-xl bg-brun p-4 text-ivoire ${pricing ? "opacity-60" : ""}`} aria-live="polite">
                  <span className="display text-3xl">{fcfaIn(lang, price.unitPrice)} <span className="font-sans text-sm text-ivoire/70">{t("/ pièce TTC", "/ piece incl. VAT")}</span></span>
                  <span className="text-sm text-ivoire/80">{lang === "en" ? `Total ${fcfaIn(lang, price.total)} for ${price.quantity} piece${price.quantity > 1 ? "s" : ""}${price.setupFee ? `, including ${fcfaIn(lang, price.setupFee)} set-up` : ""}` : `Total ${fcfa(price.total)} pour ${price.quantity} pièce${price.quantity > 1 ? "s" : ""}${price.setupFee ? `, dont ${fcfa(price.setupFee)} de préparation` : ""}`}</span>
                  {price.depositDue && <span className="text-sm text-ivoire/80">{t("Acompte à la commande :", "Deposit when ordering:")} {fcfaIn(lang, price.depositDue)}</span>}
                  <span className="text-xs text-ivoire/60">{lang === "en" ? `Made in ${price.leadTimeDays} working days after proof approval` : `Fabriqué en ${price.leadTimeDays} jours ouvrés après le BAT`}</span>
                </div>
              ) : <p className="text-sm text-muted">{price.message}</p>}
            </>)}
            {!template && <>
            <label className="grid gap-1 text-xs font-semibold text-muted">{t("Nom de la création", "Design name")}
              <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={field} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} disabled={saving} onClick={() => void saveToAccount()}>{saving ? t("Enregistrement…", "Saving…") : designId ? t("Enregistrer", "Save") : t("Enregistrer dans mon compte", "Save to my account")}</button>
              {!correction && (
                <button type="button" className="btn btn-terra !py-2 text-sm disabled:opacity-50" disabled={decorations.length === 0 || blocking(allIssues) || quoteProblems.length > 0}
                  onClick={() => {
                    if (unfilled.length && !window.confirm(`Ces champs n'ont pas été personnalisés : ${unfilled.map((f) => f.label).join(", ")}. La photo d'exemple ou le texte vide seront imprimés tels quels. Continuer quand même ?`)) return;
                    if (userId) setOrdering(true); else router.push(`/connexion?suite=${encodeURIComponent(`/studio/${product.slug}${assistant ? `?modele=${assistant.slug}` : ""}`)}`);
                  }}>
                  {t("Commander", "Order")}
                </button>
              )}
            </div>
            {blocking(allIssues) && <p className="text-xs text-error">{t("Corrigez les points bloquants pour pouvoir commander.", "Fix the blocking issues to be able to order.")}</p>}
            <p className="text-xs text-muted">{designId ? t("Enregistrée dans votre compte.", "Saved to your account.") : t("Enregistrée automatiquement sur cet appareil.", "Saved automatically on this device.")}</p>
            </>}
          </Panel>
          {correction && resubmit && (
            <CorrectionPanel correction={correction} issues={allIssues.length} blocked={blocking(allIssues) || decorations.length === 0}
              onSend={async (acceptWarnings, acceptedSurcharge) => {
                const saved = await saveToAccount();
                if (!saved) return { error: "Enregistrez d'abord votre création." };
                // Send exactly what was saved (images already on storage), not a possibly stale state.
                const r = await resubmit({ orderId: correction.orderId, document: saved.doc, acceptWarnings, acceptedSurcharge });
                if ("error" in r) return r;
                router.push(`/compte/commandes/${correction.orderId}`);
                return null;
              }} />
          )}
          {ordering && (
            <OrderPanel sizes={color.sizes} issues={allIssues.length} price={price} b2b={b2b ?? null}
              team={teamMode ? { doc, zones: product.zones, roster, setRoster, previewIdx, setPreviewIdx } : null}
              onQuantity={setQuantity} onCancel={() => setOrdering(false)}
              onConfirm={async (form) => {
                const saved = await saveToAccount();
                if (!saved) return "Enregistrez d'abord votre création.";
                const r = await order({ designId: saved.id, ...form, ...(b2b ? { quoteId: b2b.id } : {}) });
                if ("error" in r) return r.error;
                try { localStorage.removeItem(draftKey); localStorage.removeItem(`${draftKey}:liste`); } catch { /* ignore */ }
                router.push(`/compte/commandes/${r.orderId}`);
                return null;
              }} />
          )}
        </aside>
      </div>
    </div>
  );
}

/** E18b: SAWWA motifs aligned on the whole garment, across the seams. */
function AllOverPicker({ value, onChange }: { value: AllOver | null; onChange: (v: AllOver | null) => void }) {
  const v = value ?? { motif: "losanges" as MotifKind, colors: ["#2A1A12", "#C9923E"] as [string, string], tileMm: 60 };
  const set = (patch: Partial<AllOver>) => onChange({ ...v, ...patch });
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ALL_OVER_MOTIFS) as MotifKind[]).map((k) => (
          <button key={k} type="button" aria-pressed={value?.motif === k} onClick={() => set({ motif: k })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${value?.motif === k ? "bg-terra text-white" : "border border-line"}`}>{ALL_OVER_MOTIFS[k]}</button>
        ))}
      </div>
      {value && (
        <>
          {([0, 1] as const).map((i) => (
            <div key={i} className="grid gap-1">
              <span className="text-xs font-semibold text-muted">{i === 0 ? "Couleur de fond" : "Couleur du motif"}</span>
              <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" aria-label={c} aria-pressed={v.colors[i] === c} onClick={() => set({ colors: (i === 0 ? [c, v.colors[1]] : [v.colors[0], c]) as [string, string] })}
                    className={`size-7 rounded-full border-2 ${v.colors[i] === c ? "border-terra ring-2 ring-terra ring-offset-1" : "border-brun/20"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          ))}
          <label className="grid gap-1 text-xs font-semibold text-muted">Taille du motif ({v.tileMm / 10} cm)
            <input type="range" min={20} max={200} step={10} value={v.tileMm} onChange={(e) => set({ tileMm: Number(e.target.value) })} />
          </label>
          <button type="button" className={`${btn} w-fit`} onClick={() => onChange(null)}>Retirer le motif</button>
        </>
      )}
      <p className="text-xs text-muted">Le motif est posé sur tout le vêtement et se raccorde d&apos;une pièce à l&apos;autre, coutures comprises. Vos textes et images se placent par-dessus, pièce par pièce.</p>
    </div>
  );
}

function Tool({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid min-w-16 place-items-center gap-1 rounded-xl border border-line bg-surface px-2 py-2.5 text-xs font-bold hover:border-terra hover:text-terra">
      <span className="text-xl leading-none" aria-hidden="true">{icon}</span>{label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="eyebrow flex items-center gap-2 text-muted"><span className="losange !h-2 !w-2" aria-hidden="true" />{title}</h2>
      {children}
    </section>
  );
}

function layerName(l: Layer) {
  if (l.type === "text") return `T  ${l.text || "(vide)"}`;
  if (l.type === "image") return `▣  ${l.name}`;
  if (l.type === "vector") return `✦  ${l.name} (${new Set(l.paths.map((p) => p.fill)).size} couleurs)`;
  return { rect: "■  Carré", circle: "●  Cercle", losange: "◆  Losange" }[l.shape];
}

function Num({ label, value, onChange, step = 1, min, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; suffix?: string }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted">
      {label}{suffix ? ` (${suffix})` : ""}
      <input type="number" step={step} min={min} value={Math.round(value * 10) / 10} className={field}
        onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </label>
  );
}

function Properties({ layer: l, zone, onChange, onDelete, onDuplicate, onReorder, onDone, imageUrl, onReplace, onUrl, templateMode }: {
  layer: Layer; zone: { W: number; H: number }; onChange: (p: Partial<Layer>) => void; templateMode: boolean;
  imageUrl: string | undefined; onReplace: (next: Layer) => void; onUrl: (src: string, url: string) => void;
  onDelete: () => void; onDuplicate: () => void; onReorder: (dir: 1 | -1) => void; onDone: () => void;
}) {
  const ratio = l.heightMm / Math.max(l.widthMm, 0.1);
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow flex items-center gap-2 text-muted"><span className="losange !h-2 !w-2" aria-hidden="true" />{l.type === "text" ? "Texte" : l.type === "image" ? "Image" : l.type === "vector" ? "Logo vectoriel" : "Forme"}</h2>
        <button type="button" className="text-sm underline" onClick={onDone}>Terminé</button>
      </div>

      {templateMode && <FieldEditor layer={l} onChange={onChange} />}
      {l.type === "text" && <TextProps layer={l} onChange={onChange} />}
      {l.type === "text" && !templateMode && <PerItemEditor layer={l} onChange={onChange} />}
      {l.type === "image" && (
        <ImageTools layer={l} url={imageUrl} onReplace={onReplace} onUrl={onUrl} />
      )}
      {l.type === "image" && (
        <p className="text-sm text-muted">{l.name} · {l.pxWidth} × {l.pxHeight} px · <b className={effectiveDpi(l) < 150 ? "text-error" : effectiveDpi(l) < 200 ? "text-ocre-700" : "text-ok"}>{effectiveDpi(l)} dpi</b> à cette taille</p>
      )}
      {(l.type === "shape") && <ColorPicker value={l.fill} onChange={(fill) => onChange({ fill })} />}
      {l.type === "vector" && <VectorColors layer={l} onChange={onChange} />}

      {l.type !== "text" && (
        <div className="grid grid-cols-2 gap-2">
          <Num label="Largeur" suffix="mm" value={l.widthMm} min={3} onChange={(w) => onChange({ widthMm: w, heightMm: l.type === "shape" ? l.heightMm : w * ratio })} />
          <Num label="Hauteur" suffix="mm" value={l.heightMm} min={3} onChange={(h) => onChange({ heightMm: h, widthMm: l.type === "shape" ? l.widthMm : h / ratio })} />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Num label="X" suffix="mm" value={l.xMm} onChange={(xMm) => onChange({ xMm })} />
        <Num label="Y" suffix="mm" value={l.yMm} onChange={(yMm) => onChange({ yMm })} />
        <Num label="Angle" suffix="°" value={l.rotation} onChange={(rotation) => onChange({ rotation: ((rotation % 360) + 360) % 360 })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => onChange({ xMm: zone.W / 2 })}>Centrer ↔</button>
        <button type="button" className={btn} onClick={() => onChange({ yMm: zone.H / 2 })}>Centrer ↕</button>
        <button type="button" className={btn} onClick={() => onReorder(1)}>Avancer</button>
        <button type="button" className={btn} onClick={() => onReorder(-1)}>Reculer</button>
        <button type="button" className={btn} onClick={onDuplicate}>Dupliquer</button>
        <button type="button" className={`${btn} !text-error`} onClick={onDelete}>Supprimer</button>
      </div>
    </section>
  );
}

function TextProps({ layer: l, onChange }: { layer: TextLayer; onChange: (p: Partial<TextLayer>) => void }) {
  const [text, setText] = useState(l.text);
  useEffect(() => { const t = setTimeout(() => { if (text !== l.text) onChange({ text }); }, 300); return () => clearTimeout(t); });
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-xs font-semibold text-muted">Votre texte
        <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} className={`${field} text-base`} />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-muted">Police
        <select value={l.font} onChange={(e) => onChange({ font: e.target.value as FontKey })} className={field}>
          {(Object.keys(FONTS) as FontKey[]).map((k) => <option key={k} value={k}>{FONTS[k].label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Num label="Taille" suffix="mm" value={l.sizeMm} min={2} onChange={(sizeMm) => onChange({ sizeMm: Math.max(2, sizeMm) })} />
        <Num label="Espacement" suffix="em" step={0.05} value={l.letterSpacing ?? 0} onChange={(letterSpacing) => onChange({ letterSpacing })} />
      </div>
      <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(l.italic)} onChange={(e) => onChange({ italic: e.target.checked })} /> Italique</label>
      <ColorPicker value={l.fill} onChange={(fill) => onChange({ fill })} />
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-muted">Couleur</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} aria-pressed={value.toUpperCase() === c}
            className={`size-7 rounded-full border-2 ${value.toUpperCase() === c ? "border-terra ring-2 ring-terra ring-offset-1" : "border-brun/20"}`} style={{ background: c }} />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label="Autre couleur" className="h-7 w-10 cursor-pointer rounded border border-line" />
      </div>
    </div>
  );
}

function OrderPanel({ sizes, issues, price, onQuantity, onCancel, onConfirm, team, b2b }: {
  sizes: string[]; issues: number; price: Awaited<ReturnType<StudioProps["quote"]>> | null;
  onQuantity: (n: number) => void; onCancel: () => void;
  onConfirm: (form: { sizes: Record<string, number>; roster: RosterEntry[] | null; delivery: string; acceptWarnings: boolean; address: { name: string; phone: string; district: string; landmark: string; city: string } }) => Promise<string | null>;
  team: { doc: DesignDocument; zones: StudioZoneProps[]; roster: RosterEntry[]; setRoster: (r: RosterEntry[]) => void; previewIdx: number | null; setPreviewIdx: (i: number | null) => void } | null;
  b2b: B2bForStudio | null;
}) {
  const [qty, setQty] = useState<Record<string, number>>(b2b?.sizes ?? Object.fromEntries(sizes.map((s, i) => [s, i === Math.floor(sizes.length / 2) ? (b2b ? b2b.quantity : 1) : 0])));
  const [delivery, setDelivery] = useState<DeliveryKey>("dakar");
  const [address, setAddress] = useState({ name: "", phone: "", district: "", landmark: "", city: "Dakar" });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = team ? team.roster.length : Object.values(qty).reduce((a, b) => a + b, 0);
  useEffect(() => { if (total > 0) onQuantity(total); }, [total, onQuantity]);
  const ship = DELIVERY_OPTIONS[delivery].price;
  const quantityOk = !b2b || total === b2b.quantity;
  return (
    <section className="grid gap-3 rounded-2xl border-2 border-terra bg-surface p-4" aria-labelledby="order-title">
      <h2 id="order-title" className="display on-light text-2xl">Votre commande</h2>
      {team ? (
        <RosterEditor doc={team.doc} sizes={sizes} zones={team.zones} value={team.roster} onChange={team.setRoster}
          previewIndex={team.previewIdx} onPreview={team.setPreviewIdx} />
      ) : (
      <fieldset className="grid gap-2">
        <legend className="text-xs font-semibold text-muted">Quantité par taille</legend>
        <div className="grid grid-cols-3 gap-2">
          {sizes.map((s) => (
            <label key={s} className="grid gap-1 text-xs font-bold">{s}
              <input type="number" min={0} max={5000} value={qty[s] ?? 0} className={field} disabled={Boolean(b2b?.sizes)}
                onChange={(e) => setQty((q) => ({ ...q, [s]: Math.max(0, Math.min(5000, Number(e.target.value) || 0)) }))} />
            </label>
          ))}
        </div>
        <span className="text-sm">Total : <b>{total}</b> pièce{total > 1 ? "s" : ""}</span>
      </fieldset>
      )}
      {!quantityOk && <p className="text-sm text-error">Le devis porte sur {b2b!.quantity} pièces : la liste ou les tailles doivent en compter exactement autant (actuellement {total}).</p>}
      <label className="grid gap-1 text-xs font-semibold text-muted">Livraison
        <select value={delivery} onChange={(e) => setDelivery(e.target.value as DeliveryKey)} className={field}>
          {(Object.keys(DELIVERY_OPTIONS) as DeliveryKey[]).map((k) => (
            <option key={k} value={k}>{DELIVERY_OPTIONS[k].label} — {DELIVERY_OPTIONS[k].price ? fcfa(DELIVERY_OPTIONS[k].price) : "gratuit"}</option>
          ))}
        </select>
      </label>
      {([["name", "Nom de la personne qui reçoit"], ["phone", "Téléphone (WhatsApp de préférence)"], ["district", "Quartier"], ["landmark", "Point de repère"], ["city", "Ville"]] as const).map(([k, label]) => (
        <label key={k} className="grid gap-1 text-xs font-semibold text-muted">{label}
          <input value={address[k]} onChange={(e) => setAddress((a) => ({ ...a, [k]: e.target.value }))} className={field}
            inputMode={k === "phone" ? "tel" : undefined} autoComplete={k === "name" ? "name" : k === "phone" ? "tel" : undefined} />
        </label>
      ))}
      {issues > 0 && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" />
          J&apos;ai lu les remarques de fabrication et je souhaite commander quand même.
        </label>
      )}
      {b2b && quantityOk && (
        <p className="text-sm">Articles {fcfa(b2b.goodsTotal)} (prix du devis) + livraison {ship ? fcfa(ship) : "gratuite"} = <b>{fcfa(b2b.goodsTotal + ship)}</b> TTC</p>
      )}
      {!b2b && price?.ok && price.quantity === total && (
        <p className="text-sm">Articles {fcfa(price.total)} + livraison {ship ? fcfa(ship) : "gratuite"} = <b>{fcfa(price.total + ship)}</b> TTC</p>
      )}
      <p className="text-xs text-muted">Paiement après confirmation : Wave, Orange Money ou virement. L&apos;atelier vérifie votre fichier (BAT) avant de produire ; si une correction est nécessaire, vous pourrez accepter, corriger ou annuler et être remboursé.</p>
      {error && <p role="alert" className="text-sm text-error">⚠ {error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-terra !py-2 text-sm disabled:opacity-50" disabled={busy || total < 1 || !quantityOk}
          onClick={async () => { setBusy(true); setError(null); const e = await onConfirm({ sizes: team ? {} : qty, roster: team ? team.roster : null, delivery, acceptWarnings: accept, address }); if (e) setError(e); setBusy(false); }}>
          {busy ? "Envoi…" : "Confirmer la commande"}
        </button>
        <button type="button" className={btn} onClick={onCancel}>Annuler</button>
      </div>
    </section>
  );
}

function CorrectionPanel({ correction, issues, blocked, onSend }: {
  correction: { orderId: string; number: string; comment: string | null }; issues: number; blocked: boolean;
  onSend: (acceptWarnings: boolean, acceptedSurcharge: number | null) => Promise<{ error: string; surcharge?: number } | null>;
}) {
  const [accept, setAccept] = useState(false);
  const [surcharge, setSurcharge] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (accepted: number | null) => {
    setBusy(true); setError(null);
    const r = await onSend(accept, accepted);
    if (r) { setError(r.error); if (r.surcharge) setSurcharge(r.surcharge); }
    setBusy(false);
  };
  return (
    <section className="grid gap-3 rounded-2xl border-2 border-ocre bg-surface p-4" aria-labelledby="correction-title">
      <h2 id="correction-title" className="display on-light text-2xl">Correction de {correction.number}</h2>
      {correction.comment && <p className="rounded-lg bg-ocre/20 p-3 text-sm">L&apos;atelier : « {correction.comment} »</p>}
      <p className="text-xs text-muted">Corrigez votre création puis renvoyez-la : l&apos;atelier vérifie la nouvelle version (nouveau BAT). La couleur et les tailles restent celles de la commande.</p>
      {issues > 0 && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" />
          J&apos;ai lu les remarques de fabrication et je renvoie quand même.
        </label>
      )}
      {error && <p role="alert" className="text-sm text-error">⚠ {error}</p>}
      <div className="flex flex-wrap gap-2">
        {surcharge ? (
          <button type="button" className="btn btn-terra !py-2 text-sm" disabled={busy} onClick={() => void send(surcharge)}>
            {busy ? "Envoi…" : `J'accepte le supplément de ${fcfa(surcharge)} et je renvoie`}
          </button>
        ) : (
          <button type="button" className="btn btn-terra !py-2 text-sm disabled:opacity-50" disabled={busy || blocked} onClick={() => void send(null)}>
            {busy ? "Envoi…" : "Renvoyer au BAT"}
          </button>
        )}
      </div>
      {blocked && <p className="text-xs text-error">Corrigez les points bloquants pour pouvoir renvoyer.</p>}
    </section>
  );
}

/** Each colour of a vectorised logo can be changed (all its shapes at once): handy to match a thread or ink colour. */
function VectorColors({ layer, onChange }: { layer: Extract<Layer, { type: "vector" }>; onChange: (p: Partial<Layer>) => void }) {
  const colors = [...new Set(layer.paths.map((p) => p.fill.toUpperCase()))];
  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-muted">Couleurs du logo ({colors.length})</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <label key={c} className="inline-flex items-center gap-1 text-xs">
            <input type="color" value={c} aria-label={`Remplacer la couleur ${c}`} className="h-7 w-9 cursor-pointer rounded border border-line"
              onChange={(e) => onChange({ paths: layer.paths.map((p) => (p.fill.toUpperCase() === c ? { ...p, fill: e.target.value.toUpperCase() } : p)) } as Partial<Layer>)} />
            <span className="tabular-nums">{c}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
