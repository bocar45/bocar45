/**
 * E21 — can a workshop take an order in time? Pure (tested without a database). Days are local dates (YYYY-MM-DD);
 * workshops work Monday to Saturday, minus their declared closures.
 */
export interface Closure { starts_on: string; ends_on: string; reason?: string }
export interface CapacityInput {
  capacityPerDay: number | null; // pieces a day (null = not declared)
  piecesInProgress: number; // pieces already assigned and not yet shipped
  quantity: number; // pieces of this order
  leadTimeDays: number; // working days promised for this product
  closures: Closure[];
  today: string;
}
export interface CapacityResult {
  closedToday: boolean; closedUntil: string | null;
  workDaysNeeded: number; readyBy: string; dueBy: string; late: boolean;
  closuresAhead: Closure[]; // closures before the due date
}

const addDays = (d: string, n: number) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const isSunday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay() === 0;
const closedOn = (d: string, closures: Closure[]) => closures.find((c) => c.starts_on <= d && d <= c.ends_on);

/** The date after `n` open days counted from tomorrow (closures skipped only when `withClosures`). */
function afterOpenDays(today: string, n: number, closures: Closure[]): string {
  let d = today, left = Math.max(1, n);
  while (left > 0) { d = addDays(d, 1); if (!isSunday(d) && !closedOn(d, closures)) left--; }
  return d;
}

export function capacityCheck(i: CapacityInput): CapacityResult {
  const todayClosure = closedOn(i.today, i.closures);
  let closedUntil: string | null = null;
  if (todayClosure) { // follow overlapping closures
    closedUntil = todayClosure.ends_on;
    for (let c = closedOn(addDays(closedUntil, 1), i.closures); c; c = closedOn(addDays(closedUntil, 1), i.closures)) closedUntil = c.ends_on;
  }
  const workDaysNeeded = i.capacityPerDay && i.capacityPerDay > 0 ? Math.ceil((i.piecesInProgress + i.quantity) / i.capacityPerDay) : i.leadTimeDays;
  const readyBy = afterOpenDays(i.today, workDaysNeeded, i.closures);
  const dueBy = afterOpenDays(i.today, i.leadTimeDays, []); // promise to the customer: working days, closures not excused
  return {
    closedToday: Boolean(todayClosure), closedUntil, workDaysNeeded, readyBy, dueBy, late: readyBy > dueBy,
    closuresAhead: i.closures.filter((c) => c.ends_on >= i.today && c.starts_on <= dueBy),
  };
}
