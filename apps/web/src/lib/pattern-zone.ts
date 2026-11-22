import type { PatternSpec } from "@sawwa/design";

/** E18b: the pattern spec stored in a zone's anchor (catalogue), read defensively (it comes from the database). */
export function patternOf(anchor: unknown): PatternSpec | null {
  const p = (anchor as { pattern?: Partial<PatternSpec> } | null)?.pattern;
  if (!p || !Array.isArray(p.outline) || p.outline.length < 3 || typeof p.seamMm !== "number" || typeof p.bleedMm !== "number") return null;
  if (!p.outline.every((q) => Array.isArray(q) && q.length === 2 && q.every((v) => typeof v === "number" && Number.isFinite(v)))) return null;
  return { outline: p.outline, seamMm: p.seamMm, bleedMm: p.bleedMm, quantity: Math.max(1, Math.min(4, Math.floor(p.quantity ?? 1))), ...(p.mirror ? { mirror: true } : {}), body: p.body ?? null };
}
