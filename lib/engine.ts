// All math lives here. Shared by client (UI) and server (chat tools, research, memo).
// The LLM never computes numbers — it calls these functions and explains the results.
import { TIER_FACTOR, TIER_RANK, hostOf, sourceTier, tierLabel, type SourceTier } from "./sources";
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
// Adverse-only and conservative. A sub-score may only move UP, toward the web "shadow" score, and only when
// at least one RED FLAG on that dimension is counted: verified, from a credible (or corroborated) source,
// and dated after the data as-of date (older evidence is likely already in the internal scores).
// Positive evidence never raises risk, and nothing ever moves down.
// The official TRI is never modified; this produces a separate, labelled second number.

export type EvidenceStatus = "ongoing" | "resolved" | "unknown";
export type EvidenceConfidence = "low" | "medium" | "high";
export type EvidenceSeverity = "low" | "medium" | "high";

export interface FlagInput {
  title: string; severity: EvidenceSeverity; dimension: ScoreKey | null;
  eventDate?: string | null; status?: EvidenceStatus;
  url: string; supportUrls?: string[];
  /** True when every URL behind the flag appears only among the report's unverified claims. */
  unverified?: boolean;
}

export interface EvidenceInput {
  key: ScoreKey;
  score: number | null; // shadow score (target), null = no evidence
  confidence: EvidenceConfidence | null;
  url: string | null;
  rationale?: string;
  /** Red flags backing this dimension (incl. its corroboration group, e.g. safety ↔ quality). */
  flags?: FlagInput[];
}

export interface FlagAssessment {
  flag: FlagInput;
  counted: boolean; reason: string;
  tier: SourceTier; domains: string[]; corroborated: boolean;
  recency: number; statusFactor: number; severityFactor: number;
}

export interface EvidenceRow {
  key: ScoreKey; label: string; weight: number;
  internal: number; shadow: number | null;
  confidence: EvidenceConfidence | null; eventDate: string | null; status: EvidenceStatus;
  severityFactor: number; confidenceFactor: number; recency: number; statusFactor: number;
  sourceTier: SourceTier | null; tierFactor: number; sourceDomains: string[]; factor: number;
  adjusted: number; delta: number;
  counted: boolean; reason: string; url: string | null;
  flagTitle: string | null;
}

export interface EvidenceAdjustment {
  supplierId: string; asOf: string;
  rows: EvidenceRow[];
  officialTri: number; adjustedTri: number; deltaTri: number;
  /** Counted, high-severity, still-active red flags — the Challenge check fails on any of these. */
  activeHighFlags: { title: string; url: string; domain: string; dimension: ScoreKey | null; eventDate: string | null; status: EvidenceStatus }[];
}

export const EVIDENCE_SEVERITY: Record<EvidenceSeverity, number> = { high: 0.6, medium: 0.35, low: 0.15 };
export const EVIDENCE_CONFIDENCE: Record<EvidenceConfidence, number> = { high: 1, medium: 0.85, low: 0.6 };
export const EVIDENCE_STATUS: Record<EvidenceStatus, number> = { ongoing: 1, resolved: 0.5, unknown: 0.75 };
export const UNKNOWN_DATE_RECENCY = 0.25;
/** Dimensions that share evidence (a recall is both a safety and a quality event). */
export const EVIDENCE_GROUPS: ScoreKey[][] = [["safety", "quality"]];
export const evidenceGroup = (k: ScoreKey): ScoreKey[] => EVIDENCE_GROUPS.find((g) => g.includes(k)) ?? [k];

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

/** Best tier among URLs (one vote per domain). Corroborated = ≥2 distinct non-blocked domains. */
export function evidenceTier(urls: (string | null | undefined)[], company?: string): { tier: SourceTier; domains: string[]; corroborated: boolean } {
  const byDomain = new Map<string, SourceTier>();
  for (const u of urls) {
    const h = hostOf(u);
    if (!h) continue;
    const t = sourceTier(u, company);
    if (!byDomain.has(h) || TIER_RANK[t] > TIER_RANK[byDomain.get(h)!]) byDomain.set(h, t);
  }
  const usable = [...byDomain.entries()].filter(([, t]) => t !== "blocked").sort((a, b) => TIER_RANK[b[1]] - TIER_RANK[a[1]]);
  if (!usable.length) return { tier: "blocked", domains: [...byDomain.keys()], corroborated: false };
  return { tier: usable[0][1], domains: usable.map(([h]) => h), corroborated: usable.length >= 2 };
}

