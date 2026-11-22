"use client";

import { useState, useTransition } from "react";
import { TECHNIQUE_LABEL, type Technique } from "@sawwa/catalog";
import type { QuoteBuildInput } from "../actions";

type Zone = { key: string; label: string; maxWidthMm: number; maxHeightMm: number; techniques: Technique[] };
type Preview = { ok: true; goodsTotal: number; setupFee: number; tax: number; depositDue: number | null; vendorCost: number; margin: number; leadTimeDays: number } | { error: string };
const field = "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm";
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Team tool: build the quote, see the price, workshop cost and margin, then send. */
export function QuoteBuilder({ requestId, productId, colors, sizes: productSizes, zones, defaultQuantity, preview, send }: {
  requestId: string; productId: string; colors: string[]; sizes: string[]; zones: Zone[]; defaultQuantity: number;
  preview: (i: QuoteBuildInput) => Promise<Preview>; send: (i: QuoteBuildInput) => Promise<{ ok?: string; error?: string }>;
}) {
  const [colorKey, setColor] = useState(colors[0] ?? "");
  const [quantity, setQuantity] = useState(defaultQuantity);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [decos, setDecos] = useState([{ zoneKey: zones[0]?.key ?? "", technique: zones[0]?.techniques[0] ?? "dtf", widthCm: 25, heightCm: 30, colors: 1 }]);
  const [validityDays, setValidity] = useState(30);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Preview | null>(null);
  const [sent, setSent] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const sizesTotal = Object.values(sizes).reduce((a, b) => a + b, 0);
  const input = (): QuoteBuildInput => ({
    requestId, productId, colorKey, quantity, sizes: sizesTotal ? sizes : null, validityDays, note,
    decorations: decos.map((d) => ({ zoneKey: d.zoneKey, technique: d.technique, widthMm: Math.round(d.widthCm * 10), heightMm: Math.round(d.heightCm * 10), colors: d.colors })),
  });
  const setDeco = (i: number, patch: Partial<(typeof decos)[number]>) => setDecos((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-semibold text-muted">Couleur
          <select className={field} value={colorKey} onChange={(e) => setColor(e.target.value)}>{colors.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">Quantité
          <input className={field} type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">Validité (jours)
          <input className={field} type="number" min={1} max={90} value={validityDays} onChange={(e) => setValidity(Number(e.target.value) || 30)} />
        </label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-xs font-semibold text-muted">Tailles (facultatif ; vide = répartition libre par le client){sizesTotal ? ` · total ${sizesTotal}` : ""}</legend>
        <div className="flex flex-wrap gap-2">
          {productSizes.map((s) => (
            <label key={s} className="grid w-16 gap-1 text-xs font-bold">{s}
              <input className={field} type="number" min={0} value={sizes[s] ?? 0} onChange={(e) => setSizes((x) => ({ ...x, [s]: Math.max(0, Number(e.target.value) || 0) }))} />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="text-xs font-semibold text-muted">Marquages devisés (tailles maximales)</legend>
        {decos.map((d, i) => {
          const z = zones.find((x) => x.key === d.zoneKey);
          return (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-line p-2 sm:grid-cols-6">
              <select className={`${field} sm:col-span-2`} value={d.zoneKey} aria-label="Zone" onChange={(e) => { const nz = zones.find((x) => x.key === e.target.value); setDeco(i, { zoneKey: e.target.value, technique: nz?.techniques[0] ?? d.technique }); }}>
                {zones.map((x) => <option key={x.key} value={x.key}>{x.label} ({x.maxWidthMm / 10}×{x.maxHeightMm / 10} cm)</option>)}
              </select>
              <select className={field} value={d.technique} aria-label="Technique" onChange={(e) => setDeco(i, { technique: e.target.value as Technique })}>
                {(z?.techniques ?? []).map((t) => <option key={t} value={t}>{TECHNIQUE_LABEL[t]}</option>)}
              </select>
              <input className={field} type="number" step="0.5" min={1} value={d.widthCm} aria-label="Largeur (cm)" onChange={(e) => setDeco(i, { widthCm: Number(e.target.value) || 1 })} />
              <input className={field} type="number" step="0.5" min={1} value={d.heightCm} aria-label="Hauteur (cm)" onChange={(e) => setDeco(i, { heightCm: Number(e.target.value) || 1 })} />
              <div className="flex gap-1">
                <input className={field} type="number" min={1} max={20} value={d.colors} aria-label="Couleurs" onChange={(e) => setDeco(i, { colors: Number(e.target.value) || 1 })} />
                {decos.length > 1 && <button type="button" className="text-error" aria-label="Retirer" onClick={() => setDecos((all) => all.filter((_, j) => j !== i))}>✕</button>}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted">Colonnes : zone · technique · largeur cm · hauteur cm · couleurs (broderie, sérigraphie).</p>
        {decos.length < 4 && <button type="button" className="w-fit text-sm underline" onClick={() => setDecos((all) => [...all, { ...all[0]!, zoneKey: zones[all.length % zones.length]?.key ?? all[0]!.zoneKey }])}>+ Ajouter un marquage</button>}
      </fieldset>
      <label className="grid gap-1 text-xs font-semibold text-muted">Message au client (facultatif)
        <textarea className={field} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : prix incluant noms et numéros au dos ; BAT envoyé sous 24 h après la commande." />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-md border border-line bg-surface px-4 py-2" disabled={pending} onClick={() => start(async () => { setSent(null); setResult(await preview(input())); })}>Calculer</button>
        <button type="button" className="rounded-md bg-action px-4 py-2 font-bold text-on-action disabled:opacity-50" disabled={pending || !result || "error" in result}
          onClick={() => start(async () => setSent(await send(input())))}>Envoyer le devis au client</button>
      </div>
      {result && ("error" in result ? <p role="alert" className="text-error">⚠ {result.error}</p> : (
        <div className="grid gap-1 rounded-xl bg-sable p-3 text-sm" aria-live="polite">
          <b>Client : {fcfa(result.goodsTotal)} TTC hors livraison · {fcfa(Math.round(result.goodsTotal / quantity))} / pièce</b>
          <span>Préparation {fcfa(result.setupFee)} · TVA {fcfa(result.tax)}{result.depositDue != null ? ` · acompte ${fcfa(result.depositDue)}` : ""} · {result.leadTimeDays} j ouvrés</span>
          <span className="text-muted">Interne : coût atelier {fcfa(result.vendorCost)} HT · marge SAWWA {fcfa(result.margin)} HT</span>
        </div>
      ))}
      {sent?.ok && <p role="status" className="text-ok">✓ {sent.ok}</p>}
      {sent?.error && <p role="alert" className="text-error">⚠ {sent.error}</p>}
    </div>
  );
}
