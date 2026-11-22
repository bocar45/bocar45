import Link from "next/link";
import type { ReactNode } from "react";

export const inputClass = "w-full rounded-md border border-line bg-surface px-3 py-2";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={htmlFor} className="font-semibold">{label}</label>
      {children}
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </div>
  );
}

export function PageHeader({ title, back, children }: { title: string; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <div className="grid gap-2">
      {back && <Link href={back.href} className="text-sm text-muted underline">← {back.label}</Link>}
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="font-display text-3xl">{title}</h1>
        <div className="ml-auto flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 rounded-xl border border-line bg-surface p-5">
      <h2 id={id} className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

const PILL = {
  draft: "bg-line/50 text-muted",
  active: "bg-ok/15 text-ok",
  archived: "bg-line/50 text-muted",
  retired: "bg-line/50 text-muted",
  pending: "bg-ocre/20 text-fg",
  suspended: "bg-error/10 text-error",
  rejected: "bg-error/10 text-error",
} as const;
const PILL_LABEL = {
  draft: "Brouillon", active: "Actif", archived: "Archivé", retired: "Retiré",
  pending: "En attente", suspended: "Suspendu", rejected: "Refusé",
} as const;

export function StatusPill({ status }: { status: keyof typeof PILL }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${PILL[status]}`}>{PILL_LABEL[status]}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line p-4 text-muted">{children}</p>;
}

export function fr(name: unknown): string {
  if (name && typeof name === "object" && "fr" in name) return String((name as { fr: unknown }).fr ?? "");
  return "";
}
