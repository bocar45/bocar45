import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { emptyDocument, personalize, type Surface } from "@sawwa/design";
import { buildProductionSheet, fontFiles, renderSurfaceSvg } from "./index.ts";

const surface: Surface = {
  zoneKey: "front", technique: "dtf",
  layers: [
    { id: "t", type: "text", text: "Kër <Gi> & Co", font: "caveat", italic: true, sizeMm: 30, fill: "#2A1A12", xMm: 150, yMm: 50, rotation: 10, widthMm: 120, heightMm: 30 },
    { id: "i", type: "image", src: "storage:a.png", name: "a.png", pxWidth: 2000, pxHeight: 1000, xMm: 150, yMm: 200, rotation: 0, widthMm: 200, heightMm: 100 },
    { id: "s", type: "shape", shape: "losange", fill: "#C9923E", xMm: 20, yMm: 20, rotation: 0, widthMm: 10, heightMm: 10 },
    { id: "h", type: "shape", shape: "rect", fill: "#000000", xMm: 0, yMm: 0, rotation: 0, widthMm: 10, heightMm: 10, hidden: true },
  ],
};

describe("production SVG", () => {
  const { svg, widthPx, heightPx } = renderSurfaceSvg(surface, { maxWidthMm: 300, maxHeightMm: 400 }, { dpi: 300, images: { "storage:a.png": "data:image/png;base64,AAAA" } });
  it("is sized for 300 dpi at real size", () => {
    expect([widthPx, heightPx]).toEqual([3543, 4724]);
    expect(svg).toContain('viewBox="0 0 300 400"');
  });
  it("escapes text, uses the production font and synthetic italic when needed", () => {
    expect(svg).toContain("Kër &lt;Gi&gt; &amp; Co");
    expect(svg).toContain('font-family="Caveat" font-weight="700"');
    expect(svg).toContain("skewX(-12)");
  });
  it("embeds images, draws shapes and skips hidden layers", () => {
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
    expect(svg).toContain("<polygon");
    expect(svg).not.toContain('fill="#000000"');
  });
  it("fails loudly when an image is missing", () => {
    expect(() => renderSurfaceSvg(surface, { maxWidthMm: 300, maxHeightMm: 400 }, { dpi: 300, images: {} })).toThrow(/missing image/);
  });
  it("lists every font file once", () => {
    expect(fontFiles()).toHaveLength(8);
  });
});

describe("team order piece (E16)", () => {
  it("prints the piece's name and number, and nothing for an empty name", () => {
    const doc = { ...emptyDocument("maillot", "blanc"), surfaces: [{ zoneKey: "back", technique: "dtf", layers: [
      { id: "n", type: "text" as const, text: "NOM", font: "anton" as const, sizeMm: 50, fill: "#2A1A12", xMm: 150, yMm: 60, rotation: 0, widthMm: 90, heightMm: 60, perItem: { key: "name" as const, maxLength: 12 } },
      { id: "d", type: "text" as const, text: "10", font: "anton" as const, sizeMm: 180, fill: "#2A1A12", xMm: 150, yMm: 240, rotation: 0, widthMm: 120, heightMm: 180, perItem: { key: "number" as const, maxLength: 2 } },
    ] }] };
    const zone = { maxWidthMm: 300, maxHeightMm: 400 };
    const piece = renderSurfaceSvg(personalize(doc, { size: "M", name: "Ndèye", number: "7" }).surfaces[0]!, zone, { dpi: 300, images: {} }).svg;
    expect(piece).toContain(">NDÈYE<");
    expect(piece).toContain(">7<");
    expect(piece).not.toContain(">NOM<");
    const noName = renderSurfaceSvg(personalize(doc, { size: "M", number: "9" }).surfaces[0]!, zone, { dpi: 300, images: {} }).svg;
    expect(noName).not.toContain(">NOM<");
    expect(noName).toContain(">9<");
  });
});

describe("production sheet PDF", () => {
  it("has one A4 page per zone", async () => {
    const bytes = await buildProductionSheet({
      reference: "SW-2026-000001", productName: "T-shirt brodé cœur", colorName: "ivoire", sizes: { M: 10, L: 5 },
      versionHash: "abcdef0123456789", generatedAt: "22/11/2026", dueDate: "23/11/2026 18:00",
      zones: [
        { label: "Devant", technique: "Transfert DTF", printedWidthCm: 20, printedHeightCm: 25.5, offsetLeftCm: 5, offsetTopCm: 4.5, zoneWidthCm: 30, zoneHeightCm: 40, anchorNote: "70 mm sous le col" },
        { label: "Poitrine gauche", technique: "Broderie", printedWidthCm: 8, printedHeightCm: 8, offsetLeftCm: 1, offsetTopCm: 1, zoneWidthCm: 10, zoneHeightCm: 10, colors: 3 },
      ],
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });
  it("adds the list of pieces of a team order (40 per page)", async () => {
    const roster = Array.from({ length: 45 }, (_, i) => ({ size: i % 2 ? "M" : "L", name: `Joueur ${i + 1} Ndèye`, number: String(i + 1) }));
    const bytes = await buildProductionSheet({
      reference: "SW-2026-000002", productName: "Maillot", colorName: "blanc", sizes: { M: 22, L: 23 },
      versionHash: "abcdef0123456789", generatedAt: "22/11/2026",
      zones: [{ label: "Dos", technique: "Transfert DTF", printedWidthCm: 25, printedHeightCm: 30, offsetLeftCm: 2, offsetTopCm: 2, zoneWidthCm: 30, zoneHeightCm: 40 }],
      roster, variableZones: ["Dos"],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  });
});

describe("print resolution metadata", async () => {
  const { setPngDpi, readPngDpi } = await import("./png.ts");
  // Smallest valid PNG (1×1 transparent).
  const tiny = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
  it("writes 300 dpi (11811 px/m) after IHDR, and replaces an existing value", () => {
    expect(readPngDpi(tiny)).toBeNull();
    const out = setPngDpi(tiny, 300);
    expect(readPngDpi(out)).toBe(300);
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe("pHYs");
    expect(readPngDpi(setPngDpi(out, 150))).toBe(150);
    expect(setPngDpi(out, 150).length).toBe(out.length);
  });
  it("refuses something that is not a PNG", () => {
    expect(() => setPngDpi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 300)).toThrow(/not a PNG/);
  });
});

describe("vector layers in production files", () => {
  it("draws vector paths scaled to the layer, attributes escaped", () => {
    const s: Surface = { zoneKey: "f", technique: "embroidery", layers: [
      { id: "v", type: "vector", name: "logo", viewWidth: 100, viewHeight: 50, xMm: 50, yMm: 50, rotation: 0, widthMm: 80, heightMm: 40, paths: [{ d: "M0 0 L100 0 L100 50 Z", fill: "#2A1A12" }] },
    ] };
    const { svg } = renderSurfaceSvg(s, { maxWidthMm: 100, maxHeightMm: 100 }, { dpi: 300, images: {} });
    expect(svg).toContain('viewBox="0 0 100 50" preserveAspectRatio="none"');
    expect(svg).toContain('<path d="M0 0 L100 0 L100 50 Z" fill="#2A1A12"/>');
    expect(svg).toContain('x="-40" y="-20" width="80" height="40"');
  });
});
