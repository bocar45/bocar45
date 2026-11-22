/**
 * Price rule for a correction (E10, D16). Both versions are priced the same way — with the workshop already assigned
 * to the order and today's rules — so the surcharge is only the effect of the change itself. The customer never pays
 * less than agreed, and pays a surcharge only after explicitly accepting its exact amount. Amounts: TTC FCFA, integers.
 */
export type CorrectionPricing =
  | { ok: true; surcharge: number }
  | { ok: false; surcharge: number; message: string };

export function correctionPricing(priceBefore: number, priceAfter: number, acceptedSurcharge: number | null): CorrectionPricing {
  if (!Number.isSafeInteger(priceBefore) || !Number.isSafeInteger(priceAfter)) throw new Error("amounts must be integers");
  if (priceAfter <= priceBefore) return { ok: true, surcharge: 0 };
  const surcharge = priceAfter - priceBefore;
  if (acceptedSurcharge === surcharge) return { ok: true, surcharge };
  return {
    ok: false,
    surcharge,
    message: `Votre correction agrandit le marquage ou ajoute une zone : elle coûte ${surcharge.toLocaleString("fr-FR")} FCFA de plus. Acceptez ce supplément pour la renvoyer à l'atelier, ou réduisez la création.`,
  };
}

export type CorrectionPlan =
  | { ok: true; surcharge: number; priceBefore: number; priceAfter: number }
  | { ok: false; surcharge?: number; message: string };

/**
 * Decide on a correction from the two quotes made with the assigned workshop.
 * `after` null = the assigned workshop cannot make the corrected design. `before` null = the original design can no
 * longer be priced with that workshop (grid changed): the amount already agreed is used as the reference.
 */
export function planCorrection(input: { agreedTotal: number; before: number | null; after: number | null; acceptedSurcharge: number | null }): CorrectionPlan {
  if (input.after === null) {
    return { ok: false, message: "L'atelier qui fabrique votre commande ne peut pas produire cette version (zone, technique ou taille du marquage). Revenez à une création proche de l'originale, ou contactez l'équipe SAWWA." };
  }
  const priceBefore = input.before ?? input.agreedTotal;
  const r = correctionPricing(priceBefore, input.after, input.acceptedSurcharge);
  return r.ok ? { ok: true, surcharge: r.surcharge, priceBefore, priceAfter: input.after } : r;
}
