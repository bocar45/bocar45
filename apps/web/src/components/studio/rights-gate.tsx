"use client";

import { useState } from "react";

/**
 * E18d: before the first image import, the customer declares holding the rights on it. Shown once per device;
 * the declaration is also recorded on the design when it is saved (date), and checked again before an order.
 */
export function RightsGate({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rights-title" className="fixed inset-0 z-50 grid place-items-center bg-brun/60 p-4">
      <div className="grid max-w-md gap-3 rounded-2xl bg-ivoire p-5 shadow-xl">
        <h2 id="rights-title" className="display on-light text-2xl">Vos images, vos droits</h2>
        <p className="text-sm">Nos ateliers impriment ce que vous importez. Pour protéger les créateurs et les marques :</p>
        <ul className="grid gap-1 text-sm">
          <li>· pas de logo ni de nom de marque sans l&apos;accord de son titulaire ;</li>
          <li>· pas de personnage, de film, de club ou d&apos;œuvre protégés sans licence ;</li>
          <li>· pas de photo d&apos;une personne sans son accord ;</li>
          <li>· pas de contenu haineux, violent ou sexuel.</li>
        </ul>
        <p className="text-xs text-muted">Une création qui ne respecte pas ces règles est refusée au BAT et la commande est remboursée.</p>
        <label className="flex items-start gap-2 text-sm font-semibold">
          <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Je déclare avoir le droit d&apos;utiliser et de faire imprimer les images que j&apos;importe.
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn btn-terra !py-2 text-sm disabled:opacity-50" disabled={!checked} onClick={onAccept}>Continuer</button>
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={onCancel}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
