import { describe, expect, it } from "vitest";
import { widestPiece, checkRoster, emptyDocument, needsRoster, parseDesign, parseRosterText, personalize, rosterKeys, sizesFromRoster, type DesignDocument } from "./index.ts";

const maillot = (): DesignDocument => ({
  ...emptyDocument("maillot", "blanc"),
  surfaces: [
    { zoneKey: "back", technique: "dtf", layers: [
      { id: "nom", type: "text", text: "DIOP", font: "anton", sizeMm: 60, fill: "#2A1A12", xMm: 150, yMm: 60, rotation: 0, widthMm: 120, heightMm: 70, perItem: { key: "name", maxLength: 12 } },
      { id: "num", type: "text", text: "10", font: "anton", sizeMm: 200, fill: "#2A1A12", xMm: 150, yMm: 220, rotation: 0, widthMm: 120, heightMm: 200, perItem: { key: "number", maxLength: 2 } },
    ] },
    { zoneKey: "front", technique: "dtf", layers: [
      { id: "club", type: "text", text: "ASC JARAAF", font: "anton", sizeMm: 30, fill: "#2A1A12", xMm: 150, yMm: 60, rotation: 0, widthMm: 200, heightMm: 40 },
      { id: "num-avant", type: "text", text: "10", font: "anton", sizeMm: 60, fill: "#2A1A12", xMm: 150, yMm: 140, rotation: 0, widthMm: 40, heightMm: 60, perItem: { key: "number", maxLength: 3 } },
    ] },
  ],
});
const zones = [{ key: "back", maxWidthMm: 300 }, { key: "front", maxWidthMm: 300 }];
const SIZES = ["S", "M", "L", "XL"];

describe("team orders: names and numbers (E16)", () => {
  it("finds which values each piece needs, with the strictest length", () => {
    expect(parseDesign(maillot()).ok).toBe(true);
    expect(rosterKeys(maillot())).toEqual({ name: { maxLength: 12 }, number: { maxLength: 2 } });
    expect(needsRoster(emptyDocument("x", "y"))).toBe(false);
  });
  it("refuses a variable text badly declared", () => {
    const d = maillot();
    const withP = (perItem: unknown) => parseDesign({ ...d, surfaces: [{ ...d.surfaces[0]!, layers: [{ ...d.surfaces[0]!.layers[0]!, perItem }] }] }).ok;
    expect(withP({ key: "age", maxLength: 3 })).toBe(false);
    expect(withP({ key: "number", maxLength: 6 })).toBe(false);
    expect(withP({ key: "name", maxLength: 0 })).toBe(false);
  });
  it("personalises every piece: capitals like the sample, number on front and back, empty name hidden", () => {
    const p = personalize(maillot(), { size: "M", name: "  Sadio   Mané ", number: "7" });
    const all = p.surfaces.flatMap((s) => s.layers);
    expect(all.find((l) => l.id === "nom")).toMatchObject({ text: "SADIO MANÉ", widthMm: 300 });
    expect(all.find((l) => l.id === "num")).toMatchObject({ text: "7", widthMm: 60 });
    expect(all.find((l) => l.id === "num-avant")).toMatchObject({ text: "7" });
    expect(all.find((l) => l.id === "club")).toMatchObject({ text: "ASC JARAAF" });
    expect(personalize(maillot(), { size: "M", number: "9" }).surfaces[0]!.layers[0]).toMatchObject({ text: "", hidden: true });
  });
  it("checks sizes, lengths, characters, digits and the print zone", () => {
    const ok = checkRoster(maillot(), [{ size: "M", name: "Diallo", number: "9" }, { size: "XL", name: "Ndiaye", number: "9" }], SIZES, zones);
    expect(ok.errors).toEqual([]);
    expect(ok.warnings).toEqual(["Numéro 9 en double (lignes 1, 2)."]);
    const bad = checkRoster(maillot(), [
      { size: "XXL", name: "Ba", number: "1" },
      { size: "M", name: "Abdoulaye Wade", number: "1" },
      { size: "M", name: "Ba<script>", number: "1" },
      { size: "M", name: "Ba", number: "100" },
      { size: "M", name: "Ba", number: "1a" },
      { size: "M", name: "Babacar Ndao", number: "1" }, // 12 characters but wider than the 30 cm zone
    ], SIZES, zones).errors;
    expect(bad).toHaveLength(6);
    expect(bad[0]).toContain("Ligne 1 : taille");
    expect(bad[1]).toContain("nom trop long");
    expect(bad[2]).toContain("caractères");
    expect(bad[3]).toContain("numéro trop long");
    expect(bad[4]).toContain("chiffres");
    expect(bad[5]).toContain("dépasse de la zone");
    expect(checkRoster(maillot(), [], SIZES, zones).errors).toEqual(["Ajoutez au moins une pièce à la liste."]);
  });
  it("prices and prints at the widest piece", () => {
    const w = widestPiece(maillot(), [{ size: "M", name: "Ba", number: "7" }, { size: "L", name: "Ndiaye", number: "10" }]);
    expect(w.surfaces[0]!.layers.find((l) => l.id === "nom")!.widthMm).toBe(180); // NDIAYE: 6 × 30 mm
    expect(w.surfaces[0]!.layers.find((l) => l.id === "num")!.widthMm).toBe(120);
    expect(widestPiece(maillot(), [])).toEqual(maillot());
  });
  it("counts sizes from the roster", () => {
    expect(sizesFromRoster([{ size: "M" }, { size: "L" }, { size: "M" }])).toEqual({ M: 2, L: 1 });
  });
  it("reads a list pasted from a spreadsheet or a message, columns in any order", () => {
    expect(parseRosterText("DIOP\t10\tM\nfall; 7; xl\n\nL,Mame Diarra Ndiaye,23\n9 ; S", SIZES)).toEqual([
      { size: "M", name: "DIOP", number: "10" },
      { size: "XL", name: "fall", number: "7" },
      { size: "L", name: "Mame Diarra Ndiaye", number: "23" },
      { size: "S", number: "9" },
    ]);
  });
});
