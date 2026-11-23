import { describe, expect, it } from "vitest";
import { normaliseSlug, parseStorefront, textOn } from "./storefront-form";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const offered = new Set([P1]);
const base = { slug: "", name: "Teranga Print", tagline: "Impression à Dakar", primary: "#0f3d3e", accent: "#E3A33B", phone: "77 123 45 67", productIds: [P1], status: "active" };

describe("storefront form", () => {
  it("normalises the address from the name, accents included", () => {
    expect(normaliseSlug("  Atelier Médina — Colobane! ")).toBe("atelier-medina-colobane");
    expect(parseStorefront(base, offered)).toMatchObject({ ok: true, value: { slug: "teranga-print", contactPhone: "+221771234567", theme: { primary: "#0F3D3E", onPrimary: "#FFFFFF" } } });
  });

  it("refuses reserved or too short addresses", () => {
    expect(parseStorefront({ ...base, slug: "admin" }, offered).ok).toBe(false);
    expect(parseStorefront({ ...base, slug: "a!" , name: "A" }, offered).ok).toBe(false);
  });

  it("only accepts the workshop's own active products", () => {
    expect(parseStorefront({ ...base, productIds: [P2] }, offered)).toMatchObject({ ok: false });
    expect(parseStorefront({ ...base, productIds: ["x' or 1=1"] }, offered)).toMatchObject({ ok: false });
  });

  it("needs a product to go online, not for a draft", () => {
    expect(parseStorefront({ ...base, productIds: [] }, offered).ok).toBe(false);
    expect(parseStorefront({ ...base, productIds: [], status: "draft" }, offered).ok).toBe(true);
  });

  it("checks colours and phone", () => {
    expect(parseStorefront({ ...base, primary: "red" }, offered).ok).toBe(false);
    expect(parseStorefront({ ...base, phone: "12345" }, offered).ok).toBe(false);
    expect(parseStorefront({ ...base, phone: "" }, offered)).toMatchObject({ ok: true, value: { contactPhone: null } });
  });

  it("picks a readable text colour", () => {
    expect(textOn("#FFFFFF")).toBe("#1C1C1C");
    expect(textOn("#E3A33B")).toBe("#1C1C1C");
    expect(textOn("#1F2A44")).toBe("#FFFFFF");
  });
});
