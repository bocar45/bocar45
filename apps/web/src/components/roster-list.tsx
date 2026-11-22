import type { RosterEntry } from "@sawwa/design";

/** Frozen list of a team order (size, name, number per piece), folded by default. */
export function RosterList({ roster }: { roster: RosterEntry[] | null | undefined }) {
  if (!roster?.length) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold">Liste de l&apos;équipe : {roster.length} pièces</summary>
      <table className="mt-2 w-full max-w-md text-sm">
        <thead><tr className="text-left text-xs text-muted"><th className="p-1">#</th><th className="p-1">Taille</th><th className="p-1">Nom</th><th className="p-1">N°</th></tr></thead>
        <tbody>
          {roster.map((e, i) => (
            <tr key={i} className="border-t border-line"><td className="p-1 tabular-nums text-muted">{i + 1}</td><td className="p-1">{e.size}</td><td className="p-1 font-semibold">{e.name ?? "—"}</td><td className="p-1 tabular-nums">{e.number ?? "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
