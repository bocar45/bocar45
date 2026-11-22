import { describe, expect, it } from "vitest";
import { coverCrop, emptyDocument, fillPhoto, fillText, parseDesign, templateBlockers, templateFields, type DesignDocument } from "./index.ts";

const mugPhoto = (): DesignDocument => ({
  ...emptyDocument("mug-blanc", "blanc"),
  surfaces: [{
    zoneKey: "wrap", technique: "sublimation", layers: [
      { id: "cadre", type: "shape", shape: "rect", fill: "#C9923E", xMm: 100, yMm: 45, rotation: 0, widthMm: 90, heightMm: 70, locked: true },
      { id: "photo", type: "image", src: "storage:template-assets/t1/exemple.jpg", name: "exemple.jpg", pxWidth: 1200, pxHeight: 900,
        xMm: 100, yMm: 45, rotation: 0, widthMm: 80, heightMm: 60, field: { kind: "photo", label: "Votre photo" } },
      { id: "prenom", type: "text", text: "Aïssatou", font: "caveat", sizeMm: 12, fill: "#2A1A12", xMm: 100, yMm: 85, rotation: 0, widthMm: 80, heightMm: 14,
        field: { kind: "text", label: "Prénom", maxLength: 12 } },
    ],
  }],
});

describe("templates (E15)", () => {
  it("lists the fields the customer fills", () => {
    expect(templateFields(mugPhoto()).map((f) => [f.layerId, f.kind, f.label])).toEqual([["photo", "photo", "Votre photo"], ["prenom", "text", "Prénom"]]);
    expect(parseDesign(mugPhoto()).ok).toBe(true);
  });
  it("refuses a field on the wrong kind of layer, an empty label or a silly maximum", () => {
    const bad = (field: unknown, id = "prenom") => {
      const d = mugPhoto();
      return parseDesign({ ...d, surfaces: [{ ...d.surfaces[0]!, layers: d.surfaces[0]!.layers.map((l) => (l.id === id ? { ...l, field } : l)) }] }).ok;
    };
    expect(bad({ kind: "photo", label: "x" })).toBe(false); // photo on a text layer
    expect(bad({ kind: "text", label: "x" }, "cadre")).toBe(false); // text on a shape
    expect(bad({ kind: "text", label: "  " })).toBe(false);
    expect(bad({ kind: "text", label: "Prénom", maxLength: 0 })).toBe(false);
    expect(bad({ kind: "text", label: "Prénom", maxLength: 500 })).toBe(false);
    expect(bad({ kind: "script", label: "x" })).toBe(false);
  });
  it("fills a text field on one line, within its maximum length", () => {
    const d = fillText(mugPhoto(), "prenom", "Mame  Diarra\nNdiaye Fall");
    const t = d.surfaces[0]!.layers.find((l) => l.id === "prenom");
    expect(t?.type === "text" && t.text).toBe("Mame Diarra ");
    // a locked decoration is never changed by the assistant
    expect(fillText(mugPhoto(), "cadre", "x")).toEqual(mugPhoto());
  });
  it("crops a photo to the frame ratio, centred, and keeps the frame in place", () => {
    expect(coverCrop(4000, 3000, 80, 60)).toEqual({ x: 0, y: 0, w: 4000, h: 3000 });
    expect(coverCrop(3000, 3000, 80, 60)).toEqual({ x: 0, y: 375, w: 3000, h: 2250 }); // square photo: top and bottom cut
    expect(coverCrop(1000, 3000, 80, 60)).toEqual({ x: 0, y: 1125, w: 1000, h: 750 });
    expect(coverCrop(6000, 1000, 80, 60)).toEqual({ x: 2333, y: 0, w: 1333, h: 1000 });
    const d = fillPhoto(mugPhoto(), "photo", { src: "idb:abc", name: "moi.jpg", pxWidth: 1333, pxHeight: 1000 });
    const p = d.surfaces[0]!.layers.find((l) => l.id === "photo");
    expect(p).toMatchObject({ src: "idb:abc", xMm: 100, yMm: 45, widthMm: 80, heightMm: 60, field: { kind: "photo" } });
  });
  it("says what blocks publication", () => {
    expect(templateBlockers(mugPhoto())).toEqual([]);
    expect(templateBlockers(emptyDocument("mug-blanc", "blanc"))).toHaveLength(2);
    const d = mugPhoto();
    const noField = { ...d, surfaces: [{ ...d.surfaces[0]!, layers: d.surfaces[0]!.layers.map(({ field: _f, ...l }) => l) }] } as DesignDocument;
    expect(templateBlockers(noField)).toEqual(["Marquez au moins un élément comme « photo du client » ou « texte du client »."]);
    expect(templateBlockers(fillPhoto(d, "photo", { src: "idb:x", name: "a.png", pxWidth: 1, pxHeight: 1 }))[0]).toContain("pas encore enregistrée");
  });
});
