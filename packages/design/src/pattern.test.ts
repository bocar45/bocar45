import { describe, expect, it } from "vitest";
import { emptyDocument, markerLayout, motifCover, motifFrame, motifTile, offsetPolygon, parseDesign, patternPreflight, pieceZone, piecePolygons, type PatternSpec } from "./index.ts";

const square = (s: number): [number, number][] => [[0, 0], [s, 0], [s, s], [0, s]];

describe("all-over pattern pieces (E18b)", () => {
  it("grows a polygon outwards whatever its orientation", () => {
    expect(offsetPolygon(square(100), 10)).toEqual([[-10, -10], [110, -10], [110, 110], [-10, 110]]);
    expect(offsetPolygon([...square(100)].reverse(), 10)).toEqual([[-10, 110], [110, 110], [110, -10], [-10, -10]]);
  });
  it("builds a piece zone: box = outline + seam + bleed, outline moved inside", () => {
    const z = pieceZone([[100, 50], [300, 50], [300, 450], [100, 450]], 10, 5);
    expect(z).toMatchObject({ widthMm: 230, heightMm: 430, originX: 85, originY: 35 });
    expect(z.outline[0]).toEqual([15, 15]);
    const spec: PatternSpec = { outline: z.outline, seamMm: 10, bleedMm: 5, quantity: 1 };
    expect(piecePolygons(spec).print[0]).toEqual([0, 0]); // printed area reaches the box corner
  });
  it("anchors the motif on the garment: front as seen from the front, back as seen from behind, mirrored copies", () => {
    const body = { x: -283, y: -3, w: 566, h: 740 };
    const front: PatternSpec = { outline: square(100), seamMm: 10, bleedMm: 5, quantity: 1, body: { panel: "front", ...body } };
    const back: PatternSpec = { ...front, body: { panel: "back", ...body } };
    // garment point X = 250 (wearer's left side seam), Y = 300
    const local = (f: { s: number; tx: number; ty: number }) => [f.s * 250 + f.tx, 300 + f.ty];
    expect(local(motifFrame(front, 566))).toEqual([533, 303]); // 250 − (−283)
    expect(local(motifFrame(back, 566))).toEqual([33, 303]); // seen from behind: the same seam is on the other edge
    expect(motifFrame(undefined, 100)).toEqual({ s: 1, tx: 0, ty: 0 });
    // mirrored copy of a front piece: the flipped file, worn at −X
    const sleeve: PatternSpec = { ...front, quantity: 2, mirror: true, body: { panel: "front", x: 240, y: 12, w: 210, h: 288 } };
    const f = motifFrame(sleeve, 535, true);
    const u = 100; // a point of the original piece, local u
    const X = 240 + u, mirroredX = -X, copyU = 535 - u;
    expect(f.s * mirroredX + f.tx).toBe(copyU);
    expect(motifCover(motifFrame(front, 566), 566, 740)).toEqual({ x: -283, y: -3, w: 566, h: 740 });
    expect(motifCover(motifFrame(back, 566), 566, 740)).toEqual({ x: -283, y: -3, w: 566, h: 740 });
    expect(motifTile({ motif: "losanges", colors: ["#2A1A12", "#C9923E"], tileMm: 40 }).shapes[0]!.d).toBe("M20 0L40 20L20 40L0 20Z");
  });
  it("validates the continuous motif in the design document", () => {
    const d = emptyDocument("tee-aop", "blanc");
    expect(parseDesign({ ...d, allOver: { motif: "bandes", colors: ["#B5562A", "#F2E9D8"], tileMm: 60 } }).ok).toBe(true);
    expect(parseDesign({ ...d, allOver: { motif: "camouflage", colors: ["#B5562A", "#F2E9D8"], tileMm: 60 } }).ok).toBe(false);
    expect(parseDesign({ ...d, allOver: { motif: "pois", colors: ["red", "#F2E9D8"], tileMm: 60 } }).ok).toBe(false);
  });
  it("checks coverage up to the printed edge and elements outside the piece", () => {
    const z = pieceZone(square(200), 10, 5);
    const spec: PatternSpec = { outline: z.outline, seamMm: 10, bleedMm: 5, quantity: 1 };
    const zone = { maxWidthMm: z.widthMm, maxHeightMm: z.heightMm };
    const logo = { id: "l", type: "shape" as const, shape: "circle" as const, fill: "#000000", xMm: 115, yMm: 115, rotation: 0, widthMm: 50, heightMm: 50 };
    expect(patternPreflight({ zoneKey: "front", technique: "sublimation", layers: [logo] }, spec, zone, undefined).map((i) => i.code)).toEqual(["PIECE_NOT_COVERED"]);
    expect(patternPreflight({ zoneKey: "front", technique: "sublimation", layers: [logo] }, spec, zone, { motif: "uni", colors: ["#B5562A", "#B5562A"], tileMm: 50 })).toEqual([]);
    const fond = { ...logo, id: "f", shape: "rect" as const, xMm: 115, yMm: 115, widthMm: 230, heightMm: 230 };
    expect(patternPreflight({ zoneKey: "front", technique: "sublimation", layers: [fond, logo] }, spec, zone, undefined)).toEqual([]);
    const away = { ...logo, id: "x", xMm: 600 };
    expect(patternPreflight({ zoneKey: "front", technique: "sublimation", layers: [fond, away] }, spec, zone, undefined).map((i) => i.code)).toEqual(["OUTSIDE_PIECE"]);
  });
  it("lays the pieces on the fabric roll and gives the length needed", () => {
    const m = markerLayout([
      { key: "front", label: "Devant", widthMm: 600, heightMm: 780, count: 1 },
      { key: "back", label: "Dos", widthMm: 600, heightMm: 780, count: 1 },
      { key: "sleeve", label: "Manche", widthMm: 560, heightMm: 260, count: 2 },
    ], 1500, 10);
    expect(m.placements).toHaveLength(4);
    expect(m.placements.slice(0, 2).map((p) => [p.x, p.y])).toEqual([[0, 0], [610, 0]]);
    expect(m.placements[2]).toMatchObject({ x: 0, y: 790 });
    expect(m.lengthMm).toBe(790 + 260);
    expect(markerLayout([{ key: "x", label: "Trop large", widthMm: 1600, heightMm: 100, count: 1 }], 1500).tooWide).toEqual(["Trop large"]);
  });
});

