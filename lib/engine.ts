// All math lives here. Shared by client (UI) and server (chat tools, research, memo).
// The LLM never computes numbers — it calls these functions and explains the results.
import {
  SCORES, SCORE_KEYS, OFFICIAL_WEIGHTS, LEVEL_RANGES,
  type Level, type ScoreKey, type Supplier,
} from "./schema";

export function level(score: number): Level {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

export const scoreOf = (s: Supplier, key: ScoreKey) => s.s[SCORE_KEYS.indexOf(key)];

export function scoresRecord(s: Supplier): Record<ScoreKey, number> {
  return Object.fromEntries(SCORE_KEYS.map((k, i) => [k, s.s[i]])) as Record<ScoreKey, number>;
}

// ---------- Dataset index ----------
export interface Dataset {
  all: Supplier[];
  byId: Map<string, Supplier>;
  sorted: Record<string, Float64Array>; // per score key: sorted values, for percentiles
}

export function indexDataset(all: Supplier[]): Dataset {
  const byId = new Map(all.map((s) => [s.id, s]));
  const sorted: Record<string, Float64Array> = {};
  SCORE_KEYS.forEach((k, i) => {
    sorted[k] = Float64Array.from(all.map((s) => s.s[i])).sort();
  });
  sorted.tri = Float64Array.from(all.map((s) => s.tri)).sort();
  return { all, byId, sorted };
}

/** Normalise loose ids: "12", "supp_12", "SUPP_00012" → "SUPP_00012" */
export function normId(id: string): string {
  const m = String(id).match(/(\d+)/);
  return m ? `SUPP_${m[1].padStart(5, "0")}` : String(id).toUpperCase();
}

// ---------- Explain (TRI waterfall) ----------
export interface Contribution {
  key: ScoreKey; label: string; score: number; level: Level;
  weight: number; contribution: number; share: number;
}
export interface Explanation {
  id: string; name: string; tri: number; triLevel: Level;
  computed: number; residual: number;
  contributions: Contribution[]; // sorted desc
  criticalDims: ScoreKey[];
}

export function explainScore(s: Supplier): Explanation {
  const contributions = SCORES.map((d, i) => {
    const score = s.s[i];
    const contribution = score * d.weight;
    return { key: d.key, label: d.label, score, level: level(score), weight: d.weight, contribution, share: 0 };
  });
  const computed = contributions.reduce((a, c) => a + c.contribution, 0);
  contributions.forEach((c) => (c.share = computed ? c.contribution / computed : 0));
  contributions.sort((a, b) => b.contribution - a.contribution);
  return {
    id: s.id, name: s.name, tri: s.tri, triLevel: level(s.tri),
    computed: round(computed, 2), residual: round(s.tri - computed, 2),
    contributions,
    criticalDims: contributions.filter((c) => c.level === "Critical").map((c) => c.key),
  };
}

// ---------- Hidden risk ("averages lie") ----------
export function hiddenRisk(s: Supplier): { flag: boolean; criticalDims: ScoreKey[] } {
  const criticalDims = SCORE_KEYS.filter((_, i) => s.s[i] >= 75);
  const triLvl = level(s.tri);
  return { flag: (triLvl === "Low" || triLvl === "Medium") && criticalDims.length >= 2, criticalDims };
}

// ---------- Exposure ----------
export const exposure = (s: Supplier) => (s.tri / 100) * s.po;

// ---------- Percentile ----------
export function peerPercentile(ds: Dataset, value: number, key: ScoreKey | "tri"): number {
  const arr = ds.sorted[key];
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < value) lo = mid + 1; else hi = mid; }
  return Math.round((lo / arr.length) * 100); // % of suppliers with lower risk
}

// ---------- Filtering ----------
export type NumField = ScoreKey | "tri" | "po" | "chg" | "del" | "conf" | "exposure";
export interface FilterCriteria {
  ranges?: Partial<Record<NumField, [number | null, number | null]>>; // inclusive min/max
  levels?: Partial<Record<ScoreKey | "tri", Level[]>>;
  sourcing?: string[];
  complexity?: string[];
  hiddenRiskOnly?: boolean;
  nameQuery?: string;
  excludeIds?: string[];
}

