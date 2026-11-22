"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/components/lang-context";
import { l } from "@/lib/i18n";
import type { QuoteRequestInput } from "./actions";

const field = "w-full rounded-md border border-line bg-surface px-3 py-2";

export function QuoteForm({ userId, products, designs, defaultPhone, action }: {
  userId: string; products: { id: string; name: string }[]; designs: { id: string; title: string }[]; defaultPhone: string;
  action: (input: QuoteRequestInput) => Promise<{ error: string } | void>;
}) {
  const lang = useLang();
  const t = (fr: string, en: string) => l(lang, fr, en);
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
        <label className="grid gap-1 text-sm font-semibold">{t("Organisation", "Organisation")}<input required className={field} value={f.organizationName} onChange={set("organizationName")} placeholder={t("ASC Jaraaf, Mairie de…, PME…", "Club, town hall, company…")} /></label>
        <label className="grid gap-1 text-sm font-semibold">{t("Personne à contacter", "Contact person")}<input required className={field} value={f.contactName} onChange={set("contactName")} autoComplete="name" /></label>
        <label className="grid gap-1 text-sm font-semibold">{t("Téléphone (WhatsApp de préférence)", "Phone (WhatsApp preferred)")}<input required className={field} value={f.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" /></label>
        <label className="grid gap-1 text-sm font-semibold">{t("Quantité totale", "Total quantity")}<input required type="number" min={1} max={100000} className={field} value={f.quantity} onChange={set("quantity")} /></label>
        <label className="grid gap-1 text-sm font-semibold">{t("Produit", "Product")}
          <select className={field} value={f.productId} onChange={set("productId")}>
            <option value="">{t("Je ne sais pas encore", "Not sure yet")}</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">{t("Pour le (date souhaitée)", "Needed by (date)")}<input type="date" className={field} value={f.deadline} onChange={set("deadline")} /></label>
      </div>
      <label className="grid gap-1 text-sm font-semibold">{t("Votre logo (facultatif)", "Your logo (optional)")}
        <input type="file" accept="image/png,image/jpeg,image/webp" className={field} onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
      </label>
      {logo && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={rights} onChange={(e) => setRights(e.target.checked)} />
          {t("Ce logo est celui de mon organisation, ou j'ai l'autorisation de son titulaire pour le faire imprimer.", "This logo belongs to my organisation, or its owner has allowed me to have it printed.")}
        </label>
      )}
      {designs.length > 0 && (
        <label className="grid gap-1 text-sm font-semibold">{t("Ou une de vos créations", "Or one of your designs")}
          <select className={field} value={f.designId} onChange={set("designId")}>
            <option value="">{t("Aucune", "None")}</option>
            {designs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </label>
      )}
      <label className="grid gap-1 text-sm font-semibold">{t("Votre besoin", "What you need")}
        <textarea rows={4} maxLength={2000} className={field} value={f.message} onChange={set("message")}
          placeholder={t("Ex. : 60 maillots avec logo devant, nom et numéro au dos ; couleurs du club bleu et blanc ; tailles S à XXL.", "E.g. 60 jerseys with a logo on the front, name and number on the back; club colours blue and white; sizes S to XXL.")} />
      </label>
      {error && <p role="alert" className="text-error">⚠ {error}</p>}
      <button type="submit" disabled={pending} className="btn btn-terra w-fit disabled:opacity-60">{pending ? t("Envoi…", "Sending…") : t("Demander mon devis", "Request my quote")}</button>
      <p className="text-xs text-muted">{t("Réponse sous 24 h ouvrées. Le devis est valable 30 jours ; vous commandez ensuite en ligne au prix du devis.", "Reply within one working day. The quote is valid for 30 days; you then order online at the quoted price.")}</p>
    </form>
  );
}
