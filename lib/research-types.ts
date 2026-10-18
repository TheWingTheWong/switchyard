import type { ScoreKey } from "./schema";

export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";

export interface Source { url: string; title: string; snippet?: string; }

export interface RedFlag { title: string; severity: Severity; dimension: ScoreKey | null; detail: string; url: string; followedUp?: boolean; }

export interface ShadowScore {
  key: ScoreKey;
  score: number | null; // null = no evidence found (greyed out, never guessed)
  confidence: Confidence | null;
  rationale: string;
  url: string | null;
}

export interface ResearchReport {
  company: string;
  researchedAt: string; // ISO
  cached?: boolean; // true if served from the cached demo run
  summary: string;
  facts: { text: string; url: string }[];
  unverified: { text: string; url?: string }[];
  redFlags: RedFlag[];
  shadow: ShadowScore[];
  shadowTri: number | null; // computed by engine weights over available dims (renormalised)
  sources: Source[];
}

/** NDJSON events streamed by /api/research */
export type ResearchEvent =
  | { type: "plan"; text: string; queries: { dimension: string; query: string }[] }
  | { type: "search"; query: string; dimension?: string; results: Source[] }
  | { type: "redflag"; flag: RedFlag }
  | { type: "dig"; query: string; reason: string; results: Source[] }
  | { type: "status"; text: string }
  | { type: "report"; report: ResearchReport }
  | { type: "error"; text: string };