describe("reference patterns (E18b)", async () => {
  const { patternZones } = await import("./pattern-templates.ts");
  it("gives every tee piece a box with seam and bleed, front and back aligned on the 3D garment", () => {
    const z = patternZones("tee");
    expect(z.map((p) => p.key)).toEqual(["piece_devant", "piece_dos", "piece_manche", "piece_col"]);
    const front = z[0]!;
    expect(front.maxWidthMm).toBe(536 + 30); // 2 × 268 + 2 × (10 + 5)
    expect(front.pattern.body).toMatchObject({ panel: "front", x: -283, w: 566 });
    expect(z[1]!.pattern.body).toMatchObject({ panel: "back", x: -283 }); // same x: the motif continues across the side seams
    expect(z[2]!.pattern).toMatchObject({ quantity: 2, mirror: true });
  });
  it("fits a hoodie on a 150 cm roll", () => {
    const pieces = patternZones("hoodie").map((p) => ({ key: p.key, label: p.label, widthMm: p.maxWidthMm, heightMm: p.maxHeightMm, count: p.pattern.quantity }));
    const m = markerLayout(pieces, 1500);
    expect(m.tooWide).toEqual([]);
    expect(m.placements).toHaveLength(10); // devant, dos, 2 manches, 2 capuches, poche, 2 poignets, ceinture
    expect(m.lengthMm).toBeGreaterThan(1000);
    expect(m.lengthMm).toBeLessThan(3000);
  });
});

describe("all-over pricing and checks (E18b)", async () => {
  const { patternZones, decorationsFor, checkSurface, blankPieces } = await import("./index.ts");
  const zones = patternZones("tee").map((z) => ({ key: z.key, maxWidthMm: z.maxWidthMm, maxHeightMm: z.maxHeightMm, pattern: z.pattern }));
  it("prices every piece in full with the continuous motif, sleeves twice", () => {
    const d = { ...emptyDocument("tee-aop", "blanc"), allOver: { motif: "bandes" as const, colors: ["#B5562A", "#F2E9D8"] as [string, string], tileMm: 60 } };
    const deco = decorationsFor(d, zones);
    expect(deco.map((x) => x.zoneKey)).toEqual(["piece_devant", "piece_dos", "piece_manche", "piece_manche", "piece_col"]);
    expect(deco[0]).toMatchObject({ technique: "sublimation", widthMm: zones[0]!.maxWidthMm, colors: 1 });
    expect(decorationsFor(emptyDocument("tee-aop", "blanc"), zones)).toEqual([]);
  });
  it("warns about pieces that would stay plain white", () => {
    const labelled = zones.map((z) => ({ ...z, label: z.key }));
    const logo = { id: "t", type: "shape" as const, shape: "circle" as const, fill: "#000000", xMm: 280, yMm: 300, rotation: 0, widthMm: 50, heightMm: 50 };
    const d = { ...emptyDocument("tee-aop", "blanc"), surfaces: [{ zoneKey: "piece_devant", technique: "sublimation", layers: [logo] }] };
    expect(blankPieces(d, labelled)[0]?.message).toContain("piece_dos, piece_manche, piece_col");
    expect(blankPieces({ ...d, allOver: { motif: "uni", colors: ["#B5562A", "#B5562A"], tileMm: 50 } }, labelled)).toEqual([]);
    expect(blankPieces(emptyDocument("tee-aop", "blanc"), labelled)).toEqual([]);
  });
  it("adds the all-over checks to the general ones for a piece", () => {
    const z = zones[0]!;
    const s = { zoneKey: z.key, technique: "sublimation", layers: [{ id: "t", type: "shape" as const, shape: "circle" as const, fill: "#000000", xMm: 280, yMm: 300, rotation: 0, widthMm: 50, heightMm: 50 }] };
    expect(checkSurface(s, z).map((i) => i.code)).toContain("PIECE_NOT_COVERED");
    expect(checkSurface(s, { maxWidthMm: 300, maxHeightMm: 400 }).map((i) => i.code)).not.toContain("PIECE_NOT_COVERED");
  });
});
