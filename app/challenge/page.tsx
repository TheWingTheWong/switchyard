"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDataset } from "@/lib/data-client";
import { PRESETS, rank, type Weights } from "@/lib/engine";
import { runChecks } from "@/lib/challenge";
import { OFFICIAL_WEIGHTS, SCORES } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { Loading, PageHeader } from "@/components/Shell";
import { LevelTag } from "@/components/LevelTag";

export default function Challenge() {
  const ds = useDataset();
  const { shortlist, pickId, setPick, replaceId, presetId, setPreset, customWeights, setCustomWeights, challenge, setChallenge, log } = useStore();
  const [critique, setCritique] = useState<string | null>(challenge?.critique ?? null);
  const [busy, setBusy] = useState(false);
  // Critique belongs to one pick: clear it when the pick changes.
  useEffect(() => { setCritique(challenge?.pickId === pickId ? challenge?.critique ?? null : null); }, [pickId]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => (ds ? shortlist.map((id) => ds.byId.get(id)!).filter(Boolean) : []), [ds, shortlist]);
  const pick = ds && pickId ? ds.byId.get(pickId) : undefined;
  const replace = ds?.byId.get(replaceId);
  const result = useMemo(() => (pick && list.length ? runChecks(pick, replace, list) : null), [pick, replace, list]);
  const weights: Weights = customWeights ?? PRESETS.find((p) => p.id === presetId)?.weights ?? OFFICIAL_WEIGHTS;
  const ranked = useMemo(() => (list.length ? rank(list, weights) : []), [list, weights]);

  useEffect(() => {
    if (!pick || !result) return;
    if (challenge?.pickId === pick.id) return;
    const hc = result.checks.find((c) => c.id === "hidden")!;
    setChallenge({ pickId: pick.id, hidden: { flag: !hc.pass, criticalDims: [] }, wins: result.rob.wins, total: result.rob.total });
    log("Challenge", `${pick.id}: ${result.checks.filter((c) => c.pass).length}/${result.checks.length} checks passed; #1 in ${result.rob.wins}/${result.rob.total} scenarios`);
  }, [pick, result, challenge, setChallenge, log]);

  if (!ds) return <Loading />;
  if (!pick || !result) {
    return (
      <div>
        <PageHeader step="Step 4 · Challenge" title="Pick a supplier first" sub="Choose your preferred candidate in Compare, then SWITCHYARD will try to talk you out of it." />
        <Link className="btn btn-primary" href="/compare">← Compare</Link>
      </div>
    );
  }

  async function askCritique() {
    if (!pick || !result) return;
    setBusy(true);
    const facts = {
      pick: { id: pick.id, name: pick.name, tri: pick.tri, deliveryRating: pick.del, confirmationRate: pick.conf, sourcingRisk: pick.src },
      replacing: replace ? { id: replace.id, tri: replace.tri } : null,
      checks: result.checks.map((c) => ({ check: c.label, pass: c.pass, detail: c.detail })),
      scenarios: result.rob.scenarios.map((s) => `${s.label}: pick ranks #${s.rank} of ${s.of}${s.rank === 1 ? " (winner)" : `, winner is ${s.leaderId}`}`),
      robustness: `Pick is #1 in ${result.rob.wins} of ${result.rob.total} priority scenarios`,
    };
    const r = await fetch("/api/critique", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(facts) }).then((r) => r.json()).catch(() => ({ text: null }));
    const text = r.text ?? "AI critique unavailable — the computed checks above stand on their own.";
    setCritique(text);
    if (challenge) setChallenge({ ...challenge, critique: text });
    setBusy(false);
  }

  const passed = result.checks.filter((c) => c.pass).length;
  const setSlider = (k: string, v: number) => setCustomWeights({ ...(customWeights ?? weights), [k]: v });

  return (
    <div>
      <PageHeader step="Step 4 · Challenge" title={`Challenge my decision: ${pick.id}`}
        sub={<>{pick.name} · TRI <span className="num">{pick.tri}</span> · {passed} of {result.checks.length} checks passed · #1 in <span className="num">{result.rob.wins}</span> of {result.rob.total} priority scenarios.</>}>
        <Link href="/verify" className="btn btn-primary">Verify a real company →</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 className="font-semibold mb-2">Checks</h2>
          <div className="space-y-1">
            {result.checks.map((c) => (
              <div key={c.id} className={`card p-2 flex gap-3 ${!c.pass ? "border-fg" : ""}`}>
                <span className={`num w-12 shrink-0 text-center text-[11px] py-0.5 ${c.pass ? "bg-[var(--risk-low)]" : "bg-[var(--risk-critical)] text-[var(--risk-critical-fg)]"}`}>{c.pass ? "PASS" : "FAIL"}</span>
                <div><div className="font-medium">{c.label}</div><div className="text-muted text-[12px]">{c.detail}</div></div>
              </div>
            ))}
          </div>

          {(() => {
            const counts = new Map<string, number>();
            result.rob.scenarios.forEach((s) => counts.set(s.leaderId, (counts.get(s.leaderId) ?? 0) + 1));
            const [best, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
            return best !== pick.id ? (
              <div className="card border-fg p-3 mt-3">
                <div className="font-medium"><span className="num">{best}</span> wins {n} of {result.rob.total} priority scenarios.</div>
                <button className="btn btn-primary mt-2" onClick={() => { log("Challenge", `Pick changed ${pick.id} → ${best} after challenge`); setPick(best); }}>Switch pick to {best}</button>
              </div>
            ) : null;
          })()}

          <h2 className="font-semibold mt-5 mb-2">Robustness across priorities</h2>
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-fg text-left"><th className="py-1 font-medium">Priority scenario</th><th className="font-medium">Rank of {pick.id}</th><th className="font-medium">Winner</th></tr></thead>
            <tbody>
              {result.rob.scenarios.map((s) => (
                <tr key={s.presetId} className="border-b border-line">
                  <td className="py-1">{s.label}</td>
                  <td className="num">{s.rank === 1 ? "#1 ✓" : `#${s.rank} of ${s.of}`}</td>
                  <td className="num">{s.leaderId}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="font-semibold mt-5 mb-2">Devil&apos;s advocate (Nemotron)</h2>
          {critique ? <p className="card p-3 whitespace-pre-wrap">{critique}</p> : <p className="text-muted mb-2">The AI reads only the computed checks above and argues against your pick.</p>}
          <button className="btn mt-2" onClick={askCritique} disabled={busy}>{busy ? "Thinking…" : critique ? "Regenerate critique" : "Argue against my pick"}</button>
        </section>

        <section>
          <h2 className="font-semibold mb-2">Re-rank the shortlist by priority</h2>
          <div className="flex flex-wrap gap-1 mb-2">
            {PRESETS.map((p) => (
              <button key={p.id} className={`btn text-[12px] ${!customWeights && presetId === p.id ? "btn-primary" : ""}`} title={p.description} onClick={() => { setCustomWeights(null); setPreset(p.id); }}>{p.label}</button>
            ))}
          </div>
          <p className="text-muted text-[12px] mb-2">{customWeights ? "Custom weights (sliders below)." : PRESETS.find((p) => p.id === presetId)?.description} Re-weighting is our own lens — the official TRI is never changed.</p>
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-fg text-left"><th className="py-1 font-medium">Rank</th><th className="font-medium">vs TRI rank</th><th className="font-medium">Supplier</th><th className="font-medium text-right">Weighted risk</th><th className="font-medium">TRI</th></tr></thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.id} className={`border-b border-line ${r.id === pick.id ? "font-semibold bg-surface" : ""}`}>
                  <td className="py-1 num">#{r.rank}</td>
                  <td className="num">{r.delta > 0 ? `▲ ${r.delta}` : r.delta < 0 ? `▼ ${-r.delta}` : "="}</td>
                  <td><span className="num">{r.id === pick.id ? "★ " : ""}{r.id}</span> <span className="text-muted">{r.name}</span></td>
                  <td className="num text-right">{r.score.toFixed(1)}</td>
                  <td><LevelTag score={r.tri} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="mt-4">
            <summary className="cursor-pointer font-medium">Custom weights</summary>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[12px]">
              {SCORES.map((d) => {
                const v = (customWeights ?? weights)[d.key] ?? 0;
                return (
                  <label key={d.key} className="flex items-center gap-2">
                    <span className="w-36 truncate">{d.label}</span>
                    <input type="range" min={0} max={0.3} step={0.01} value={v} onChange={(e) => setSlider(d.key, Number(e.target.value))} className="flex-1 accent-black" />
                    <span className="num w-8 text-right">{v.toFixed(2)}</span>
                  </label>
                );
              })}
            </div>
            <button className="btn mt-2 text-[12px]" onClick={() => setCustomWeights(null)}>Reset to preset</button>
          </details>
        </section>
      </div>
    </div>
  );
}
