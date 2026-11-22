"use client";

import { useState, useTransition, type ReactNode } from "react";

export type ActionResult = { error?: string | null; ok?: string | null } | void;

/**
 * Form wired to a server action that keeps what the person typed when the action fails
 * (native form actions reset inputs). The action may redirect on success.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Enregistrement…",
  className = "grid gap-4",
  variant = "primary",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>();
  const style =
    variant === "primary"
      ? "bg-action font-bold text-on-action"
      : "border border-line bg-surface";
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => setResult(await action(data)));
      }}
    >
      {children}
      {result?.error && (
        <p role="alert" className="whitespace-pre-line text-error">⚠ {result.error}</p>
      )}
      {result?.ok && <p role="status" className="text-ok">✓ {result.ok}</p>}
      <button type="submit" disabled={pending} className={`w-fit rounded-md px-4 py-2 disabled:opacity-60 ${style}`}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
