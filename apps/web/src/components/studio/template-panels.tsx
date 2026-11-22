"use client";

import { useRef } from "react";
import { DEFAULT_TEXT_MAX, type FieldRef, type Layer, type TemplateField } from "@sawwa/design";

const btn = "inline-flex items-center justify-center gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold hover:bg-sable disabled:opacity-40";
const field = "w-full rounded-md border border-line bg-bg px-2 py-1.5 text-sm";

/** Catalogue team: mark the selected element as a customer field (photo on an image, text on a text). */
export function FieldEditor({ layer, onChange }: { layer: Layer; onChange: (patch: Partial<Layer>) => void }) {
  const kind: TemplateField["kind"] | null = layer.type === "image" ? "photo" : layer.type === "text" ? "text" : null;
  if (!kind) return <p className="text-xs text-muted">Élément fixe du modèle. Verrouillez-le pour que le client ne le déplace pas par erreur.</p>;
  const f = layer.field;
  const set = (next: TemplateField | undefined) => onChange({ field: next });
  return (
    <section className="grid gap-2 rounded-xl border-2 border-dashed border-ocre p-3" aria-label="Champ du client">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={Boolean(f)} onChange={(e) => set(e.target.checked ? { kind, label: kind === "photo" ? "Votre photo" : "Votre texte", ...(kind === "text" ? { maxLength: DEFAULT_TEXT_MAX } : {}) } : undefined)} />
        {kind === "photo" ? "Le client remplace cette image par sa photo" : "Le client écrit ce texte"}
      </label>
      {f && (
        <div className="grid gap-2">
          <label className="grid gap-1 text-xs font-semibold text-muted">Question posée au client
            <input className={field} maxLength={60} value={f.label} onChange={(e) => set({ ...f, label: e.target.value })} />
          </label>
          {kind === "text" && (
            <label className="grid gap-1 text-xs font-semibold text-muted">Nombre de caractères au plus
              <input className={field} type="number" min={1} max={200} value={f.maxLength ?? DEFAULT_TEXT_MAX}
                onChange={(e) => set({ ...f, maxLength: Math.max(1, Math.min(200, Math.round(Number(e.target.value)) || 1)) })} />
            </label>
          )}
          {kind === "photo" && <p className="text-xs text-muted">La photo du client est recadrée au centre pour remplir exactement ce cadre.</p>}
        </div>
      )}
    </section>
  );
}

/** Catalogue team: save the template (images go to the public template storage). */
export function TemplateSavePanel({ title, status, saving, onSave }: { title: string; status: string; saving: boolean; onSave: () => void }) {
  return (
    <section className="grid gap-2 rounded-xl bg-brun p-4 text-ivoire" aria-label="Modèle">
      <span className="eyebrow text-ivoire/70">Modèle · {status === "published" ? "publié" : status === "archived" ? "archivé" : "brouillon"}</span>
      <b className="display text-xl">{title}</b>
      <p className="text-xs text-ivoire/80">Sélectionnez un élément pour en faire un champ client. Publiez ensuite depuis l&apos;administration.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-terra !py-2 text-sm disabled:opacity-50" disabled={saving} onClick={onSave}>{saving ? "Enregistrement…" : "Enregistrer le modèle"}</button>
        <a href="/admin/modeles" className="rounded-lg border border-ivoire/40 px-3 py-2 text-sm font-semibold">Administration des modèles</a>
      </div>
    </section>
  );
}

/** Customer: the assistant (« Ajoutez votre photo », « Votre texte »), then order or open the full studio. */
export function AssistantPanel({ title, description, fields, busy, onText, onPhoto, onFree }: {
  title: string; description: string; fields: FieldRef[]; busy: string | null;
  onText: (f: FieldRef, text: string) => void; onPhoto: (f: FieldRef, file: File) => void; onFree: () => void;
}) {
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  return (
    <section className="grid gap-4" aria-label="Personnaliser ce modèle">
      <div className="grid gap-1">
        <span className="eyebrow text-terra">Modèle prêt à personnaliser</span>
        <h2 className="display on-light text-2xl">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <ol className="grid gap-3">
        {fields.map((f, i) => (
          <li key={f.layerId} className="grid gap-2 rounded-xl border border-line bg-surface p-3">
            <span className="text-sm font-bold"><span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-brun text-xs text-ivoire">{i + 1}</span>{f.label}</span>
            {f.kind === "text" ? (
              <>
                <input className={field} value={f.text ?? ""} maxLength={f.maxLength} aria-label={f.label}
                  onChange={(e) => onText(f, e.target.value)} />
                <span className="text-right text-xs text-muted">{Array.from(f.text ?? "").length} / {f.maxLength}</span>
              </>
            ) : (
              <>
                <button type="button" className={btn} disabled={busy === f.layerId} onClick={() => inputs.current[f.layerId]?.click()}>
                  {busy === f.layerId ? "Préparation de la photo…" : "📷 Choisir une photo"}
                </button>
                <input ref={(el) => { inputs.current[f.layerId] = el; }} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label={f.label}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) onPhoto(f, file); e.target.value = ""; }} />
                <span className="text-xs text-muted">Recadrée au centre pour remplir le cadre. Une photo nette d&apos;au moins 1 200 px donne le meilleur résultat.</span>
              </>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className={`${btn} w-fit`} onClick={onFree}>Modifier librement dans le studio</button>
    </section>
  );
}
