"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-3xl">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="text-muted">Le service est momentanément indisponible. Réessayez dans un instant ; si le problème continue, contactez l&apos;équipe SAWWA.</p>
      <button type="button" onClick={reset} className="w-fit rounded-md bg-action px-4 py-2 font-bold text-on-action">Réessayer</button>
    </div>
  );
}
