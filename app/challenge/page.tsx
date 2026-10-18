"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDataset } from "@/lib/data-client";
import { PRESETS, adjustedSupplier, rank, type Weights } from "@/lib/engine";
import { runChecks } from "@/lib/challenge";
import { OFFICIAL_WEIGHTS, SCORES } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { Loading, PageHeader } from "@/components/Shell";
import { LevelTag } from "@/components/LevelTag";
import { Stamp } from "@/components/Stamp";
import { EvidenceHeadline } from "@/components/EvidenceAdjust";

export default function Challenge() {
  const ds = useDataset();
  const { evidence, shortlist, pickId, setPick, replaceId, presetId, setPreset, customWeights, setCustomWeights, challenge, setChallenge, log } = useStore();
  const [critique, setCritique] = useState<string | null>(challenge?.critique ?? null);
  const [busy, setBusy] = useState(false);
  // Critique belongs to one pick: clear it when the pick changes.
  useEffect(() => { setCritique(challenge?.pickId === pickId ? challenge?.critique ?? null : null); }, [pickId]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => (ds ? shortlist.map((id) => ds.byId.get(id)!).filter(Boolean) : []), [ds, shortlist]);
  const pick = ds && pickId ? ds.byId.get(pickId) : undefined;
  const replace = ds?.byId.get(replaceId);
  const result = useMemo(() => (pick && list.length ? runChecks(pick, replace, list) : null), [pick, replace, list]);
  // Evidence applied to this pick: re-run the checks on an adjusted copy (rest of the shortlist stays official).
  const ev = evidence && pick && evidence.supplierId === pick.id ? evidence : null;
  const evResult = useMemo(() => {
    if (!ev || !pick) return null;
    const adj = adjustedSupplier(pick, ev);
    return runChecks(adj, replace, list.map((s) => (s.id === pick.id ? adj : s)));
  }, [ev, pick, replace, list]);
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

      {ev && evResult && (() => {
        const leader = (r: typeof result) => {
          const counts = new Map<string, number>();
          r.rob.scenarios.forEach((x) => counts.set(x.leaderId, (counts.get(x.leaderId) ?? 0) + 1));
          return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        };
        const flips = evResult.checks.filter((c) => c.pass !== result.checks.find((o) => o.id === c.id)?.pass);
        const [newLeader, newWins] = leader(evResult);
        const changes = flips.length > 0 || newLeader !== leader(result)[0];
        return (
          <div className={`mb-5 border-2 px-4 py-3 ${changes ? "border-[var(--risk-critical)] bg-[color-mix(in_oklab,var(--risk-critical)_6%,var(--sheet))]" : "border-stamp bg-stamp-tint"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="display text-[18px]">{changes ? "Evidence changes the decision" : "Evidence applied — pick still holds"}</div>
              <div className="ml-auto"><EvidenceHeadline official={ev.officialTri} adjusted={ev.adjustedTri} size="sm" /></div>
            </div>
            <div className="text-[12.5px] text-muted mt-1">Assumption: {pick.id} is {ev.company} · evidence after {ev.asOf} only · {ev.rows.filter((r) => r.counted).length} dimensions moved · official TRI unchanged.</div>
            {flips.length > 0 && (
              <ul className="mt-2 text-[13px] space-y-0.5">
                {flips.map((c) => <li key={c.id}><span className={`num font-bold ${c.pass ? "text-[var(--pass)]" : "text-[var(--risk-critical)]"}`}>{c.pass ? "FAIL → PASS" : "PASS → FAIL"}</span> {c.label} — <span className="text-muted">{c.detail}</span></li>)}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
              <span>With evidence: #1 in <span className="num">{evResult.rob.wins}</span> of {evResult.rob.total} scenarios · {evResult.checks.filter((c) => c.pass).length}/{evResult.checks.length} checks pass.</span>
              {newLeader !== pick.id && (
                <button className="btn btn-primary ml-auto" onClick={() => { log("Challenge", `Pick changed ${pick.id} → ${newLeader} after evidence (${newWins}/${evResult.rob.total} scenarios)`); setPick(newLeader); }}>Switch pick to {newLeader}</button>
              )}
            </div>
          </div>
        );
      })()}

      <div className="grid gap-6 @min-[900px]:grid-cols-2 items-start">
        <section className="min-w-0">
          <div className="flex items-end gap-3 -mt-2">
            <h2 className="display text-[18px] mb-2">Checks</h2>
            <div className="ml-auto -mb-10 mr-1 relative z-10">
              <Stamp key={pick.id} word={passed === result.checks.length ? "HOLDS" : "CHALLENGED"} sub={`${result.checks.length - passed} OF ${result.checks.length} CHECKS FAIL`} fail={passed !== result.checks.length} size={118} rot={-9} />
            </div>
          </div>
          <div className="sheet divide-y divide-[var(--line)]">
            {result.checks.map((c, i) => (
              <div key={c.id} className={`px-3 py-2 flex gap-3 items-start ${i === 0 ? "pr-24" : ""} ${!c.pass ? "bg-[color-mix(in_oklab,var(--risk-critical)_6%,var(--sheet))]" : ""}`}>
                <span className={`num w-11 shrink-0 text-center text-[10.5px] font-bold py-0.5 mt-px rounded-[2px] ${c.pass ? "bg-[var(--risk-low)] text-[var(--risk-low-fg)]" : "bg-[var(--risk-critical)] text-[var(--risk-critical-fg)] hatch-critical"}`}>{c.pass ? "PASS" : "FAIL"}</span>
                <div className="min-w-0 pr-2"><div className="font-semibold">{c.label}</div><div className="text-muted text-[12px] leading-snug">{c.detail}</div></div>
              </div>
            ))}
          </div>

          {(() => {
            const counts = new Map<string, number>();
            result.rob.scenarios.forEach((s) => counts.set(s.leaderId, (counts.get(s.leaderId) ?? 0) + 1));
            const [best, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
            return best !== pick.id ? (
              <div className="mt-3 border-2 border-stamp bg-stamp-tint px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="font-semibold text-[14px]"><span className="num text-stamp">{best}</span> wins <span className="num">{n}</span> of {result.rob.total} priority scenarios.</div>
                <button className="btn btn-primary ml-auto" onClick={() => { log("Challenge", `Pick changed ${pick.id} → ${best} after challenge`); setPick(best); }}>Switch pick to {best}</button>
              </div>
            ) : null;
          })()}

          <h2 className="display text-[18px] mt-6 mb-2">Robustness across priorities</h2>
          <table className="tbl text-[12px] sheet">
            <thead><tr><th>Priority scenario</th><th>Rank of {pick.id}</th><th>Winner</th></tr></thead>
            <tbody>
              {result.rob.scenarios.map((s) => (
                <tr key={s.presetId}>
                  <td>{s.label}</td>
                  <td className={`num ${s.rank === 1 ? "text-[var(--pass)] font-semibold" : ""}`}>{s.rank === 1 ? "#1 ✓" : `#${s.rank} of ${s.of}`}</td>
                  <td className="num">{s.leaderId}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="display text-[18px] mt-6 mb-2">Devil&apos;s advocate (Nemotron)</h2>
          {critique ? <p className="sheet px-4 py-3 whitespace-pre-wrap leading-relaxed max-w-[72ch] border-l-0 shadow-[inset_0_2px_0_var(--risk-critical)]">{critique}</p> : <p className="text-muted mb-2">The AI reads only the computed checks above and argues against your pick.</p>}
          <button className="btn mt-2" onClick={askCritique} disabled={busy}>{busy ? "Thinking…" : critique ? "Regenerate critique" : "Argue against my pick"}</button>
        </section>

        <section className="min-w-0">
          <h2 className="display text-[18px] mb-2">Re-rank the shortlist by priority</h2>
          <div className="flex flex-wrap gap-1 mb-2" role="group" aria-label="Priority presets">
            {PRESETS.map((p) => {
              const on = !customWeights && presetId === p.id;
              return <button key={p.id} aria-pressed={on} className={`btn text-[12px] ${on ? "btn-primary" : "btn-quiet"}`} title={p.description} onClick={() => { setCustomWeights(null); setPreset(p.id); }}>{p.label}</button>;
            })}
          </div>
          <p className="text-muted text-[12px] mb-2 max-w-[72ch]">{customWeights ? "Custom weights (sliders below)." : PRESETS.find((p) => p.id === presetId)?.description} Re-weighting is our own lens — the official TRI is never changed.</p>
          <table className="tbl tbl-tight text-[12px] sheet">
            <thead><tr><th>Rank</th><th title="Change vs official TRI rank">vs TRI</th><th>Supplier</th><th className="r">Weighted</th><th>TRI</th></tr></thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.id} className={r.id === pick.id ? "is-current font-semibold" : ""}>
                  <td className="num">#{r.rank}</td>
                  <td className={`num ${r.delta > 0 ? "text-[var(--pass)]" : r.delta < 0 ? "text-[var(--risk-critical)]" : "text-muted"}`}>{r.delta > 0 ? `▲ ${r.delta}` : r.delta < 0 ? `▼ ${-r.delta}` : "="}</td>
                  <td className="whitespace-nowrap"><span className={`num ${r.id === pick.id ? "text-stamp" : ""}`}>{r.id === pick.id ? "★ " : ""}{r.id}</span> <span className="text-muted font-normal inline-block max-w-[104px] truncate align-bottom" title={r.name}>{r.name}</span></td>
                  <td className="num r">{r.score.toFixed(1)}</td>
                  <td><LevelTag score={r.tri} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="mt-4">
            <summary className="cursor-pointer font-semibold text-stamp">Custom weights</summary>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[12px]">
              {SCORES.map((d) => {
                const v = (customWeights ?? weights)[d.key] ?? 0;
                return (
                  <label key={d.key} className="flex items-center gap-2">
                    <span className="w-36 truncate">{d.label}</span>
                    <input type="range" min={0} max={0.3} step={0.01} value={v} onChange={(e) => setSlider(d.key, Number(e.target.value))} className="flex-1" />
                    <span className="num w-8 text-right">{v.toFixed(2)}</span>
                  </label>
                );
              })}
            </div>
            <button className="btn btn-quiet mt-2 text-[12px]" onClick={() => setCustomWeights(null)}>Reset to preset</button>
          </details>
        </section>
      </div>
    </div>
  );
}
