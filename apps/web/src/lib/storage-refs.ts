import type { DesignDocument } from "@sawwa/design";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Images of a design live in one of two buckets:
 * - `design-assets` (private): the customer's own uploads, under `<user id>/…`;
 * - `template-assets` (public): photos and decorations of SAWWA templates (E15), written by the catalogue team only.
 */
export type ImageBucket = "design-assets" | "template-assets";
const BUCKETS: ImageBucket[] = ["design-assets", "template-assets"];

export function storageRef(src: string): { bucket: ImageBucket; path: string } | null {
  if (!src.startsWith("storage:") || src.includes("..")) return null;
  const rest = src.slice("storage:".length);
  const bucket = BUCKETS.find((b) => rest.startsWith(`${b}/`));
  return bucket ? { bucket, path: rest.slice(bucket.length + 1) } : null;
}

export const isTemplateAsset = (src: string) => storageRef(src)?.bucket === "template-assets";

/** Displayable URLs for the stored images of a design: signed for the customer's (1 hour), public for templates. */
export async function imageUrls(client: SupabaseClient, doc: DesignDocument): Promise<Record<string, string>> {
  const refs = doc.surfaces.flatMap((s) => s.layers).flatMap((l) => (l.type === "image" ? [[l.src, storageRef(l.src)] as const] : []));
  const urls: Record<string, string> = {};
  const own = refs.filter(([, r]) => r?.bucket === "design-assets").map(([, r]) => r!.path);
  if (own.length) {
    const { data } = await client.storage.from("design-assets").createSignedUrls(own, 3600);
    for (const s of data ?? []) if (s.signedUrl && s.path) urls[`storage:design-assets/${s.path}`] = s.signedUrl;
  }
  for (const [src, r] of refs) {
    if (r?.bucket === "template-assets") urls[src] = client.storage.from("template-assets").getPublicUrl(r.path).data.publicUrl;
  }
  return urls;
}
