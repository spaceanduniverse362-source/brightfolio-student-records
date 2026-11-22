import { Emblem } from "./Emblem";
import type { SchoolSettings } from "@/lib/school";

export function DocHeader({ settings, title, subtitle }: { settings: SchoolSettings | null | undefined; title: string; subtitle?: string }) {
  return (
    <header className="flex items-center gap-4 border-b-2 border-paper-accent pb-3">
      <Emblem variant="ink" className="h-20 w-20 shrink-0" />
      <div className="flex-1 text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-paper-muted">
          {settings?.school_name_local ?? "Mana Barumsa Addaa Burqa Harbuu Sadarkaa Lammaffaa"}
        </p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper-accent">
          {settings?.school_name ?? "Burka Harbu Special Secondary School"}
        </h1>
        <p className="mt-1 font-display text-base font-semibold text-paper-gold">{title}</p>
        {subtitle && <p className="text-xs text-paper-muted">{subtitle}</p>}
      </div>
      <Emblem variant="ink" className="h-20 w-20 shrink-0 opacity-0" />
    </header>
  );
}

export function SignatureBox({ label, name }: { label: string; name?: string | undefined }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="h-10 w-full border-b border-paper-border" />
      <p className="mt-1 text-[11px] font-semibold">{name || "\u00A0"}</p>
      <p className="text-[10px] uppercase tracking-wider text-paper-muted">{label}</p>
    </div>
  );
}
