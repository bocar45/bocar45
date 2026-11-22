/**
 * Price rule for a correction (E10): the customer never pays less than what was agreed, and pays a surcharge only
 * after explicitly accepting its exact amount. Amounts are TTC, in FCFA (integers).
 */
export type CorrectionPricing =
  | { ok: true; surcharge: number }
  | { ok: false; surcharge: number; message: string };

export function correctionPricing(paidTotal: number, newTotal: number, acceptedSurcharge: number | null): CorrectionPricing {
  if (!Number.isSafeInteger(paidTotal) || !Number.isSafeInteger(newTotal)) throw new Error("amounts must be integers");
  if (newTotal <= paidTotal) return { ok: true, surcharge: 0 };
  const surcharge = newTotal - paidTotal;
  if (acceptedSurcharge === surcharge) return { ok: true, surcharge };
  return {
    ok: false,
    surcharge,
    message: `Votre correction agrandit le marquage ou ajoute une zone : elle coûte ${surcharge.toLocaleString("fr-FR")} FCFA de plus. Acceptez ce supplément pour la renvoyer à l'atelier, ou réduisez la création.`,
  };
}
