"use client";
import { useStore } from "@/lib/store";
import { ProgressRail } from "./ProgressRail";
import { ChatPanel } from "./ChatPanel";
import { archivo } from "./fonts";

export function Shell({ children }: { children: React.ReactNode }) {
  const chatOpen = useStore((s) => s.chatOpen);
  return (
    <div className={`${archivo.variable} font-sans min-h-screen flex flex-col bg-bg`}>
      <ProgressRail />
      <div className="flex flex-1 min-h-0">
        <main className="@container flex-1 min-w-0 px-6 pt-5 pb-10">{children}</main>
        {chatOpen && (
          <aside className="no-print w-[360px] shrink-0 border-l border-line bg-sheet sticky top-14 h-[calc(100vh-3.5rem)]">
            <ChatPanel />
          </aside>
        )}
      </div>
    </div>
  );
}

/** Screen header: step number in a ruled field box, then the question this step answers. */
export function PageHeader({ step, title, sub, children }: { step: string; title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  const n = step.match(/\d+/)?.[0];
  return (
    <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-fg pb-4">
      <div className="flex items-stretch gap-4 min-w-0">
        {n && (
          <div className="shrink-0 w-12 border border-stamp text-stamp grid place-items-center" aria-label={step}>
            <span className="display text-[30px]">{n}</span>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="display text-[28px]">{title}</h1>
          {sub && <p className="text-muted mt-1.5 max-w-[72ch] text-[13.5px]">{sub}</p>}
        </div>
      </div>
      {children && <div className="ml-auto flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** One field of a certificate's ruled header: caption, value, note. Lives inside .field-grid. */
export function Kpi({ label, value, sub, strong = false }: { label: string; value: React.ReactNode; sub?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="px-4 py-3 min-w-0">
      <div className="cap">{label}</div>
      <div className={`num mt-1 text-[25px] font-medium leading-tight ${strong ? "text-[var(--risk-critical)] font-semibold" : ""}`}>{value}</div>
      {sub && <div className="text-muted text-[12px] mt-1 leading-snug">{sub}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="text-muted py-10">Loading 10,000 suppliers…</div>;
}
