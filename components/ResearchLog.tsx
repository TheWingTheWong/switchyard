"use client";
import type { ResearchEvent, Source } from "@/lib/research-types";

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function Links({ results }: { results: Source[] }) {
  if (!results.length) return <div className="text-muted text-[12px]">no results</div>;
  return (
    <ul className="mt-1 space-y-0.5">
      {results.map((r) => (
        <li key={r.url} className="text-[12px] truncate">
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:no-underline">{r.title}</a>
          <span className="text-muted"> · {host(r.url)}</span>
        </li>
      ))}
    </ul>
  );
}

const LABEL: Record<ResearchEvent["type"], string> = {
  plan: "Plan", search: "Search", redflag: "Red flag", dig: "Dig deeper", status: "Status", report: "Report", error: "Error",
};

function Line({ ev }: { ev: ResearchEvent }) {
  switch (ev.type) {
    case "plan":
      return (
        <div>
          <div>{ev.text}</div>
          <ol className="mt-1 text-[12px] text-muted list-decimal list-inside">
            {ev.queries.map((q, i) => <li key={i}><span className="text-fg">{q.dimension}</span> — {q.query}</li>)}
          </ol>
        </div>
      );
    case "search":
      return <div><div><span className="mono text-[12px]">{ev.query}</span>{ev.dimension && <span className="text-muted"> · {ev.dimension}</span>}</div><Links results={ev.results} /></div>;
    case "dig":
      return <div><div className="font-medium">{ev.reason}</div><div className="mono text-[12px]">→ {ev.query}</div><Links results={ev.results} /></div>;
    case "redflag":
      return (
        <div>
          <span className={`inline-block px-1 mr-2 text-[11px] uppercase ${ev.flag.severity === "high" ? "bg-[var(--risk-critical)] text-[var(--risk-critical-fg)]" : ev.flag.severity === "medium" ? "bg-[var(--risk-high)] text-[var(--risk-high-fg)]" : "bg-[var(--risk-low)]"}`}>{ev.flag.severity}</span>
          <span className="font-medium">{ev.flag.title}</span>
          <div className="text-[12px] text-muted">{ev.flag.detail}</div>
          <a href={ev.flag.url} target="_blank" rel="noopener noreferrer" className="text-[12px] underline underline-offset-2">{host(ev.flag.url)}</a>
        </div>
      );
    case "report":
      return <div>Report ready · {ev.report.redFlags.length} red flags · {ev.report.sources.length} sources{ev.report.cached ? " · cached run" : ""}</div>;
    default:
      return <div className={ev.type === "error" ? "" : "text-muted"}>{ev.text}</div>;
  }
}

export function ResearchLog({ events, running }: { events: ResearchEvent[]; running?: boolean }) {
  return (
    <div className="card p-3">
      <div className="label mb-2">Agent log</div>
      {events.length === 0 && !running && <div className="text-muted text-[13px]">No research run yet.</div>}
      <ol className="space-y-2">
        {events.map((ev, i) => (
          <li key={i} className={`grid grid-cols-[88px_1fr] gap-3 text-[13px] border-t border-line pt-2 first:border-t-0 first:pt-0 ${ev.type === "error" ? "font-medium" : ""}`}>
            <span className={`label pt-0.5 ${ev.type === "redflag" || ev.type === "dig" || ev.type === "error" ? "!text-fg font-semibold" : ""}`}>{LABEL[ev.type]}</span>
            <div className="min-w-0"><Line ev={ev} /></div>
          </li>
        ))}
        {running && <li className="text-muted text-[13px] animate-pulse">Working…</li>}
      </ol>
    </div>
  );
}
