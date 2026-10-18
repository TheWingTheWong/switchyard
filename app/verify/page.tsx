"use client";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { ResearchLog } from "@/components/ResearchLog";
import { ShadowProfile } from "@/components/ShadowProfile";
import { useStore } from "@/lib/store";
import { useDataset } from "@/lib/data-client";
import type { ResearchEvent, ResearchReport } from "@/lib/research-types";

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const fmtTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:no-underline">{children}</a>;
}

export default function VerifyPage() {
  const research = useStore((s) => s.research);
  const setResearch = useStore((s) => s.setResearch);
  const supplierId = useStore((s) => s.pickId ?? s.replaceId);
  const ds = useDataset();
  const supplier = ds?.byId.get(supplierId) ?? null;

  const [company, setCompany] = useState("Knorr-Bremse");
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Show a previously stored report on load (zustand persist hydrates on client).
  useEffect(() => { if (research && !report && !running) { setReport(research); setCompany(research.company); } }, [research]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(cached: boolean) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true); setFailed(null); setEvents([]); setReport(null);
    let got: ResearchReport | null = null;
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cached ? { company: "Knorr-Bremse", cached: true } : { company }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: ResearchEvent;
          try { ev = JSON.parse(line); } catch { continue; }
          setEvents((e) => [...e, ev]);
          if (ev.type === "report") { got = ev.report; setReport(ev.report); setResearch(ev.report); }
        }
      }
      if (!got) throw new Error("Stream ended without a report");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setFailed((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader
        step="Step 5 · Verify"
        title="Research a real supplier"
        sub="The agent plans its own research, searches the web, follows red flags, and scores the company on the same 18 dimensions. Every claim is linked."
      />

      <form className="flex gap-2 mb-4 flex-wrap" onSubmit={(e) => { e.preventDefault(); if (company.trim()) void run(false); }}>
        <input className="input w-72" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" disabled={running} />
        <button type="submit" className="btn btn-primary" disabled={running || !company.trim()}>{running ? "Researching…" : "Run research"}</button>
        <button type="button" className="btn" disabled={running} onClick={() => void run(true)}>Load cached run</button>
        {running && <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>Stop</button>}
      </form>

      {failed && (
        <div className="card p-3 mb-4 flex items-center gap-3 text-[13px] border-fg">
          <span><strong>Live research failed:</strong> {failed}</span>
          <button className="btn ml-auto" onClick={() => void run(true)}>Load cached Knorr-Bremse run</button>
        </div>
      )}

      {report?.cached && (
        <div className="mb-4 inline-block border border-fg px-2 py-1 text-[12px] font-medium">
          Cached run from {fmtTime(report.researchedAt)}, replayed (not live)
        </div>
      )}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4 items-start">
        <div className="max-h-[calc(100vh-14rem)] overflow-auto">
          <ResearchLog events={events} running={running} />
        </div>

        {report ? <Report report={report} supplier={supplier} /> : (
          <div className="card p-6 text-muted text-[13px]">{running ? "Report will appear here when research completes…" : "Run research or load the cached Knorr-Bremse run."}</div>
        )}
      </div>
    </div>
  );
}

function Report({ report, supplier }: { report: ResearchReport; supplier: Parameters<typeof ShadowProfile>[0]["supplier"] }) {
  const sev = { high: 0, medium: 1, low: 2 } as const;
  const flags = [...report.redFlags].sort((a, b) => sev[a.severity] - sev[b.severity]);
  return (
    <div className="space-y-4 min-w-0">
      <div className="card p-4">
        <div className="flex items-baseline gap-3">
          <div className="label">Research report · {report.company}</div>
          <div className="ml-auto text-[12px] text-muted">Researched {fmtTime(report.researchedAt)}{report.cached ? " · cached" : ""}</div>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed">{report.summary}</p>
      </div>

      <div className="card p-4">
        <div className="label mb-2">Red flags ({flags.length})</div>
        {flags.length === 0 && <div className="text-muted text-[13px]">No red flags found in the collected sources.</div>}
        <ul className="space-y-2">
          {flags.map((f, i) => (
            <li key={i} className="text-[13px] grid grid-cols-[64px_1fr] gap-2">
              <span className={`self-start text-center text-[11px] uppercase px-1 ${f.severity === "high" ? "bg-[var(--risk-critical)] text-[var(--risk-critical-fg)]" : f.severity === "medium" ? "bg-[var(--risk-high)] text-[var(--risk-high-fg)]" : "bg-[var(--risk-low)]"}`}>{f.severity}</span>
              <div>
                <div className="font-medium">{f.title}{f.followedUp && <span className="text-muted font-normal text-[11px]"> · followed up</span>}</div>
                <div className="text-muted">{f.detail}</div>
                <div className="text-[12px]">{f.dimension && <span className="text-muted">{f.dimension} · </span>}<Ext href={f.url}>{host(f.url)}</Ext></div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="label mb-2">Verified facts</div>
          <ul className="space-y-1.5 text-[13px]">
            {report.facts.map((f, i) => <li key={i}>{f.text} <Ext href={f.url}>[{host(f.url)}]</Ext></li>)}
            {report.facts.length === 0 && <li className="text-muted">None.</li>}
          </ul>
        </div>
        <div className="card p-4">
          <div className="label mb-2">Unverified claims</div>
          <ul className="space-y-1.5 text-[13px] text-muted">
            {report.unverified.map((f, i) => <li key={i}>{f.text} {f.url && <Ext href={f.url}>[{host(f.url)}]</Ext>}</li>)}
            {report.unverified.length === 0 && <li>None flagged.</li>}
          </ul>
        </div>
      </div>

      <ShadowProfile report={report} supplier={supplier} />

      <details className="card p-4">
        <summary className="label cursor-pointer">All sources ({report.sources.length})</summary>
        <ol className="mt-2 space-y-1 text-[12px] list-decimal list-inside">
          {report.sources.map((s) => (
            <li key={s.url} className="truncate"><Ext href={s.url}>{s.title}</Ext> <span className="text-muted">· {host(s.url)}</span></li>
          ))}
        </ol>
      </details>
    </div>
  );
}
