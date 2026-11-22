"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useLang } from "./lang-context";

/** FR | EN switch: keeps the current page (E24d). */
export function LangSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  const path = usePathname();
  const qs = useSearchParams().toString();
  const here = encodeURIComponent(`${path}${qs ? `?${qs}` : ""}`);
  return (
    <span className={`flex items-center gap-1 text-xs font-bold ${className}`} aria-label={lang === "en" ? "Language" : "Langue"}>
      {(["fr", "en"] as const).map((k) => (
        <a key={k} href={`/langue?l=${k}&suite=${here}`} lang={k} hrefLang={k} aria-current={lang === k ? "true" : undefined}
          className={`rounded-full px-2 py-1 ${lang === k ? "bg-brun text-ivoire" : "hover:bg-sable"}`}>{k.toUpperCase()}</a>
      ))}
    </span>
  );
}