export function fieldValue(s: Supplier, f: NumField): number {
  switch (f) {
    case "tri": return s.tri;
    case "po": return s.po;
    case "chg": return s.chg;
    case "del": return s.del;
    case "conf": return s.conf;
    case "exposure": return exposure(s);
    default: return scoreOf(s, f);
  }
}

export function filterSuppliers(all: Supplier[], c: FilterCriteria): Supplier[] {
  const ranges = Object.entries(c.ranges ?? {}).filter(([, r]) => r && (r[0] != null || r[1] != null)) as [NumField, [number | null, number | null]][];
  const levels = Object.entries(c.levels ?? {}).filter(([, l]) => l && l.length) as [ScoreKey | "tri", Level[]][];
  const q = c.nameQuery?.trim().toLowerCase();
  const excl = new Set(c.excludeIds ?? []);
  return all.filter((s) => {
    if (excl.has(s.id)) return false;
    for (const [f, [min, max]] of ranges) {
      const v = fieldValue(s, f);
      if (min != null && v < min) return false;
      if (max != null && v > max) return false;
    }
    for (const [f, lv] of levels) {
      const v = f === "tri" ? s.tri : scoreOf(s, f);
      if (!lv.includes(level(v))) return false;
    }
    if (c.sourcing?.length && !c.sourcing.includes(s.src)) return false;
    if (c.complexity?.length && !c.complexity.includes(s.cx)) return false;
    if (c.hiddenRiskOnly && !hiddenRisk(s).flag) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
    return true;
  });
}

// ---------- Weighting / ranking ----------
export type Weights = Partial<Record<ScoreKey, number>> & { opsDelivery?: number; opsConfirmation?: number };

export interface Preset { id: string; label: string; description: string; weights: Weights; }

function boosted(keys: ScoreKey[], factor = 3, extra: Weights = {}): Weights {
  const w: Weights = { ...OFFICIAL_WEIGHTS };
  keys.forEach((k) => (w[k] = (w[k] ?? 0) * factor));
  return { ...w, ...extra };
}

export const PRESETS: Preset[] = [
  { id: "official", label: "Official TRI", description: "The dataset's own Total Risk Index weights.", weights: { ...OFFICIAL_WEIGHTS } },
  { id: "financial", label: "Financial stability", description: "Financial Health, Credit Rating, Governance ×3.", weights: boosted(["financial", "credit", "governance"]) },
  { id: "delivery", label: "Delivery reliability", description: "Operational, Sub-Tier, Quality ×3 + delivery & confirmation rates (ops metrics, not in TRI).", weights: boosted(["operational", "subTier", "quality"], 3, { opsDelivery: 0.1, opsConfirmation: 0.1 }) },
  { id: "compliance", label: "Compliance & ESG", description: "Compliance, ESG, Governance, Safety ×3.", weights: boosted(["compliance", "esg", "governance", "safety"]) },
  { id: "geopolitical", label: "Geopolitical resilience", description: "Geopolitical, Political Stability, Environmental Exposure ×3.", weights: boosted(["geopolitical", "political", "environmental"]) },
];

/** Weighted risk score 0–100 (weights normalised to sum 1). Ops metrics converted to risk: 100 − rate. */
export function weightedScore(s: Supplier, w: Weights): number {
  let sum = 0, tot = 0;
  SCORE_KEYS.forEach((k, i) => { const wi = w[k] ?? 0; sum += wi * s.s[i]; tot += wi; });
  if (w.opsDelivery) { sum += w.opsDelivery * (100 - s.del); tot += w.opsDelivery; }
  if (w.opsConfirmation) { sum += w.opsConfirmation * (100 - s.conf); tot += w.opsConfirmation; }
  return tot ? sum / tot : 0;
}

export interface Ranked { id: string; name: string; score: number; rank: number; officialRank: number; delta: number; tri: number; }

/** Rank ascending by risk (rank 1 = lowest risk). delta > 0 means moved up vs official TRI. */
export function rank(list: Supplier[], w: Weights = OFFICIAL_WEIGHTS): Ranked[] {
  const official = [...list].sort((a, b) => a.tri - b.tri || weightedScore(a, OFFICIAL_WEIGHTS) - weightedScore(b, OFFICIAL_WEIGHTS));
  const offRank = new Map(official.map((s, i) => [s.id, i + 1]));
  return list
    .map((s) => ({ s, score: weightedScore(s, w) }))
    .sort((a, b) => a.score - b.score)
    .map(({ s, score }, i) => {
      const o = offRank.get(s.id)!;
      return { id: s.id, name: s.name, score: round(score, 1), rank: i + 1, officialRank: o, delta: o - (i + 1), tri: s.tri };
    });
}

