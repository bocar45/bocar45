/** Pure rules of B2B quotes (E17), shared by pages, actions and tests. */
export interface DecorationInput { zoneKey: string; technique: string; widthMm: number; heightMm: number; colors: number }

export const isQuoteValid = (q: { status: string; valid_until: string }, now = Date.now()) => q.status === "sent" && Date.parse(q.valid_until) > now;

/**
 * Does a design fit what was quoted? Every printed zone must have been quoted with the same technique, and be at
 * most as large (2 mm tolerance) and with no more colours.
 */
export function fitsQuote(decorations: DecorationInput[], quoted: DecorationInput[], labels: Record<string, string> = {}): string[] {
  const problems: string[] = [];
  const z = (k: string) => labels[k] ?? k;
  for (const d of decorations) {
    const q = quoted.find((x) => x.zoneKey === d.zoneKey && x.technique === d.technique);
    if (!q) { problems.push(`la zone « ${z(d.zoneKey)} » (${d.technique}) n'est pas dans le devis`); continue; }
    if (d.widthMm > q.widthMm + 2 || d.heightMm > q.heightMm + 2) problems.push(`le marquage « ${z(d.zoneKey)} » (${Math.round(d.widthMm / 10)} × ${Math.round(d.heightMm / 10)} cm) dépasse la taille devisée (${Math.round(q.widthMm / 10)} × ${Math.round(q.heightMm / 10)} cm)`);
    if (d.colors > q.colors) problems.push(`le marquage « ${z(d.zoneKey)} » a ${d.colors} couleurs, le devis en prévoit ${q.colors}`);
  }
  return problems;
}
