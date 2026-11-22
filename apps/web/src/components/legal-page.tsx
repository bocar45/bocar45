import type { ReactNode } from "react";

/** Provisional legal page (E24c): clearly marked as a draft to be reviewed by a lawyer before the public launch. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto grid max-w-3xl gap-5 px-4 py-12 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed">
      <p role="note" className="rounded-xl border-2 border-ocre bg-ocre/10 p-4 text-sm">
        <b>Version provisoire</b> (mise à jour le {updated}) : ce texte sera relu par un juriste avant l&apos;ouverture publique. Les éléments entre crochets sont à compléter.
      </p>
      <h1 className="display on-light text-4xl">{title}</h1>
      {children}
    </article>
  );
}