/** Decide whether one red flag counts, and with which factors. Pure; order of tests = order of reasons shown. */
export function assessFlag(f: FlagInput, asOf: string, today: Date, company?: string, extraUrls: (string | null)[] = []): FlagAssessment {
  const status: EvidenceStatus = f.status === "ongoing" || f.status === "resolved" ? f.status : "unknown";
  const { tier, domains, corroborated } = evidenceTier([f.url, ...(f.supportUrls ?? []), ...extraUrls], company);
  const base = { flag: f, tier, domains, corroborated, statusFactor: EVIDENCE_STATUS[status], severityFactor: EVIDENCE_SEVERITY[f.severity] ?? 0.15, recency: 0 };
  if (f.unverified) return { ...base, counted: false, reason: "unverified — not counted" };
  const end = eventPeriodEnd(f.eventDate);
  if (end && end < new Date(asOf)) return { ...base, counted: false, reason: "before data as-of date — likely already reflected" };
  const date = parseEventDate(f.eventDate);
  const recency = date ? recencyFactor(date, today) : UNKNOWN_DATE_RECENCY;
  if (recency === 0) return { ...base, recency, counted: false, reason: "older than 5 years" };
  if (tier === "blocked") return { ...base, recency, counted: false, reason: `blocked source (${domains[0] ?? hostOf(f.url)}) — not counted` };
  return { ...base, recency, counted: true, reason: "counted" };
}

export function evidenceAdjust(s: Supplier, evidence: EvidenceInput[], asOf: string, today = new Date(), company?: string): EvidenceAdjustment {
  const byKey = new Map(evidence.map((e) => [e.key, e]));
  const rows: EvidenceRow[] = SCORES.map((d, i) => {
    const internal = s.s[i];
    const e = byKey.get(d.key);
    const base: EvidenceRow = {
      key: d.key, label: d.label, weight: d.weight, internal,
      shadow: e?.score ?? null, confidence: e?.confidence ?? null, eventDate: null, status: "unknown",
      severityFactor: 0, confidenceFactor: EVIDENCE_CONFIDENCE[e?.confidence ?? "low"], recency: 0, statusFactor: 0,
      sourceTier: null, tierFactor: 0, sourceDomains: [], factor: 0,
      adjusted: internal, delta: 0, counted: false, reason: "no evidence", url: e?.url ?? null, flagTitle: null,
    };
    if (!e || e.score == null) return base;
    const flags = e.flags ?? [];
    if (!flags.length) return { ...base, reason: "no adverse evidence — positive evidence never raises risk" };
    // Evaluate every backing flag on its OWN url + supportUrls (never the dimension's shadow URL).
    const assessed = flags.map((f) => assessFlag(f, asOf, today, company));
    const factorOf = (a: FlagAssessment) => a.severityFactor * base.confidenceFactor * a.recency * a.statusFactor * TIER_FACTOR[a.tier];
    const counted = assessed.filter((a) => a.counted).sort((a, b) => factorOf(b) - factorOf(a));
    if (!counted.length) {
      const top = assessed[0];
      return { ...base, eventDate: top.flag.eventDate ?? null, status: top.flag.status ?? "unknown", url: top.flag.url, flagTitle: top.flag.title, sourceTier: top.tier, sourceDomains: top.domains, reason: top.reason };
    }
    const a = counted[0];
    const meta = {
      eventDate: a.flag.eventDate ?? null, status: (a.flag.status ?? "unknown") as EvidenceStatus, url: a.flag.url, flagTitle: a.flag.title,
      severityFactor: a.severityFactor, recency: a.recency, statusFactor: a.statusFactor,
      sourceTier: a.tier, tierFactor: TIER_FACTOR[a.tier], sourceDomains: a.domains,
    };
    if (e.score <= internal) return { ...base, ...meta, reason: "shadow not above internal — scores never move down" };
    const factor = factorOf(a);
    const adjusted = Math.max(0, Math.min(100, Math.round(internal + factor * (e.score - internal))));
    const why = [`${a.flag.severity} red flag`, a.flag.eventDate ?? "date unknown", a.flag.status ?? "unknown", `${e.confidence ?? "low"} confidence`,
      `${tierLabel(a.tier)}${a.corroborated ? `, corroborated by ${a.domains.length} domains` : ` (${a.domains[0]})`}`].join(" · ");
    return { ...base, ...meta, factor: round(factor, 4), adjusted, delta: adjusted - internal, counted: true, reason: why };
  });
  // Σ weight × adjusted, expressed as official TRI + Σ weight × Δ so a zero adjustment reproduces the official TRI exactly
  // (the reported TRI is itself the rounded weighted sum; this avoids ±1 rounding noise). One decimal, so a small
  // honest movement (e.g. 6 → 6.5) stays visible instead of rounding to ±0.
  const deltaSum = rows.reduce((a, r) => a + r.weight * r.delta, 0);
  const adjustedTri = Math.max(0, Math.min(100, round(s.tri + deltaSum, 1)));

  // Active credible high-severity flags (independent of the average): counted, high, ongoing/unknown,
  // and credible = tier 1/2 or corroborated by ≥2 domains.
  const seen = new Set<string>();
  const activeHighFlags = evidence.flatMap((e) => e.flags ?? [])
    .filter((f) => { const k = f.title + f.url; if (seen.has(k)) return false; seen.add(k); return f.severity === "high"; })
    .map((f) => ({ f, a: assessFlag(f, asOf, today, company) }))
    .filter(({ f, a }) => a.counted && f.status !== "resolved" && (a.tier === "1" || a.tier === "2" || a.corroborated))
    .map(({ f, a }) => ({ title: f.title, url: f.url, domain: a.domains[0] ?? hostOf(f.url), dimension: f.dimension, eventDate: f.eventDate ?? null, status: (f.status ?? "unknown") as EvidenceStatus }));
  return { supplierId: s.id, asOf, rows, officialTri: s.tri, adjustedTri, deltaTri: round(adjustedTri - s.tri, 1), activeHighFlags };
}

