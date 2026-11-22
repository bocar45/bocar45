import "server-only";
import { parseDesign, type DesignDocument } from "@sawwa/design";
import type { SupabaseClient } from "@supabase/supabase-js";

export const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** Signed URLs for the images of a design (1 hour). The client passed must be allowed to read them. */
export async function signedDesignUrls(client: SupabaseClient, doc: DesignDocument): Promise<Record<string, string>> {
  const paths = doc.surfaces.flatMap((s) => s.layers).flatMap((l) => (l.type === "image" && l.src.startsWith("storage:design-assets/") ? [l.src.slice("storage:design-assets/".length)] : []));
  if (paths.length === 0) return {};
  const { data } = await client.storage.from("design-assets").createSignedUrls(paths, 3600);
  const urls: Record<string, string> = {};
  for (const s of data ?? []) if (s.signedUrl && s.path) urls[`storage:design-assets/${s.path}`] = s.signedUrl;
  return urls;
}

export function readDoc(raw: unknown): DesignDocument | null {
  const p = parseDesign(raw);
  return p.ok ? p.value : null;
}

export type ZoneRow = { key: string; anchor: { label?: string } | null; max_width_mm: number; max_height_mm: number };
export const zoneList = (zones: ZoneRow[] | null | undefined) =>
  (zones ?? []).map((z) => ({ key: z.key, label: z.anchor?.label ?? z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm }));

export const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-SN", { dateStyle: "medium", timeStyle: "short" });
