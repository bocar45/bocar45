"use client";

import { safeNext as checkNext } from "@/lib/safe-next";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendLoginCode } from "./actions";

type Step = { kind: "phone" } | { kind: "code"; phone: string } | { kind: "email-sent"; email: string };

const input = "w-full rounded-md border border-line bg-surface px-3 py-3 text-base";
const button = "rounded-md bg-action px-4 py-3 font-bold text-on-action disabled:opacity-60";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("suite") ?? "/compte";
  const safeNext = checkNext(next);
  const [step, setStep] = useState<Step>({ kind: "phone" });
  const [useEmail, setUseEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(form: FormData) {
    setError(null);
    setBusy(true);
    try {
      const r = useEmail
        ? await sendLoginCode({ email: String(form.get("email") ?? ""), next: safeNext })
        : await sendLoginCode({ phone: String(form.get("phone") ?? ""), next: safeNext });
      if ("error" in r) { setError(r.error ?? "Envoi impossible."); return; }
      setStep(useEmail ? { kind: "email-sent", email: r.target } : { kind: "code", phone: r.target });
    } catch {
      setError("Envoi impossible pour le moment. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(form: FormData) {
    if (step.kind !== "code") return;
    setError(null);
    setBusy(true);
    try {
      const token = String(form.get("code") ?? "").replace(/\D/g, "");
      const { error: e } = await createClient().auth.verifyOtp({ phone: step.phone, token, type: "sms" });
      if (e) throw e;
      router.replace(safeNext);
      router.refresh();
    } catch {
      setError("Code incorrect ou expiré. Vérifiez le SMS ou demandez un nouveau code.");
    } finally {
      setBusy(false);
    }
  }

  if (step.kind === "email-sent") {
    return <p role="status">Un lien de connexion a été envoyé à {step.email}. Ouvrez-le sur cet appareil.</p>;
  }

  if (step.kind === "code") {
    return (
      <form action={verify} className="grid gap-4">
        <label htmlFor="code" className="font-semibold">Code reçu au {step.phone}</label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required className={input} />
        {error && <p role="alert" className="text-error">⚠ {error}</p>}
        <button type="submit" disabled={busy} className={button}>{busy ? "Vérification…" : "Valider"}</button>
        <button type="button" className="text-sm underline" onClick={() => setStep({ kind: "phone" })}>
          Changer de numéro
        </button>
      </form>
    );
  }

  return (
    <form action={sendCode} className="grid gap-4">
      {useEmail ? (
        <>
          <label htmlFor="email" className="font-semibold">Adresse e-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={input} />
        </>
      ) : (
        <>
          <label htmlFor="phone" className="font-semibold">Numéro de téléphone</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" required className={input} />
        </>
      )}
      {error && <p role="alert" className="text-error">⚠ {error}</p>}
      <button type="submit" disabled={busy} className={button}>{busy ? "Envoi…" : "Recevoir un code"}</button>
      <button type="button" className="text-sm underline" onClick={() => setUseEmail(!useEmail)}>
        {useEmail ? "Utiliser mon numéro de téléphone" : "Utiliser une adresse e-mail"}
      </button>
    </form>
  );
}
