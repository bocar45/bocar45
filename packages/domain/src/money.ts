/**
 * Money: integer amounts in the currency's minor unit + ISO 4217 code.
 * XOF has no minor unit (1 = 1 franc CFA); EUR has 2 (1 = 1 centime).
 * Rates and percentages are basis points (1 bp = 0.01 %), never floats.
 */

export const CURRENCIES = {
  XOF: { minorUnits: 0, symbol: "FCFA" },
  EUR: { minorUnits: 2, symbol: "€" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/** 10 000 basis points = 100 %. */
export type BasisPoints = number;
export const BPS_100_PERCENT = 10_000;

export class MoneyError extends Error {
  override readonly name = "MoneyError";
}

function assertInt(n: number, what: string): void {
  if (!Number.isSafeInteger(n)) throw new MoneyError(`${what} must be a safe integer, got ${n}`);
}

export function money(amount: number, currency: CurrencyCode): Money {
  assertInt(amount, "amount");
  return Object.freeze({ amount, currency });
}

export const zero = (currency: CurrencyCode): Money => money(0, currency);

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce((acc, m) => add(acc, m), zero(currency));
}

export function multiply(a: Money, quantity: number): Money {
  assertInt(quantity, "quantity");
  return money(a.amount * quantity, a.currency);
}

export function max(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return a.amount >= b.amount ? a : b;
}

export function min(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return a.amount <= b.amount ? a : b;
}

export type RoundingMode = "half-up" | "up" | "down";

/** Integer division with explicit rounding (operands are integers, result exact). */
export function divRound(numerator: number, denominator: number, mode: RoundingMode = "half-up"): number {
  assertInt(numerator, "numerator");
  assertInt(denominator, "denominator");
  if (denominator <= 0) throw new MoneyError("denominator must be positive");
  const sign = numerator < 0 ? -1 : 1;
  const n = Math.abs(numerator);
  const q = Math.floor(n / denominator);
  const r = n - q * denominator;
  let result: number;
  if (mode === "down") result = q;
  else if (mode === "up") result = r > 0 ? q + 1 : q;
  else result = r * 2 >= denominator ? q + 1 : q;
  return sign * result;
}

/** amount × bps / 10 000, rounded. */
export function applyBps(a: Money, bps: BasisPoints, mode: RoundingMode = "half-up"): Money {
  assertInt(bps, "bps");
  return money(divRound(a.amount * bps, BPS_100_PERCENT, mode), a.currency);
}

/** Round to a multiple of `step` minor units (e.g. 50 FCFA). */
export function roundToStep(a: Money, step: number, mode: RoundingMode = "up"): Money {
  assertInt(step, "step");
  if (step <= 1) return a;
  return money(divRound(a.amount, step, mode) * step, a.currency);
}

/** Split a gross (tax-inclusive) amount into net + tax. Tax = gross − net, so the parts always add up. */
export function splitGross(gross: Money, taxBps: BasisPoints): { net: Money; tax: Money } {
  const net = money(divRound(gross.amount * BPS_100_PERCENT, BPS_100_PERCENT + taxBps), gross.currency);
  return { net, tax: subtract(gross, net) };
}

export function format(m: Money, locale = "fr-FR"): string {
  const { minorUnits, symbol } = CURRENCIES[m.currency];
  const value = m.amount / 10 ** minorUnits;
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(value);
  return `${n} ${symbol}`;
}
