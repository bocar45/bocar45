/** Small FormData readers. Return null for empty optional values, NaN for unreadable numbers. */
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export function int(fd: FormData, k: string): number | null {
  const v = str(fd, k).replace(/[\s  ]/g, "");
  if (v === "") return null;
  return /^-?\d+$/.test(v) ? Number.parseInt(v, 10) : Number.NaN;
}
/** "35" or "35,5" % → basis points. */
export function percentToBps(fd: FormData, k: string): number | null {
  const v = str(fd, k).replace(",", ".");
  if (v === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return Number.NaN;
  return Math.round(Number.parseFloat(v) * 100);
}
export const checked = (fd: FormData, k: string) => fd.get(k) === "on";