/** Copy of a supplier with evidence-adjusted sub-scores and TRI (the dataset is never mutated). */
export function adjustedSupplier(s: Supplier, adj: Pick<EvidenceAdjustment, "rows" | "adjustedTri">): Supplier {
  const byKey = new Map(adj.rows.map((r) => [r.key, r.adjusted]));
  return { ...s, s: SCORES.map((d, i) => byKey.get(d.key) ?? s.s[i]), tri: adj.adjustedTri };
}

/** Build evidence inputs from a research report. Flags back their dimension and its group (safety ↔ quality);
 *  a flag is unverified when every URL behind it appears only among the report's unverified claims. */
export function evidenceInputsFromReport(r: {
  shadow: { key: ScoreKey; score: number | null; confidence: EvidenceConfidence | null; url: string | null; rationale?: string }[];
  redFlags: { title: string; severity: EvidenceSeverity; dimension: ScoreKey | null; url: string; supportUrls?: string[]; eventDate?: string | null; status?: EvidenceStatus }[];
  facts: { url: string }[];
  unverified: { url?: string }[];
}): EvidenceInput[] {
  const verified = new Set(r.facts.map((f) => f.url));
  const unverifiedOnly = new Set(r.unverified.map((u) => u.url).filter((u): u is string => !!u && !verified.has(u)));
  const flags: FlagInput[] = r.redFlags.map((f) => {
    const urls = [f.url, ...(f.supportUrls ?? [])];
    return { ...f, unverified: urls.every((u) => unverifiedOnly.has(u)) };
  });
  return r.shadow.map((s) => {
    const group = evidenceGroup(s.key);
    return {
      key: s.key, score: s.score, confidence: s.confidence, url: s.url, rationale: s.rationale,
      flags: flags.filter((f) => f.dimension != null && group.includes(f.dimension)),
    };
  });
}
