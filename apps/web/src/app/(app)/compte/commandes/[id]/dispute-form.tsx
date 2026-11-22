"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { DISPUTE_REASON } from "@/lib/disputes";

const field = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm";

/** Report a problem with a received order, with photos (stored in the customer's private folder). */
export function DisputeForm({ userId, action }: {
  userId: string; action: (input: { reason: string; description: string; photos: string[] }) => Promise<{ ok?: string; error?: string }>;
}) {
  const [reason, setReason] = useState("defect");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    setResult(null);
    const photos: string[] = [];
    for (const f of files.slice(0, 6)) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 15 * 1024 * 1024) { setResult({ error: "Photos : PNG, JPG ou WebP, 15 Mo au plus." }); return; }
      const path = `${userId}/litige-${crypto.randomUUID()}.${f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg"}`;
      try {
        const { error } = await createClient().storage.from("design-assets").upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw error;
      } catch { setResult({ error: "Une photo n'a pas pu être envoyée. Vérifiez votre connexion et réessayez." }); return; }
      photos.push(path);
    }
    setResult(await action({ reason, description, photos }));
  });
  if (result?.ok) return <p role="status" className="text-ok">✓ {result.ok}</p>;
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <select className={field} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Problème">
        {Object.entries(DISPUTE_REASON).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <textarea className={field} rows={3} maxLength={2000} required value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Décrivez le problème (pièces concernées, tailles…)" aria-label="Description" />
      <label className="grid gap-1 text-sm">Photos (jusqu&apos;à 6, recommandées pour un défaut)
        <input type="file" multiple accept="image/png,image/jpeg,image/webp" className={field} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      </label>
      {result?.error && <p role="alert" className="text-error">⚠ {result.error}</p>}
      <button type="submit" disabled={pending} className="w-fit rounded-md border border-line bg-surface px-4 py-2 disabled:opacity-60">{pending ? "Envoi…" : "Envoyer à SAWWA"}</button>
    </form>
  );
}
