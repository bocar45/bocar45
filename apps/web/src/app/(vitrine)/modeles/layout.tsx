import { designFontsClass } from "@/lib/studio-fonts";

export default function TemplatesLayout({ children }: { children: React.ReactNode }) {
  return <div className={designFontsClass}>{children}</div>;
}
