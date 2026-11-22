// E24b — throughput of the pure engines (live price, fabrication check, 300 dpi production file).
// Run: pnpm bench:engines   (vitest bench; nothing external)
import { createRequire } from "node:module";
import { bench, describe } from "vitest";
import { price } from "../../packages/pricing/src/index.ts";
import { checkSurface, decorationsFor, patternZones } from "../../packages/design/src/index.ts";
import { renderSurfaceSvg } from "../../packages/render/src/index.ts";

const { Resvg } = createRequire(new URL("../../packages/render/package.json", import.meta.url))("@resvg/resvg-js") as typeof import("@resvg/resvg-js");

const rules = { version: 1, currency: "XOF", defaultMarginBps: 3500, minMarginPerUnit: 500, vatBps: 1800, priceStep: 50 };
const grid = { vendorId: "v", version: 1, currency: "XOF", blanks: { m: [{ minQty: 1, unitCost: 2500 }, { minQty: 25, unitCost: 2200 }, { minQty: 100, unitCost: 1900 }] },
  decorations: [{ technique: "dtf", zoneKey: "front", maxWidthMm: 300, maxHeightMm: 400, tiers: [{ minQty: 1, unitCost: 1500 }, { minQty: 50, unitCost: 1100 }] }] };
const zones = patternZones("hoodie").map((z) => ({ key: z.key, maxWidthMm: z.maxWidthMm, maxHeightMm: z.maxHeightMm, pattern: z.pattern }));
const doc = {
  schemaVersion: 1 as const, product: "hoodie", colorKey: "blanc", allOver: { motif: "losanges" as const, colors: ["#2A1A12", "#C9923E"] as [string, string], tileMm: 60 },
  surfaces: [{ zoneKey: "piece_devant", technique: "sublimation", layers: Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, type: "text" as const, text: "SAWWA", font: "anton" as const, sizeMm: 30, fill: "#2A1A12", xMm: 100 + i * 20, yMm: 200 + i * 10, rotation: 0, widthMm: 90, heightMm: 40 })) }],
};
const front = patternZones("hoodie")[0]!;

describe("moteurs SAWWA", () => {
  bench("prix en direct (1 ligne, 1 marquage)", () => {
    price({ category: "vetements", lines: [{ variantId: "m", quantity: 37 }], decorations: [{ zoneKey: "front", technique: "dtf", widthMm: 250, heightMm: 300, colors: 3 }] } as never, rules as never, grid as never);
  });
  bench("contrôle de fabrication + marquages (hoodie AOP, 12 textes)", () => {
    for (const s of doc.surfaces) checkSurface(s, zones[0]!, doc.allOver);
    decorationsFor(doc, zones);
  });
  bench("fichier d'impression 300 dpi (devant de hoodie AOP)", () => {
    const { svg } = renderSurfaceSvg(doc.surfaces[0]!, front, { dpi: 300, images: {}, allOver: doc.allOver });
    new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
    const rss = Math.round(process.memoryUsage().rss / 1048576);
    if (rss > peak) peak = rss;
  }, { iterations: 3, time: 0, teardown: () => console.log(`mémoire maximale observée pendant le rendu : ${peak} Mo`) });
});
let peak = 0;
