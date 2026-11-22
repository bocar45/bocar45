/**
 * Illustrated product silhouettes used until real mockup photos exist.
 * The "print" shows a SAWWA sample design so customers see what personalisation means.
 */
export type ArtKind = "tee" | "hoodie" | "cap" | "mug" | "tote" | "bottle" | "polo";

const SHAPES: Record<ArtKind, { path: string; print: { x: number; y: number; w: number } }> = {
  tee: { path: "M70 22 Q100 40 130 22 L176 44 L160 84 L142 76 L142 186 L58 186 L58 76 L40 84 L24 44 Z", print: { x: 100, y: 102, w: 58 } },
  polo: { path: "M72 22 L90 22 L100 46 L110 22 L128 22 L176 44 L160 84 L142 76 L142 186 L58 186 L58 76 L40 84 L24 44 Z", print: { x: 120, y: 92, w: 26 } },
  hoodie: { path: "M66 30 Q70 8 100 8 Q130 8 134 30 L178 52 L166 150 L150 146 L148 188 L52 188 L50 146 L34 150 L22 52 Z", print: { x: 100, y: 108, w: 62 } },
  cap: { path: "M38 120 Q40 56 100 52 Q160 56 162 120 Z M26 122 L176 122 Q186 128 180 136 L22 136 Q16 128 26 122 Z", print: { x: 100, y: 96, w: 44 } },
  mug: { path: "M48 46 L148 46 L148 172 Q98 184 48 172 Z M148 74 Q182 74 182 108 Q182 142 148 142 L148 130 Q168 130 168 108 Q168 86 148 86 Z", print: { x: 98, y: 110, w: 62 } },
  tote: { path: "M40 70 L160 70 L168 188 L32 188 Z M72 70 Q72 26 100 26 Q128 26 128 70 L120 70 Q120 36 100 36 Q80 36 80 70 Z", print: { x: 100, y: 128, w: 70 } },
  bottle: { path: "M84 18 L116 18 L116 40 Q138 52 138 80 L138 182 Q100 192 62 182 L62 80 Q62 52 84 40 Z", print: { x: 100, y: 122, w: 46 } },
};

function Print({ x, y, w, ink }: { x: number; y: number; w: number; ink: string }) {
  const s = w / 60;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-9" y="-30" width="18" height="18" transform="rotate(45 0 -21)" fill="#C9923E" />
      <text y="2" textAnchor="middle" fontFamily="var(--font-fraunces), Georgia, serif" fontStyle="italic" fontSize="20" fill={ink}>Teranga</text>
      <text y="16" textAnchor="middle" fontFamily="var(--font-manrope), sans-serif" fontWeight="800" fontSize="6.5" letterSpacing="2.4" fill="#B5562A">DAKAR · 2027</text>
    </g>
  );
}

export function ProductArt({
  kind,
  color = "#F2E9D8",
  ink = "#2A1A12",
  className,
  label,
  withPrint = true,
  design,
}: {
  kind: ArtKind;
  color?: string;
  ink?: string;
  className?: string;
  label?: string;
  withPrint?: boolean;
  /** Real design to place on the print spot: content drawn in a zone of widthMm × heightMm. */
  design?: { widthMm: number; heightMm: number; content: React.ReactNode } | undefined;
}) {
  const shape = SHAPES[kind];
  return (
    <svg viewBox="0 0 200 200" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <ellipse cx="100" cy="192" rx="70" ry="6" fill="#000" opacity=".18" />
      <path d={shape.path} fill={color} fillRule="evenodd" stroke="rgba(0,0,0,.12)" strokeWidth="1.5" />
      {design ? (
        <svg x={shape.print.x - shape.print.w * 0.75} y={shape.print.y - shape.print.w * 0.75 * (design.heightMm / design.widthMm) * 0.55}
          width={shape.print.w * 1.5} height={shape.print.w * 1.5 * (design.heightMm / design.widthMm)}
          viewBox={`0 0 ${design.widthMm} ${design.heightMm}`} overflow="hidden">{design.content}</svg>
      ) : withPrint && <Print {...shape.print} ink={ink} />}
    </svg>
  );
}

/** Pick an illustration from a product slug or category slug. */
export function artKindFor(slug: string): ArtKind {
  if (/hood|sweat/.test(slug)) return "hoodie";
  if (/polo/.test(slug)) return "polo";
  if (/casquette|cap/.test(slug)) return "cap";
  if (/mug|tasse/.test(slug)) return "mug";
  if (/tote|sac/.test(slug)) return "tote";
  if (/gourde|bouteille|bottle/.test(slug)) return "bottle";
  return "tee";
}

const TILES = [
  { cls: "bg-terra", hex: "#B5562A" },
  { cls: "bg-indigo", hex: "#2F4B7C" },
  { cls: "bg-ocre", hex: "#C9923E" },
  { cls: "bg-olive", hex: "#68705A" },
  { cls: "bg-brun", hex: "#2A1A12" },
];

function distance(a: string, b: string): number {
  const n = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return Math.hypot(x[0]! - y[0]!, x[1]! - y[1]!, x[2]! - y[2]!);
}

/** Background tile class that stays visibly different from the product colour. */
export function tileFor(productHex: string, preferred = 0): string {
  for (let i = 0; i < TILES.length; i++) {
    const t = TILES[(preferred + i) % TILES.length]!;
    if (distance(t.hex, productHex) > 90) return t.cls;
  }
  return "bg-terra";
}
