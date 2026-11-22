"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActionForm, type ActionResult } from "@/components/action-form";

/** Upload photos of the finished product to the workshop's private folder, then submit them. */
export function QcUpload({ vendorId, fulfillmentId, action }: { vendorId: string; fulfillmentId: string; action: (fd: FormData) => Promise<ActionResult> }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ActionForm action={async (fd) => { for (const p of paths) fd.append("photos", p); return action(fd); }} submitLabel="Envoyer pour contrôle">
      <label className="grid gap-1 font-semibold">Photos du produit fini (recto, verso, détail du marquage)
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" disabled={busy}
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])].slice(0, 6);
            setBusy(true); setError(null);
            const supabase = createClient();
            const uploaded: string[] = [];
            for (const file of files) {
              if (file.size > 15 * 1024 * 1024) { setError("Photo trop lourde (15 Mo maximum)."); continue; }
              const path = `${vendorId}/${fulfillmentId}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
              const { error: err } = await supabase.storage.from("qc-photos").upload(path, file, { contentType: file.type });
              if (err) setError(`La photo « ${file.name} » n'a pas pu être envoyée (JPG, PNG ou WebP, 15 Mo maximum). Vérifiez la connexion et réessayez.`); else uploaded.push(path);
            }
            setPaths((p) => [...p, ...uploaded]);
            setBusy(false);
          }} />
      </label>
      <p className="text-sm text-muted">{busy ? "Envoi des photos…" : `${paths.length} photo${paths.length > 1 ? "s" : ""} prête${paths.length > 1 ? "s" : ""}.`}</p>
      {error && <p role="alert" className="text-error">⚠ {error}</p>}
    </ActionForm>
  );
}
