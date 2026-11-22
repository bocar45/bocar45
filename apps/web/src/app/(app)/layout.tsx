import type { Metadata } from "next";

/** Accounts, workshop and admin spaces: never indexed (E24c). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>;
}
