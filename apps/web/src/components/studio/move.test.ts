import { describe, expect, it } from "vitest";
import { emptyDocument, type DesignDocument } from "@sawwa/design";
import { preferredMode } from "../studio3d/support";
import { moveLayerToZone } from "./move";

const doc: DesignDocument = {
  ...emptyDocument("tee", "ivoire"),
  surfaces: [{ zoneKey: "front_center", technique: "dtf", layers: [
    { id: "t", type: "text", text: "TERANGA", font: "anton", sizeMm: 36, fill: "#2A1A12", xMm: 150, yMm: 60, rotation: 0, widthMm: 160, heightMm: 40 },
    { id: "s", type: "shape", shape: "losange", fill: "#C9923E", xMm: 150, yMm: 200, rotation: 0, widthMm: 30, heightMm: 30 },
  ] }],
};

describe("« Placer ici »", () => {
  it("moves a small element without shrinking it, centred in the target zone", () => {
    const d = moveLayerToZone(doc, "s", "front_center", { key: "chest_left", maxWidthMm: 100, maxHeightMm: 100, technique: "embroidery" });
    const chest = d.surfaces.find((s) => s.zoneKey === "chest_left")!;
    expect(chest.technique).toBe("embroidery");
    expect(chest.layers[0]).toMatchObject({ id: "s", xMm: 50, yMm: 50, widthMm: 30, heightMm: 30 });
    expect(d.surfaces.find((s) => s.zoneKey === "front_center")!.layers.map((l) => l.id)).toEqual(["t"]);
  });
  it("shrinks a large element to fit, text through its font size, and drops the emptied zone", () => {
    const one = { ...doc, surfaces: [{ ...doc.surfaces[0]!, layers: [doc.surfaces[0]!.layers[0]!] }] };
    const d = moveLayerToZone(one, "t", "front_center", { key: "left_sleeve", maxWidthMm: 90, maxHeightMm: 90, technique: "dtf" });
    expect(d.surfaces.map((s) => s.zoneKey)).toEqual(["left_sleeve"]);
    const t = d.surfaces[0]!.layers[0]!;
    expect(t.widthMm).toBeCloseTo(81);
    expect(t.type === "text" && t.sizeMm).toBeCloseTo(18.2, 1);
  });
  it("does nothing for an unknown element or the same zone", () => {
    expect(moveLayerToZone(doc, "nope", "front_center", { key: "back_center", maxWidthMm: 300, maxHeightMm: 400, technique: "dtf" })).toBe(doc);
    expect(moveLayerToZone(doc, "t", "front_center", { key: "front_center", maxWidthMm: 300, maxHeightMm: 400, technique: "dtf" })).toBe(doc);
  });
});

describe("studio display mode", () => {
  it("uses 2D + 3D on large screens with WebGL, 2D otherwise", () => {
    expect(preferredMode(true, 1440)).toBe("split");
    expect(preferredMode(true, 390)).toBe("edit");
    expect(preferredMode(false, 1440)).toBe("edit");
  });
});
