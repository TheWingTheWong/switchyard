"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useDataset } from "@/lib/data-client";
import { adjustedSupplier } from "@/lib/engine";
import { runChecks } from "@/lib/challenge";
import { useStore } from "@/lib/store";
import { EvidenceHeadline } from "@/components/EvidenceAdjust";

/** What applied evidence does to the current pick: re-runs the Challenge checks on an evidence-adjusted copy
 *  (rest of the shortlist stays official). Rendered on Challenge and, with `links`, right under Apply evidence on Verify. */
export function EvidenceVerdict({ links = false }: { links?: boolean }) {
  const ds = useDataset();
  const { evidence, shortlist, pickId, setPick, replaceId, log } = useStore();
  const list = useMemo(() => (ds ? shortlist.map((id) => ds.byId.get(id)!).filter(Boolean) : []), [ds, shortlist]);
  const pick = ds && pickId ? ds.byId.get(pickId) : undefined;
  const replace = ds?.byId.get(replaceId);
  const result = useMemo(() => (pick && list.length ? runChecks(pick, replace, list) : null), [pick, replace, list]);
  const ev = evidence && pick && evidence.supplierId === pick.id ? evidence : null;
  const evResult = useMemo(() => {
    if (!ev || !pick) return null;
    const adj = adjustedSupplier(pick, ev);
    return runChecks(adj, replace, list.map((s) => (s.id === pick.id ? adj : s)), ev.activeHighFlags ?? []);
  }, [ev, pick, replace, list]);
  if (!ev || !pick || !result || !evResult) return null;

  const leader = (r: typeof result) => {
    const counts = new Map<string, number>();
    r.rob.scenarios.forEach((x) => counts.set(x.leaderId, (counts.get(x.leaderId) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  };
  // A check that only exists with evidence (the red-flag check) counts as a flip when it fails.
  const flips = evResult.checks.filter((c) => c.pass !== (result.checks.find((o) => o.id === c.id)?.pass ?? true));
  // On Verify, also list the checks that already failed without evidence, so the full picture is on one page.
  const stillFailing = links ? evResult.checks.filter((c) => !c.pass && !flips.includes(c)) : [];
  const [newLeader, newWins] = leader(evResult);
  const changes = flips.length > 0 || newLeader !== leader(result)[0];
  return (
    <div className={`mb-5 border-2 px-4 py-3 ${changes ? "border-[var(--risk-critical)] bg-[color-mix(in_oklab,var(--risk-critical)_6%,var(--sheet))]" : "border-stamp bg-stamp-tint"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="display text-[18px]">{changes ? "Evidence changes the decision" : "Evidence applied — pick still holds"}</div>
        <div className="ml-auto"><EvidenceHeadline official={ev.officialTri} adjusted={ev.adjustedTri} size="sm" /></div>
      </div>
      <div className="text-[12.5px] text-muted mt-1">Assumption: {pick.id} is {ev.company} · evidence after {ev.asOf} only · {ev.rows.filter((r) => r.counted).length} dimensions moved · official TRI unchanged. The average barely moves; the red-flag check doesn&apos;t.</div>
      {flips.length > 0 && (
        <ul className="mt-2 text-[13px] space-y-0.5">
          {flips.map((c) => <li key={c.id}><span className={`num font-bold ${c.pass ? "text-[var(--pass)]" : "text-[var(--risk-critical)]"}`}>{c.pass ? "FAIL → PASS" : "PASS → FAIL"}</span> {c.label} — <span className="text-muted">{c.detail}</span></li>)}
        </ul>
      )}
      {stillFailing.length > 0 && (
        <ul className="mt-1 text-[12.5px] space-y-0.5">
          {stillFailing.map((c) => <li key={c.id}><span className="num font-bold text-[var(--risk-critical)]">FAIL</span> {c.label} — <span className="text-muted">{c.detail}</span></li>)}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
        <span>With evidence: #1 in <span className="num">{evResult.rob.wins}</span> of {evResult.rob.total} scenarios · {evResult.checks.filter((c) => c.pass).length}/{evResult.checks.length} checks pass.</span>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          {links && <Link href="/challenge" className="linkish">See full challenge →</Link>}
          {links && <Link href="/decide" className="btn">Continue to Decide →</Link>}
          {newLeader !== pick.id && (
            <button className="btn btn-primary" onClick={() => { log("Challenge", `Pick changed ${pick.id} → ${newLeader} after evidence (${newWins}/${evResult.rob.total} scenarios)`); setPick(newLeader); }}>Switch pick to {newLeader}</button>
          )}
        </span>
      </div>
    </div>
  );
}
