// All math lives here. Shared by client (UI) and server (chat tools, research, memo).
// The LLM never computes numbers — it calls these functions and explains the results.
import { TIER_FACTOR, hostOf, sourceTier, type SourceTier } from "./sources";
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

// ---------- Evidence-adjusted risk ----------
// Moves internal sub-scores toward the web "shadow" scores, but only by evidence that is
// (a) newer than the data as-of date (older evidence is likely already in the internal scores),
// (b) recent, (c) still live, and (d) proportional to the analyst's confidence.
// The official TRI is never modified; this produces a separate, labelled second number.

export type EvidenceStatus = "ongoing" | "resolved" | "unknown";
export type EvidenceConfidence = "low" | "medium" | "high";

export interface EvidenceInput {
  key: ScoreKey;
  score: number | null;
  confidence: EvidenceConfidence | null;
  eventDate?: string | null;
  status?: EvidenceStatus;
  url: string | null;
  rationale?: string;
  /** Other verified URLs supporting the same dimension (e.g. red flags on it) — for corroboration. */
  supportUrls?: string[];
  /** True when the evidence rests only on claims the report lists as unverified. */
  unverified?: boolean;
}

export interface EvidenceRow {
  key: ScoreKey; label: string; weight: number;
  internal: number; shadow: number | null;
  confidence: EvidenceConfidence | null; eventDate: string | null; status: EvidenceStatus;
  trust: number; recency: number; statusFactor: number; sourceTier: SourceTier; tierFactor: number; sourceDomains: string[]; factor: number;
  adjusted: number; delta: number;
  counted: boolean; reason: string; url: string | null;
}

export interface EvidenceAdjustment {
  supplierId: string; asOf: string;
  rows: EvidenceRow[];
  officialTri: number; adjustedTri: number; deltaTri: number;
}

export const EVIDENCE_TRUST: Record<EvidenceConfidence, number> = { high: 0.5, medium: 0.3, low: 0.15 };
export const EVIDENCE_STATUS: Record<EvidenceStatus, number> = { ongoing: 1, resolved: 0.5, unknown: 0.75 };
export const UNKNOWN_DATE_RECENCY = 0.25;

/** "YYYY-MM" → first of that month; "YYYY" → 1 July (mid-year). null if unparseable. */
export function parseEventDate(d: string | null | undefined): Date | null {
  const m = String(d ?? "").match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return null;
  const y = Number(m[1]), mo = m[2] ? Number(m[2]) - 1 : 6;
  if (y < 1900 || mo < 0 || mo > 11) return null;
  return new Date(Date.UTC(y, mo, 1));
}

/** Last day of the stated period ("2025" → 31 Dec 2025, "2025-03" → 31 Mar 2025). Used for the as-of test:
 *  evidence only counts as "already reflected" if its whole stated period lies before the as-of date. */
export function eventPeriodEnd(d: string | null | undefined): Date | null {
  const m = String(d ?? "").match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m || !parseEventDate(d)) return null;
  const y = Number(m[1]);
  return m[2] ? new Date(Date.UTC(y, Number(m[2]), 0)) : new Date(Date.UTC(y, 11, 31));
}

