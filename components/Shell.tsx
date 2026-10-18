"use client";
import { useStore } from "@/lib/store";
import { ProgressRail } from "./ProgressRail";
import { ChatPanel } from "./ChatPanel";

export function Shell({ children }: { children: React.ReactNode }) {
  const chatOpen = useStore((s) => s.chatOpen);
  return (
    <div className="min-h-screen flex flex-col">
      <ProgressRail />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 px-6 py-5">{children}</main>
        {chatOpen && (
          <aside className="no-print w-[420px] shrink-0 border-l border-line sticky top-12 h-[calc(100vh-3rem)]">
            <ChatPanel />
          </aside>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ step, title, sub, children }: { step: string; title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end gap-4">
      <div>
        <div className="label">{step}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="text-muted mt-1 max-w-3xl">{sub}</p>}
      </div>
      <div className="ml-auto flex gap-2">{children}</div>
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="num text-2xl mt-1">{value}</div>
      {sub && <div className="text-muted text-[12px] mt-1">{sub}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="text-muted">Loading 10,000 suppliers…</div>;
}
