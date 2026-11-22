"use client";

import { useActionState } from "react";
import { applyAsVendor, type ApplyState } from "./actions";

const input = "w-full rounded-md border border-line bg-surface px-3 py-3";

export function ApplyForm() {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyAsVendor, { error: null });
  return (
    <form action={action} className="grid gap-4">
      <label htmlFor="name" className="font-semibold">Nom de l&apos;atelier</label>
      <input id="name" name="name" required minLength={2} className={input} />
      <label htmlFor="ninea" className="font-semibold">NINEA (facultatif)</label>
      <input id="ninea" name="ninea" className={input} />
      {state.error && <p role="alert" className="text-error">⚠ {state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-action px-4 py-3 font-bold text-on-action disabled:opacity-60">
        {pending ? "Envoi…" : "Envoyer ma candidature"}
      </button>
    </form>
  );
}
