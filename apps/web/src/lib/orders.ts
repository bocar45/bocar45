import "server-only";
import { parseDesign, type DesignDocument } from "@sawwa/design";
import type { SupabaseClient } from "@supabase/supabase-js";
import { imageUrls } from "./storage-refs";

export const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

/** URLs for the images of a design (signed for 1 hour, or public for template images). The client must be allowed to read them. */
export const signedDesignUrls = (client: SupabaseClient, doc: DesignDocument) => imageUrls(client, doc);

export function readDoc(raw: unknown): DesignDocument | null {
  const p = parseDesign(raw);
  return p.ok ? p.value : null;
}

export type ZoneRow = { key: string; anchor: { label?: string } | null; max_width_mm: number; max_height_mm: number };
export const zoneList = (zones: ZoneRow[] | null | undefined) =>
  (zones ?? []).map((z) => ({ key: z.key, label: z.anchor?.label ?? z.key, maxWidthMm: z.max_width_mm, maxHeightMm: z.max_height_mm }));

export const dateTime = (iso: string) => new Date(iso).toLocaleString("fr-SN", { dateStyle: "medium", timeStyle: "short" });

/** Version history of an order line (RLS decides who can read it), with signed image URLs for every version. */
export async function loadVersions(client: SupabaseClient, orderItemId: string, signer: SupabaseClient = client) {
  const { data } = await client
    .from("order_item_versions")
    .select("proof_round, surcharge, created_at, version:design_versions(id, number, document)")
    .eq("order_item_id", orderItemId);
  const rows = (data ?? []).flatMap((r) => {
    const v = r.version as unknown as { id: string; number: number; document: unknown } | null;
    if (!v) return []; // version not readable by this person: skip it rather than fail the page
    return [{ id: v.id, number: v.number, proofRound: r.proof_round as number, surcharge: Number(r.surcharge), createdAt: r.created_at as string, doc: readDoc(v.document) }];
  });
  const urls: Record<string, string> = {};
  for (const r of rows) if (r.doc) Object.assign(urls, await signedDesignUrls(signer, r.doc));
  return { versions: rows, urls };
}