export function sortBy(list: Supplier[], f: NumField, dir: "asc" | "desc" = "asc"): Supplier[] {
  const m = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => m * (fieldValue(a, f) - fieldValue(b, f)));
}

// ---------- Compare ----------
export interface DimStat { key: ScoreKey; label: string; min: number; max: number; spread: number; bestId: string; worstId: string; values: number[]; }
export interface Comparison { ids: string[]; names: string[]; tri: number[]; dims: DimStat[]; topVariance: DimStat[]; }

export function compare(list: Supplier[]): Comparison {
  const dims = SCORES.map((d, i) => {
    const values = list.map((s) => s.s[i]);
    let bi = 0, wi = 0;
    values.forEach((v, j) => { if (v < values[bi]) bi = j; if (v > values[wi]) wi = j; });
    const min = values[bi], max = values[wi];
    return { key: d.key, label: d.label, min, max, spread: max - min, bestId: list[bi]?.id, worstId: list[wi]?.id, values };
  });
  return {
    ids: list.map((s) => s.id), names: list.map((s) => s.name), tri: list.map((s) => s.tri),
    dims, topVariance: [...dims].sort((a, b) => b.spread - a.spread).slice(0, 3),
  };
}

// ---------- Robustness ----------
export interface Robustness { pickId: string; scenarios: { presetId: string; label: string; rank: number; of: number; leaderId: string }[]; wins: number; total: number; }

export function robustness(pickId: string, list: Supplier[], presets: Preset[] = PRESETS): Robustness {
  const scenarios = presets.map((p) => {
    const r = rank(list, p.weights);
    return { presetId: p.id, label: p.label, rank: r.find((x) => x.id === pickId)?.rank ?? -1, of: r.length, leaderId: r[0]?.id };
  });
  return { pickId, scenarios, wins: scenarios.filter((s) => s.rank === 1).length, total: scenarios.length };
}

// ---------- Portfolio ----------
export interface Portfolio {
  count: number; totalSpend: number; totalExposure: number; criticalSpend: number; criticalCount: number;
  hiddenRiskCount: number; levelCounts: Record<Level, number>;
}
export function portfolio(all: Supplier[]): Portfolio {
  const levelCounts: Record<Level, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  let totalSpend = 0, totalExposure = 0, criticalSpend = 0, criticalCount = 0, hiddenRiskCount = 0;
  for (const s of all) {
    const l = level(s.tri);
    levelCounts[l]++;
    totalSpend += s.po; totalExposure += exposure(s);
    if (l === "Critical") { criticalSpend += s.po; criticalCount++; }
    if (hiddenRisk(s).flag) hiddenRiskCount++;
  }
  return { count: all.length, totalSpend, totalExposure, criticalSpend, criticalCount, hiddenRiskCount, levelCounts };
}

export const topExposure = (all: Supplier[], n = 10) => [...all].sort((a, b) => exposure(b) - exposure(a)).slice(0, n);

// ---------- Utils ----------
export function round(v: number, d = 0) { const p = 10 ** d; return Math.round(v * p) / p; }
export const fmtEur = (v: number) =>
  v >= 1e9 ? `€${(v / 1e9).toFixed(1)}bn` : v >= 1e6 ? `€${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `€${(v / 1e3).toFixed(0)}k` : `€${v.toFixed(0)}`;
export { LEVEL_RANGES };

/** TRI-equivalent over a partial profile (e.g. research shadow profile): official weights renormalised over dims that have a score. */
export function partialTri(scores: Partial<Record<ScoreKey, number | null>>): { value: number | null; coverage: number } {
  let sum = 0, tot = 0;
  for (const d of SCORES) {
    const v = scores[d.key];
    if (v != null) { sum += v * d.weight; tot += d.weight; }
  }
  return { value: tot ? round(sum / tot, 0) : null, coverage: round(tot, 2) };
}
