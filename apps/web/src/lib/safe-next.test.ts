import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("redirect after sign-in (E24a)", () => {
  it("keeps paths of this site", () => {
    expect(safeNext("/studio/t-shirt?modele=anniv")).toBe("/studio/t-shirt?modele=anniv");
    expect(safeNext("/compte/devis/1#offre")).toBe("/compte/devis/1#offre");
  });
  it("refuses every way to another site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "javascript:alert(1)", "evil.com", "/\tevil", "\\\\evil.com", "", null, 42])
      expect(safeNext(bad)).toBe("/compte");
  });
});