/** Recency factor by age of the event relative to `today`. */
export function recencyFactor(event: Date, today: Date): number {
  const years = (today.getTime() - event.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (years < 1) return 1;
  if (years < 3) return 0.5;
  if (years < 5) return 0.25;
  return 0;
}

/** Default data as-of date: today minus 12 months, as YYYY-MM-DD. */
export function defaultAsOf(today = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** Best credible tier among the evidence URL and corroborating URLs (distinct domains). ≥2 credible domains → max tier, no penalty. */
export function evidenceTier(e: Pick<EvidenceInput, "url" | "supportUrls">, company?: string): { tier: SourceTier; domains: string[] } {
  const byDomain = new Map<string, SourceTier>();
  for (const u of [e.url, ...(e.supportUrls ?? [])]) {
    const h = hostOf(u);
    if (!h) continue;
    const t = sourceTier(u, company);
    if (!byDomain.has(h) || t < byDomain.get(h)!) byDomain.set(h, t);
  }
  const credible = [...byDomain.entries()].filter(([, t]) => t < 3);
  if (!credible.length) return { tier: 3, domains: [hostOf(e.url)].filter(Boolean) };
  return { tier: Math.min(...credible.map(([, t]) => t)) as SourceTier, domains: credible.map(([h]) => h) };
}

export function evidenceAdjust(s: Supplier, evidence: EvidenceInput[], asOf: string, today = new Date(), company?: string): EvidenceAdjustment {
  const byKey = new Map(evidence.map((e) => [e.key, e]));
  const asOfDate = new Date(asOf);
  const rows: EvidenceRow[] = SCORES.map((d, i) => {
    const internal = s.s[i];
    const e = byKey.get(d.key);
    const status: EvidenceStatus = e?.status === "ongoing" || e?.status === "resolved" ? e.status : "unknown";
    const base = {
      key: d.key, label: d.label, weight: d.weight, internal,
      shadow: e?.score ?? null, confidence: e?.confidence ?? null, eventDate: e?.eventDate ?? null, status,
      url: e?.url ?? null, trust: 0, recency: 0, statusFactor: EVIDENCE_STATUS[status], sourceTier: 3 as SourceTier, tierFactor: 0, sourceDomains: [] as string[], factor: 0,
      adjusted: internal, delta: 0,
    };
    if (!e || e.score == null) return { ...base, counted: false, reason: "no evidence" };
    const trust = EVIDENCE_TRUST[e.confidence ?? "low"];
    const { tier, domains } = evidenceTier(e, company);
    const src = { sourceTier: tier, tierFactor: TIER_FACTOR[tier], sourceDomains: domains };
    if (e.unverified) return { ...base, ...src, trust, counted: false, reason: "unverified — not counted" };
    const date = parseEventDate(e.eventDate);
    const end = eventPeriodEnd(e.eventDate);
    if (end && end < asOfDate) {
      return { ...base, ...src, trust, counted: false, reason: "before data as-of date — likely already reflected" };
    }
    const recency = date ? recencyFactor(date, today) : UNKNOWN_DATE_RECENCY;
    if (recency === 0) return { ...base, ...src, trust, counted: false, reason: "older than 5 years" };
    if (tier === 3) return { ...base, ...src, trust, recency, counted: false, reason: `source tier 3 (${domains[0] || "unknown"}) — not counted` };
    const factor = trust * recency * base.statusFactor * src.tierFactor;
    const adjusted = Math.max(0, Math.min(100, Math.round(internal + factor * (e.score - internal))));
    const why = [date ? e.eventDate : "date unknown", status, `${e.confidence ?? "low"} confidence`,
      `source tier ${tier}${domains.length >= 2 ? ` (corroborated by ${domains.length} domains)` : ` (${domains[0]})`}`].join(" · ");
    return { ...base, ...src, trust, recency, factor: round(factor, 4), adjusted, delta: adjusted - internal, counted: true, reason: why };
  });
  // Σ weight × adjusted, expressed as official TRI + Σ weight × Δ so a zero adjustment reproduces the official TRI exactly
  // (the reported TRI is itself the rounded weighted sum; this avoids ±1 rounding noise).
  const deltaSum = rows.reduce((a, r) => a + r.weight * r.delta, 0);
  const adjustedTri = Math.max(0, Math.min(100, Math.round(s.tri + deltaSum)));
  return { supplierId: s.id, asOf, rows, officialTri: s.tri, adjustedTri, deltaTri: adjustedTri - s.tri };
}

/** Copy of a supplier with evidence-adjusted sub-scores and TRI (the dataset is never mutated). */
export function adjustedSupplier(s: Supplier, adj: Pick<EvidenceAdjustment, "rows" | "adjustedTri">): Supplier {
  const byKey = new Map(adj.rows.map((r) => [r.key, r.adjusted]));
  return { ...s, s: SCORES.map((d, i) => byKey.get(d.key) ?? s.s[i]), tri: adj.adjustedTri };
}

/** Build evidence inputs from a research report: unverified-only URLs are flagged, red flags on the same dimension corroborate. */
export function evidenceInputsFromReport(r: {
  shadow: { key: ScoreKey; score: number | null; confidence: EvidenceConfidence | null; eventDate?: string | null; status?: EvidenceStatus; url: string | null; rationale?: string }[];
  redFlags: { dimension: ScoreKey | null; url: string }[];
  facts: { url: string }[];
  unverified: { url?: string }[];
}): EvidenceInput[] {
  const verified = new Set(r.facts.map((f) => f.url));
  const unverifiedOnly = new Set(r.unverified.map((u) => u.url).filter((u): u is string => !!u && !verified.has(u)));
  return r.shadow.map((s) => ({
    key: s.key, score: s.score, confidence: s.confidence, eventDate: s.eventDate ?? null, status: s.status ?? "unknown", url: s.url, rationale: s.rationale,
    unverified: !!s.url && unverifiedOnly.has(s.url),
    supportUrls: r.redFlags.filter((f) => f.dimension === s.key && f.url !== s.url && !unverifiedOnly.has(f.url)).map((f) => f.url),
  }));
}
