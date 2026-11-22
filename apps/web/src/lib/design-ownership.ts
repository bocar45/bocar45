import type { DesignDocument } from "@sawwa/design";
import { storageRef } from "./storage-refs";

/**
 * Images a design refers to that are neither in the customer's own folder nor SAWWA template images (public).
 * A design must only use those: otherwise a crafted document could make the server hand someone else's image to a workshop.
 */
export function foreignImages(doc: DesignDocument, userId: string): string[] {
  return doc.surfaces.flatMap((s) => s.layers).flatMap((l) => {
    if (l.type !== "image" || !l.src.startsWith("storage:")) return [];
    const ref = storageRef(l.src);
    const ok = ref && (ref.bucket === "template-assets" || ref.path.startsWith(`${userId}/`));
    return ok ? [] : [l.src];
  });
}
