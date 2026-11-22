import { describe, expect, it } from "vitest";
import { emptyDocument, type DesignDocument } from "@sawwa/design";
import { foreignImages } from "./design-ownership";

const doc = (srcs: string[]): DesignDocument => ({
  ...emptyDocument("tee", "ivoire"),
  surfaces: [{ zoneKey: "front", technique: "dtf", layers: srcs.map((src, i) => ({ id: `i${i}`, type: "image" as const, src, name: "x", pxWidth: 10, pxHeight: 10, xMm: 0, yMm: 0, rotation: 0, widthMm: 10, heightMm: 10 })) }],
});
const me = "11111111-1111-1111-1111-111111111111";

describe("design image ownership", () => {
  it("accepts the customer's own uploads", () => {
    expect(foreignImages(doc([`storage:design-assets/${me}/a.png`]), me)).toEqual([]);
  });
  it("accepts SAWWA template images (public, written by the catalogue team only)", () => {
    expect(foreignImages(doc(["storage:template-assets/0b7c/exemple.jpg"]), me)).toEqual([]);
  });
  it("flags other folders, other buckets and path tricks", () => {
    const bad = [
      "storage:design-assets/22222222-2222-2222-2222-222222222222/a.png",
      `storage:qc-photos/${me}/a.png`,
      `storage:design-assets/${me}/../2222/a.png`,
      "storage:template-assets/../design-assets/2222/a.png",
      `storage:design-assets/${me}x/a.png`,
    ];
    expect(foreignImages(doc(bad), me)).toEqual(bad);
  });
});
