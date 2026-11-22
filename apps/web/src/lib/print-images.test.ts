import { describe, expect, it } from "vitest";
import path from "node:path";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import { renderSurfaceSvg, fontFiles } from "@sawwa/render";
import { UnprintableImageError, toPrintableImage } from "./print-images";

describe("print images", () => {
  it("converts WebP to PNG so it appears in the print file", async () => {
    const webp = new Uint8Array(await sharp({ create: { width: 64, height: 64, channels: 4, background: "#2F4B7C" } }).webp({ lossless: true }).toBuffer());
    const { bytes, mime } = await toPrintableImage(webp, "image/webp");
    expect(mime).toBe("image/png");
    const meta = await sharp(bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", 64, 64]);

    const href = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
    const { svg } = renderSurfaceSvg(
      { zoneKey: "f", technique: "dtf", layers: [{ id: "i", type: "image", src: "a", name: "a.webp", pxWidth: 64, pxHeight: 64, xMm: 50, yMm: 50, rotation: 0, widthMm: 80, heightMm: 80 }] },
      { maxWidthMm: 100, maxHeightMm: 100 }, { dpi: 30, images: { a: href } },
    );
    const fontDir = path.join(__dirname, "../../../../packages/render/fonts");
    const out = new Resvg(svg, { font: { fontFiles: fontFiles().map((f) => path.join(fontDir, f)), loadSystemFonts: false, defaultFontFamily: "Manrope" } }).render();
    const px = out.pixels; // read once: each access copies the buffer
    const center = ((Math.floor(out.height / 2) * out.width) + Math.floor(out.width / 2)) * 4;
    expect(px[center + 3]).toBe(255);
    expect([px[center], px[center + 1], px[center + 2]]).toEqual([0x2f, 0x4b, 0x7c]);
  });

  it("re-encodes PNG and JPEG, keeping their size", async () => {
    const png = new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 4, background: "#B5562A" } }).png().toBuffer());
    const jpg = new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: "#B5562A" } }).jpeg().toBuffer());
    const a = await toPrintableImage(png, "image/png");
    const b = await toPrintableImage(jpg, "image/jpeg");
    expect(a.mime).toBe("image/png");
    expect(b.mime).toBe("image/jpeg");
    expect([(await sharp(a.bytes).metadata()).width, (await sharp(b.bytes).metadata()).height]).toEqual([40, 30]);
  });

  it("refuses a file that is not an image, whatever its declared type", async () => {
    const fake = new TextEncoder().encode("<svg onload=alert(1)>");
    await expect(toPrintableImage(fake, "image/png")).rejects.toThrow(UnprintableImageError);
  });
});
