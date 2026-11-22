import type { DesignDocument } from "@sawwa/design";
import { DesignPreview } from "./design-preview";

export interface VersionRow { id: string; proofRound: number; number: number; createdAt: string; surcharge: number; doc: DesignDocument | null }

/** Frozen versions of an order line, newest first; older ones can be opened for comparison. */
export function VersionHistory({ versions, currentId, zones, urls, garmentHex }: {
  versions: VersionRow[]; currentId: string;
  zones: { key: string; label: string; maxWidthMm: number; maxHeightMm: number }[]; urls: Record<string, string>; garmentHex: string;
}) {
  if (versions.length <= 1) return null;
  return (
    <ol className="grid gap-2 text-sm">
      {[...versions].sort((a, b) => b.number - a.number).map((v) => (
        <li key={v.id} className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <b>Version {v.number}</b>
            <span className="text-muted">· BAT n° {Math.max(1, v.proofRound)} · {new Date(v.createdAt).toLocaleString("fr-SN", { dateStyle: "short", timeStyle: "short" })}</span>
            {v.id === currentId && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs font-bold text-ok">version en cours</span>}
            {v.surcharge > 0 && <span className="rounded-full bg-ocre/20 px-2 py-0.5 text-xs font-bold">supplément {v.surcharge.toLocaleString("fr-FR")} FCFA</span>}
          </div>
          {v.id !== currentId && v.doc && (
            <details className="mt-2"><summary className="cursor-pointer underline">Voir cette version</summary>
              <div className="mt-2"><DesignPreview doc={v.doc} zones={zones} urls={urls} garmentHex={garmentHex} /></div>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
