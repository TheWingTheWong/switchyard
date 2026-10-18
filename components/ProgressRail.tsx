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

/** Turnout mark: one track diverging into two. */
function Turnout() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M1 12h20" /><path d="M6 12c5 0 8-8 15-8" />
    </svg>
  );
}

function Mark({ done, active }: { done: boolean; active: boolean }) {
  return (
    <span aria-hidden className={`grid place-items-center w-[18px] h-[18px] rounded-full border text-[10px] ${done ? "bg-[var(--stamp-on)] border-[var(--stamp-on)] text-[var(--stamp-deep)]" : active ? "border-[var(--stamp-on)]" : "border-[var(--stamp-on-muted)]"}`}>
      {done && <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 5.2l2 2L8 3" /></svg>}
    </span>
  );
}

export function ProgressRail() {
  const path = usePathname();
  const { replaceId, shortlist, pickId, challenge, research, memo, chatOpen, setChatOpen } = useStore();
  const done = [!!replaceId, shortlist.length > 0, !!pickId, !!challenge, !!research, !!memo];
  return (
    <header className="no-print sticky top-0 z-20 bg-stamp-deep text-[var(--stamp-on)]">
      <div className="flex items-center gap-5 px-5 h-14">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Turnout />
          <span className="display text-[19px] tracking-[0.02em]">SWITCHYARD</span>
        </Link>
        <nav className="flex items-stretch h-14 text-[13px] min-w-0 overflow-x-auto">
          {STEPS.map((s, i) => {
            const active = path === s.href;
            return (
              <Link key={s.href} href={s.href} aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 px-2.5 border-b-[3px] whitespace-nowrap ${active ? "border-[var(--stamp-on)] font-semibold" : "border-transparent text-[var(--stamp-on-muted)] hover:text-[var(--stamp-on)]"}`}>
                <Mark done={done[i]} active={active} />
                <span><span className="num mr-1 opacity-70">{i + 1}</span>{s.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[12px] shrink-0">
          <dl className="hidden min-[1280px]:flex items-center gap-4">
            <div><dt className="inline text-[var(--stamp-on-muted)]">Replace </dt><dd className="inline num">{replaceId}</dd></div>
            <div><dt className="inline text-[var(--stamp-on-muted)]">Shortlist </dt><dd className="inline num">{shortlist.length}/20</dd></div>
            <div><dt className="inline text-[var(--stamp-on-muted)]">Pick </dt><dd className="inline num">{pickId ?? "none"}</dd></div>
          </dl>
          <button className="btn !bg-transparent !text-[var(--stamp-on)] !border-[var(--stamp-on-muted)] hover:!border-[var(--stamp-on)] hover:!bg-[var(--stamp)]" onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? "Hide chat" : "Ask SWITCHYARD"}</button>
        </div>
      </div>
    </header>
  );
}
