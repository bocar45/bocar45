"use client";

import { useMemo, useState } from "react";
import { checkRoster, parseRosterText, rosterKeys, type DesignDocument, type PerItem, type RosterEntry, type TextLayer } from "@sawwa/design";

const btn = "inline-flex items-center justify-center gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-sable disabled:opacity-40";
const field = "w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm";

/** Selected text: make it change on every piece (player's name or number). */
export function PerItemEditor({ layer, onChange }: { layer: TextLayer; onChange: (patch: Partial<TextLayer>) => void }) {
  const p = layer.perItem;
  const set = (next: PerItem | undefined) => onChange({ perItem: next });
  return (
    <section className="grid gap-2 rounded-xl border border-line bg-surface p-3" aria-label="Nom ou numéro par pièce">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={Boolean(p)} disabled={Boolean(layer.field)}
          onChange={(e) => set(e.target.checked ? (/^\d+$/.test(layer.text) ? { key: "number", maxLength: 2 } : { key: "name", maxLength: 12 }) : undefined)} />
        Différent sur chaque pièce (équipe)
      </label>
      {p && (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-semibold text-muted">Ce texte est
            <select className={field} value={p.key} onChange={(e) => set(e.target.value === "number" ? { key: "number", maxLength: 2 } : { key: "name", maxLength: 12 })}>
              <option value="name">le nom</option>
              <option value="number">le numéro</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted">{p.key === "number" ? "Chiffres au plus" : "Lettres au plus"}
            <input className={field} type="number" min={1} max={p.key === "number" ? 3 : 30} value={p.maxLength}
              onChange={(e) => set({ ...p, maxLength: Math.max(1, Math.min(p.key === "number" ? 3 : 30, Math.round(Number(e.target.value)) || 1)) })} />
          </label>
          <p className="col-span-2 text-xs text-muted">Le texte affiché sert d&apos;exemple. À la commande, vous donnerez la liste : taille, nom et numéro de chaque pièce.</p>
        </div>
      )}
    </section>
  );
}

/** One line per piece: size, name, number. Paste from a spreadsheet or a WhatsApp message. Checked live. */
export function RosterEditor({ doc, sizes, zones, value, onChange, onPreview, previewIndex }: {
  doc: DesignDocument; sizes: string[]; zones: { key: string; maxWidthMm: number }[];
  value: RosterEntry[]; onChange: (next: RosterEntry[]) => void;
  onPreview: (index: number | null) => void; previewIndex: number | null;
}) {
  const keys = rosterKeys(doc);
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const check = useMemo(() => checkRoster(doc, value, sizes, zones), [doc, value, sizes, zones]);
  const set = (i: number, patch: Partial<RosterEntry>) => onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const add = () => onChange([...value, { size: value.at(-1)?.size ?? sizes[Math.floor(sizes.length / 2)] ?? "" }]);
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-semibold text-muted">Liste des pièces ({value.length})</legend>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-sable text-left text-xs text-muted">
            <tr><th className="p-1.5">#</th><th className="p-1.5">Taille</th>{keys.name && <th className="p-1.5">Nom</th>}{keys.number && <th className="p-1.5">N°</th>}<th className="p-1.5" /></tr>
          </thead>
          <tbody>
            {value.map((e, i) => (
              <tr key={i} className={`border-t border-line ${previewIndex === i ? "bg-ocre/20" : ""}`}>
                <td className="p-1 text-xs tabular-nums text-muted">
                  <button type="button" className="underline" title="Voir cette pièce" onClick={() => onPreview(previewIndex === i ? null : i)}>{i + 1}</button>
                </td>
                <td className="p-1">
                  <select className={field} value={e.size} aria-label={`Taille, ligne ${i + 1}`} onChange={(ev) => set(i, { size: ev.target.value })}>
                    {!sizes.includes(e.size) && <option value={e.size}>{e.size || "—"}</option>}
                    {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                {keys.name && <td className="p-1"><input className={field} value={e.name ?? ""} maxLength={keys.name.maxLength + 10} aria-label={`Nom, ligne ${i + 1}`} onChange={(ev) => set(i, { name: ev.target.value })} onFocus={() => onPreview(i)} /></td>}
                {keys.number && <td className="w-16 p-1"><input className={field} value={e.number ?? ""} inputMode="numeric" maxLength={keys.number.maxLength + 2} aria-label={`Numéro, ligne ${i + 1}`} onChange={(ev) => set(i, { number: ev.target.value })} onFocus={() => onPreview(i)} /></td>}
                <td className="p-1"><button type="button" className="text-xs text-error" aria-label={`Supprimer la ligne ${i + 1}`} onClick={() => { onChange(value.filter((_, j) => j !== i)); onPreview(null); }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={add}>+ Ajouter une pièce</button>
        <button type="button" className={btn} onClick={() => setPasteOpen((o) => !o)}>Coller une liste</button>
      </div>
      {pasteOpen && (
        <div className="grid gap-2">
          <textarea className={field} rows={5} value={paste} onChange={(e) => setPaste(e.target.value)}
            placeholder={"Une pièce par ligne : nom, numéro, taille\nDIOP ; 10 ; M\nFALL ; 7 ; XL"} aria-label="Liste à coller" />
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => { const rows = parseRosterText(paste, sizes); if (rows.length) { onChange([...value.filter((e) => e.name || e.number), ...rows]); setPaste(""); setPasteOpen(false); } }}>Ajouter ces lignes</button>
            <span className="self-center text-xs text-muted">Copiée d&apos;un tableur ou d&apos;un message ; colonnes dans n&apos;importe quel ordre.</span>
          </div>
        </div>
      )}
      <span className="text-sm">Total : <b>{value.length}</b> pièce{value.length > 1 ? "s" : ""}</span>
      {check.errors.length > 0 && <ul className="grid gap-1 text-xs text-error">{check.errors.slice(0, 6).map((m) => <li key={m}>⚠ {m}</li>)}{check.errors.length > 6 && <li>… et {check.errors.length - 6} autres</li>}</ul>}
      {check.warnings.length > 0 && <ul className="grid gap-1 text-xs">{check.warnings.slice(0, 4).map((m) => <li key={m}>ⓘ {m}</li>)}</ul>}
    </fieldset>
  );
}
