import type { DesignDocument } from "@sawwa/design";

/**
 * Images a design refers to that are not in the customer's own folder. A design must only use the customer's
 * uploads: otherwise a crafted document could make the server hand someone else's image to a workshop.
 */
export function foreignImages(doc: DesignDocument, userId: string): string[] {
  const own = `storage:design-assets/${userId}/`;
  return doc.surfaces.flatMap((s) => s.layers).flatMap((l) =>
    l.type === "image" && l.src.startsWith("storage:") && (!l.src.startsWith(own) || l.src.includes("..")) ? [l.src] : [],
  );
}
