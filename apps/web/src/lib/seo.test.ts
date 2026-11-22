import { describe, expect, it } from "vitest";
import { jsonLd, productJsonLd } from "./seo";

const product = {
  id: "1", slug: "t-shirt-col-rond", name: "T-shirt col rond 180 g", description: "Coton peigné </script><script>alert(1)</script>",
  material: "100 % coton", weightGsm: 180, category: { slug: "vetements", name: "Vêtements" }, colors: [], zones: [],
  price: { fromUnitPrice: 7500, fromQuantity: 1, byQuantity: [{ quantity: 1, unitPrice: 7500 }, { quantity: 25, unitPrice: 5600 }, { quantity: 100, unitPrice: null }], bestVolume: { unitPrice: 5600, quantity: 25 }, techniques: [] },
};

describe("search engines (E24c)", () => {
  it("describes a product with its public price range in FCFA", () => {
    const d = productJsonLd(product as never, "https://sawwa.sn/produits/t-shirt-col-rond");
    expect(d).toMatchObject({ "@type": "Product", brand: { name: "SAWWA" }, offers: { priceCurrency: "XOF", lowPrice: 5600, highPrice: 7500, offerCount: 2 } });
  });
  it("never lets content close the script tag", () => {
    const s = jsonLd(productJsonLd(product as never, "https://sawwa.sn/p"));
    expect(s).not.toContain("</script>");
    expect(JSON.parse(s).description).toContain("</script>");
  });
  it("omits the offer when no workshop offers the product yet", () => {
    expect(productJsonLd({ ...product, price: null } as never, "u")).not.toHaveProperty("offers");
  });
});
