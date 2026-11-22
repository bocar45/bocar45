"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QuoteRequestInput } from "./actions";

const field = "w-full rounded-md border border-line bg-surface px-3 py-2";

export function QuoteForm({ userId, products, designs, defaultPhone, action }: {
  userId: string; products: { id: string; name: string }[]; designs: { id: string; title: string }[]; defaultPhone: string;
  action: (input: QuoteRequestInput) => Promise<{ error: string } | void>;
}) {
  const [f, setF] = useState({ organizationName: "", contactName: "", phone: defaultPhone, productId: "", quantity: 50, deadline: "", message: "", designId: "" });
  const [logo, setLogo] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: k === "quantity" ? Number(e.target.value) : e.target.value }));
  const submit = () => start(async () => {
    setError(null);
    let logoPath: string | null = null;
    if (logo && !rights) { setError("Confirmez que vous avez le droit d'utiliser ce logo."); return; }
    if (logo) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(logo.type) || logo.size > 25 * 1024 * 1024) { setError("Logo : PNG, JPG ou WebP, 25 Mo au plus."); return; }
      const ext = logo.type === "image/png" ? "png" : logo.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/devis-${crypto.randomUUID()}.${ext}`;
      try {
        const { error: e } = await createClient().storage.from("design-assets").upload(path, logo, { contentType: logo.type, upsert: false });
        if (e) throw e;
      } catch { setError("Le logo n'a pas pu être envoyé. Vérifiez votre connexion et réessayez."); return; }
      logoPath = path;
    }
    const r = await action({ ...f, productId: f.productId || null, deadline: f.deadline || null, designId: f.designId || null, logoPath, rightsDeclared: rights });
    if (r && "error" in r) setError(r.error);
  });
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">Organisation<input required className={field} value={f.organizationName} onChange={set("organizationName")} placeholder="ASC Jaraaf, Mairie de…, PME…" /></label>
        <label className="grid gap-1 text-sm font-semibold">Personne à contacter<input required className={field} value={f.contactName} onChange={set("contactName")} autoComplete="name" /></label>
        <label className="grid gap-1 text-sm font-semibold">Téléphone (WhatsApp de préférence)<input required className={field} value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" /></label>
        <label className="grid gap-1 text-sm font-semibold">Quantité totale<input required type="number" min={1} max={100000} className={field} value={f.quantity} onChange={set("quantity")} /></label>
        <label className="grid gap-1 text-sm font-semibold">Produit
          <select className={field} value={f.productId} onChange={set("productId")}>
            <option value="">Je ne sais pas encore</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Pour le (date souhaitée)<input type="date" className={field} value={f.deadline} onChange={set("deadline")} /></label>
      </div>
      <label className="grid gap-1 text-sm font-semibold">Votre logo (facultatif)
        <input type="file" accept="image/png,image/jpeg,image/webp" className={field} onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
      </label>
      {logo && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={rights} onChange={(e) => setRights(e.target.checked)} />
          Ce logo est celui de mon organisation, ou j&apos;ai l&apos;autorisation de son titulaire pour le faire imprimer.
        </label>
      )}
      {designs.length > 0 && (
        <label className="grid gap-1 text-sm font-semibold">Ou une de vos créations
          <select className={field} value={f.designId} onChange={set("designId")}>
            <option value="">Aucune</option>
            {designs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm font-semibold">Votre besoin
        <textarea rows={4} maxLength={2000} className={field} value={f.message} onChange={set("message")}
          placeholder="Ex. : 60 maillots avec logo devant, nom et numéro au dos ; couleurs du club bleu et blanc ; tailles S à XXL." />
      </label>
      {error && <p role="alert" className="text-error">⚠ {error}</p>}
      <button type="submit" disabled={pending} className="btn btn-terra w-fit disabled:opacity-60">{pending ? "Envoi…" : "Demander mon devis"}</button>
      <p className="text-xs text-muted">Réponse sous 24 h ouvrées. Le devis est valable 30 jours ; vous commandez ensuite en ligne au prix du devis.</p>
    </form>
  );
}
