"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto grid max-w-xl gap-4 px-4 py-16">
      <span className="losange" aria-hidden="true" />
      <h1 className="display text-4xl">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="text-muted">Le service est momentanément indisponible. Réessayez dans un instant ; si le problème continue, contactez l&apos;équipe SAWWA.</p>
      <button type="button" onClick={reset} className="btn btn-terra w-fit">Réessayer</button>
    </div>
  );
}
