import sharp from "sharp";

export class UnprintableImageError extends Error {}

const MAX_SIDE = 12000;

/**
 * Every image goes through a real decoder and is re-encoded before printing: this checks that the stored file is
 * really an image (whatever its name or declared type), strips metadata, and gives the renderer a format it reads
 * (PNG, lossless). JPEG stays JPEG at maximum quality to keep file sizes reasonable.
 */
export async function toPrintableImage(bytes: Uint8Array, _declaredMime: string): Promise<{ bytes: Uint8Array; mime: "image/png" | "image/jpeg" }> {
  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new UnprintableImageError("Un fichier de cette création n'est pas une image lisible.");
  }
  if (!meta.width || !meta.height || meta.width > MAX_SIDE || meta.height > MAX_SIDE) {
    throw new UnprintableImageError(`Une image de cette création est trop grande (${MAX_SIDE} px maximum par côté).`);
  }
  if (meta.format === "jpeg") {
    const jpg = await sharp(bytes).rotate().jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer();
    return { bytes: new Uint8Array(jpg), mime: "image/jpeg" };
  }
  const png = await sharp(bytes).rotate().png({ compressionLevel: 6 }).toBuffer();
  return { bytes: new Uint8Array(png), mime: "image/png" };
}
