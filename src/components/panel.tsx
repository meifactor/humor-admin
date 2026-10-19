import type { ReactNode } from "react";
import { panelClass } from "@/components/ui";

type PanelProps = {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
};

// A dashboard panel with a small station-sign style heading.
export function Panel({ title, subtitle, aside, children, className = "" }: PanelProps) {
  return (
    <section className={`${panelClass} p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 h-[2px] w-10 bg-white" aria-hidden />
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Every chart gets a table view, for screen readers and exact numbers.
export function TableView({ children }: { children: ReactNode }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-bold text-ink-2 hover:text-white">Show as table</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border border-edge">{children}</div>
    </details>
  );
}

export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className={`${panelClass} p-4`}>
      <p className="text-xs font-bold tracking-wide text-ink-3 uppercase">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
    </div>
  );
}
