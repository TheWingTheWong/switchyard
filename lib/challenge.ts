// Deterministic challenge checks on the buyer's pick. Pure functions over engine results.
import { hiddenRisk, level, robustness, scoreOf, type EvidenceAdjustment, type Robustness } from "./engine";
import { SCORE_BY_KEY, type Supplier } from "./schema";

export interface Check { id: string; label: string; pass: boolean; detail: string; }

/** activeFlags: pass only when research evidence is applied to this pick — adds the evidence check. */
export function runChecks(pick: Supplier, replace: Supplier | undefined, list: Supplier[], activeFlags?: EvidenceAdjustment["activeHighFlags"]): { checks: Check[]; rob: Robustness } {
  const hr = hiddenRisk(pick);
  const rob = robustness(pick.id, list);
  const lowestTri = [...list].sort((a, b) => a.tri - b.tri)[0];
  const checks: Check[] = [
    {
      id: "hidden", label: "No hidden risk behind the average",
      pass: hr.criticalDims.length === 0,
      detail: hr.criticalDims.length
        ? `${hr.criticalDims.length} Critical sub-score${hr.criticalDims.length > 1 ? "s" : ""} (${hr.criticalDims.map((k) => `${SCORE_BY_KEY[k].label} ${scoreOf(pick, k)}`).join(", ")}) despite a ${level(pick.tri)} TRI of ${pick.tri}.${hr.flag ? " Averages lie: this is a hidden-risk supplier." : ""}`
        : "No sub-score at Critical (≥75).",
    },
    {
      id: "robust", label: "Pick survives other priorities",
      pass: rob.wins >= Math.ceil(rob.total / 2),
      detail: `Ranks #1 in ${rob.wins} of ${rob.total} priority scenarios.`,
    },
    {
      id: "better", label: "Clearly better than the supplier being replaced",
      pass: !!replace && replace.tri - pick.tri >= 20,
      detail: replace ? `TRI ${pick.tri} vs ${replace.tri} (${replace.tri - pick.tri} points lower).` : "No supplier to replace selected.",
    },
    {
      id: "delivery", label: "Delivery performance ≥ 90%",
      pass: pick.del >= 90 && pick.conf >= 90,
      detail: `Delivery rating ${pick.del.toFixed(1)}%, confirmation rate ${pick.conf.toFixed(1)}% (ops metrics, not part of TRI).`,
    },
    {
      id: "sourcing", label: "Not itself hard to replace",
      pass: pick.src !== "High",
      detail: `Sourcing risk level ${pick.src}; supply chain complexity ${pick.cx}.`,
    },
    {
      id: "lowest", label: "Lowest official TRI on the shortlist",
      pass: lowestTri?.id === pick.id,
      detail: lowestTri?.id === pick.id ? "Yes." : `${lowestTri?.id} has a lower TRI (${lowestTri?.tri}).`,
    },
    ...(activeFlags ? [{
      id: "redflag", label: "No active credible high-severity red flag",
      pass: activeFlags.length === 0,
      detail: activeFlags.length
        ? `${activeFlags.map((f) => `${f.title} (${f.domain}${f.eventDate ? `, ${f.eventDate}` : ""}, ${f.status})`).join("; ")}. Independent of the average: the TRI barely moves, this check doesn't.`
        : "No high-severity red flag that is verified, credible, after the as-of date and still active.",
    }] : []),
  ];
  return { checks, rob };
}
