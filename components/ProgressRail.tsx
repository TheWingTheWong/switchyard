"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const STEPS = [
  { href: "/", label: "Triage" },
  { href: "/narrow", label: "Narrow" },
  { href: "/compare", label: "Compare" },
  { href: "/challenge", label: "Challenge" },
  { href: "/verify", label: "Verify" },
  { href: "/decide", label: "Decide" },
];

export function ProgressRail() {
  const path = usePathname();
  const { replaceId, shortlist, pickId, challenge, research, memo, chatOpen, setChatOpen } = useStore();
  const done = [!!replaceId, shortlist.length > 0, !!pickId, !!challenge, !!research, !!memo];
  return (
    <header className="no-print border-b border-line sticky top-0 z-20 bg-bg">
      <div className="flex items-center gap-6 px-4 h-12">
        <Link href="/" className="font-semibold tracking-tight">SWITCHYARD</Link>
        <nav className="flex items-center text-[13px]">
          {STEPS.map((s, i) => {
            const active = path === s.href;
            return (
              <Link key={s.href} href={s.href} className={`flex items-center px-2 h-12 border-b-2 ${active ? "border-fg font-semibold" : "border-transparent text-muted hover:text-fg"}`}>
                <span className="num mr-1.5">{done[i] ? "■" : "□"}</span>{i + 1}. {s.label}
                {i < STEPS.length - 1 && <span className="ml-3 text-muted">→</span>}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[12px]">
          <span className="text-muted">Replace <span className="num text-fg">{replaceId}</span></span>
          <span className="text-muted">Shortlist <span className="num text-fg">{shortlist.length}/20</span></span>
          <span className="text-muted">Pick <span className="num text-fg">{pickId ?? "—"}</span></span>
          <button className="btn" onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? "Hide chat" : "Ask SWITCHYARD"}</button>
        </div>
      </div>
    </header>
  );
}
