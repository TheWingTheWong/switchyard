"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDataset } from "@/lib/data-client";
import { explainScore, exposure, fmtEur, hiddenRisk, level } from "@/lib/engine";
import { runChecks } from "@/lib/challenge";
import { SCORE_BY_KEY } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { Loading, PageHeader } from "@/components/Shell";
import { LevelTag } from "@/components/LevelTag";
import { Waterfall } from "@/components/Waterfall";

const OPEN_CHECKS = [
  "Technical capability for the specific component (not in dataset)",
  "Capacity and lead time for the required volume (not in dataset)",
  "Commercial offer and unit price (not in dataset)",
  "Country / plant location and logistics route (not in dataset)",
  "Rail certifications (e.g. IRIS / ISO/TS 22163, EN 15085) and first-article inspection",
];

export default function Decide() {
  const ds = useDataset();
  const { replaceId, shortlist, pickId, research, challenge, memo, setMemo, audit, log, reset } = useStore();
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => (ds ? shortlist.map((id) => ds.byId.get(id)!).filter(Boolean).sort((a, b) => a.tri - b.tri) : []), [ds, shortlist]);
  if (!ds) return <Loading />;
  const replace = ds.byId.get(replaceId);
  const pick = pickId ? ds.byId.get(pickId) : undefined;
  if (!pick || !replace) {
    return (
      <div>
        <PageHeader step="Step 6 · Decide" title="No pick yet" sub="Shortlist and pick a candidate first." />
        <Link className="btn btn-primary" href="/compare">← Compare</Link>
      </div>
    );
  }
  const { checks, rob } = runChecks(pick, replace, list);
  const ePick = explainScore(pick);
  const eRep = explainScore(replace);
  const hr = hiddenRisk(pick);
  const today = new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  async function generate() {
    setBusy(true);
    const facts = {
      replacing: { id: replace!.id, name: replace!.name, tri: replace!.tri, poVolumeEUR: replace!.po, topDrivers: eRep.contributions.slice(0, 3).map((c) => `${c.label} ${c.score}`) },
      pick: { id: pick!.id, name: pick!.name, tri: pick!.tri, level: level(pick!.tri), deliveryRating: pick!.del, topDrivers: ePick.contributions.slice(0, 3).map((c) => `${c.label} ${c.score}`), criticalDims: hr.criticalDims.map((k) => SCORE_BY_KEY[k].label) },
      shortlistSize: list.length,
      checks: checks.map((c) => ({ check: c.label, pass: c.pass, detail: c.detail })),
      robustness: `#1 in ${rob.wins} of ${rob.total} priority scenarios`,
      externalResearch: research ? { company: research.company, summary: research.summary, redFlags: research.redFlags.map((f) => `${f.severity}: ${f.title}`), shadowTri: research.shadowTri } : null,
    };
    const r = await fetch("/api/memo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(facts) }).then((r) => r.json()).catch(() => ({ text: null }));
    setMemo(r.text ?? "AI summary unavailable — all sections below are computed directly from the data.");
    log("Decide", "Decision memo generated");
    setBusy(false);
  }

  return (
    <div className="max-w-[960px]">
      <div className="no-print">
        <PageHeader step="Step 6 · Decide" title="Decision memo" sub="Every number below is computed from the dataset; the AI only writes the summary.">
          <button className="btn" onClick={generate} disabled={busy}>{busy ? "Writing…" : memo ? "Regenerate summary" : "Generate memo"}</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print / PDF</button>
        </PageHeader>
      </div>

      <article className="card p-6 space-y-6">
        <header>
          <div className="label">SWITCHYARD decision memo · {today}</div>
          <h1 className="text-xl font-semibold mt-1">Candidate for qualification: <span className="num">{pick.id}</span> {pick.name}</h1>
          <p className="text-muted">to replace <span className="num">{replace.id}</span> {replace.name}</p>
        </header>

        <section>
          <h2 className="label mb-1">Executive summary</h2>
          {memo ? <p className="whitespace-pre-wrap">{memo}</p> : <p className="text-muted">Click “Generate memo” for the AI-written summary (Nemotron, facts-only).</p>}
        </section>

        <section>
          <h2 className="label mb-1">1. Why act</h2>
          <p><span className="num">{replace.id}</span> has a TRI of <span className="num">{replace.tri}</span> (<LevelTag lvl={level(replace.tri)} showScore={false} />) on <span className="num">{fmtEur(replace.po)}</span> of purchase orders — risk-weighted exposure <span className="num">{fmtEur(exposure(replace))}</span>. Largest drivers: {eRep.contributions.slice(0, 3).map((c) => `${c.label} ${c.score} (+${c.contribution.toFixed(1)} pts)`).join(", ")}.</p>
        </section>

        <section>
          <h2 className="label mb-1">2. Shortlist ({list.length} of 10,000)</h2>
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-fg text-left"><th className="py-1 font-medium">Supplier</th><th className="font-medium">TRI</th><th className="font-medium">Critical dims</th><th className="font-medium text-right">Delivery</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={`border-b border-line ${s.id === pick.id ? "font-semibold" : ""}`}>
                  <td className="py-0.5"><span className="num">{s.id === pick.id ? "★ " : ""}{s.id}</span> <span className="text-muted">{s.name}</span></td>
                  <td><LevelTag score={s.tri} /></td><td className="num">{hiddenRisk(s).criticalDims.length}</td><td className="num text-right">{s.del.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="label mb-1">3. The pick, explained</h2>
          <Waterfall e={ePick} top={8} />
        </section>

        <section>
          <h2 className="label mb-1">4. Challenges ({checks.filter((c) => c.pass).length}/{checks.length} passed · #1 in {rob.wins}/{rob.total} priority scenarios)</h2>
          <ul className="space-y-0.5">
            {checks.map((c) => <li key={c.id}><span className="num font-semibold">{c.pass ? "PASS" : "FAIL"}</span> {c.label} — <span className="text-muted">{c.detail}</span></li>)}
          </ul>
          {challenge?.critique && <p className="mt-2 border-l-2 border-fg pl-3"><span className="label">Devil&apos;s advocate:</span> {challenge.critique}</p>}
        </section>

        <section>
          <h2 className="label mb-1">5. External evidence</h2>
          {research ? (
            <div>
              <p><span className="font-medium">{research.company}</span> researched {new Date(research.researchedAt).toLocaleString("en-GB")}{research.cached ? " (cached run)" : ""}. Shadow TRI <span className="num">{research.shadowTri ?? "n/a"}</span>.</p>
              <p className="text-muted">{research.summary}</p>
              <ul className="mt-1 text-[12px]">
                {research.redFlags.map((f, i) => <li key={i}>[{f.severity}] {f.title} — <a className="underline break-all" href={f.url} target="_blank" rel="noreferrer">{f.url}</a></li>)}
              </ul>
            </div>
          ) : <p className="text-muted">No external research attached. <Link className="underline no-print" href="/verify">Run Verify</Link>.</p>}
        </section>

        <section>
          <h2 className="label mb-1">6. Open qualification checks</h2>
          <ul className="list-disc pl-5">{OPEN_CHECKS.map((c) => <li key={c}>{c}</li>)}
            {hr.criticalDims.map((k) => <li key={k}>Mitigation plan for Critical {SCORE_BY_KEY[k].label}</li>)}
          </ul>
        </section>

        <section>
          <h2 className="label mb-1">7. Audit log</h2>
          <ol className="text-[11px] text-muted space-y-0.5">
            {audit.slice(-25).map((a, i) => <li key={i}><span className="num">{new Date(a.at).toLocaleTimeString("en-GB")}</span> · {a.step} · {a.text}</li>)}
          </ol>
        </section>
      </article>
      <button className="no-print text-muted underline text-[12px] mt-4" onClick={() => { if (confirm("Start a new decision?")) reset(); }}>Start a new decision</button>
    </div>
  );
}
