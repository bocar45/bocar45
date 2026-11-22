import sharp from "sharp";

/**
 * The print renderer reads PNG and JPEG only. Other formats accepted by the studio (WebP) are converted to PNG,
 * losslessly and at full resolution, before rendering.
 */
export async function toPrintableImage(bytes: Uint8Array, mime: string): Promise<{ bytes: Uint8Array; mime: "image/png" | "image/jpeg" }> {
  if (mime === "image/png" || mime === "image/jpeg") return { bytes, mime };
  const png = await sharp(bytes).png({ compressionLevel: 6 }).toBuffer();
  return { bytes: new Uint8Array(png), mime: "image/png" };
}
