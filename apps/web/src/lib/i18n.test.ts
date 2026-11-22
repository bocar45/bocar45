import { describe, expect, it } from "vitest";
import { fcfaIn, l, loc, pickLang } from "./i18n";

describe("French / English (E24d)", () => {
  it("chooses the cookie first, then the browser, then French", () => {
    expect(pickLang("en", "fr-FR")).toBe("en");
    expect(pickLang(undefined, "en-US,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(pickLang(undefined, "wo-SN,fr;q=0.9,en;q=0.5")).toBe("fr");
    expect(pickLang(undefined, "de-DE")).toBe("fr");
    expect(pickLang("xx", null)).toBe("fr");
  });
  it("picks the text and the catalogue name in the reader's language, English falling back to French", () => {
    expect(l("en", "Catalogue", "Catalog")).toBe("Catalog");
    expect(loc({ fr: "T-shirt col rond", en: "Crew-neck T-shirt" }, "en")).toBe("Crew-neck T-shirt");
    expect(loc({ fr: "Gourde", en: "" }, "en")).toBe("Gourde");
    expect(loc({ fr: "Gourde" }, "fr")).toBe("Gourde");
  });
  it("formats FCFA amounts without decimals", () => {
    expect(fcfaIn("en", 12500)).toBe("12,500 FCFA");
    expect(fcfaIn("fr", 12500).replace(/\s/g, " ")).toBe("12 500 FCFA");
  });
});
