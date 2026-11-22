/** Normalise a Senegalese mobile number to E.164 (+2217XXXXXXXX). Returns null if invalid. */
export function normalizeSenegalPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("221")) digits = digits.slice(3);
  if (!/^7[0-8]\d{7}$/.test(digits)) return null;
  return `+221${digits}`;
}
