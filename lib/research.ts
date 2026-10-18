import "server-only";
import { tavily } from "@tavily/core";
import { llm, MODEL, parseJson } from "./llm";
import { SCORES, SCORE_KEYS, type ScoreKey } from "./schema";
import { partialTri } from "./engine";
import type {
  Confidence, RedFlag, ResearchEvent, ResearchReport, Severity, ShadowScore, Source,
} from "./research-types";

// ---------- Budget ----------
const MAX_SEARCHES = 12;
const TIME_BUDGET_MS = 90_000;
const SNIPPET = 300;

type Query = { dimension: string; query: string };

const DIMENSION_GROUPS = [
  "financial", "legal/compliance", "labor", "safety/quality recalls",
  "ESG", "cyber", "geopolitical/sanctions", "media",
];

const fallbackQueries = (c: string): Query[] => [
  { dimension: "financial", query: `${c} financial results profit warning debt 2025 2026` },
  { dimension: "legal/compliance", query: `${c} lawsuit fine antitrust investigation` },
  { dimension: "labor", query: `${c} strike union labor dispute` },
  { dimension: "safety/quality recalls", query: `${c} recall defect safety incident` },
  { dimension: "ESG", query: `${c} ESG sustainability rating controversy` },
  { dimension: "cyber", query: `${c} cyberattack data breach` },
  { dimension: "geopolitical/sanctions", query: `${c} sanctions Russia China export controls exposure` },
];

// ---------- Helpers ----------
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

async function chatJson<T>(system: string, user: string, maxTokens = 3000): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await llm.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        max_tokens: maxTokens + 4000,
        // Nemotron: skip the long <think> phase — we need structured JSON fast.
        ...({ chat_template_kwargs: { enable_thinking: false } } as object),
        messages: [
          { role: "system", content: system + "\nRespond with ONLY a single valid JSON object. No markdown, no commentary." },
          { role: "user", content: attempt ? user + "\n\nYour previous reply was not valid JSON. Return ONLY the JSON object." : user },
        ],
      });
      const out = parseJson<T>(r.choices[0]?.message?.content ?? "");
      if (out) return out;
      console.warn(`[research] unparsable LLM reply (finish=${r.choices[0]?.finish_reason}):`, (r.choices[0]?.message?.content ?? "").slice(0, 300));
    } catch (e) {
      if (attempt) throw e;
    }
  }
  return null;
}

const asSeverity = (s: unknown): Severity => (s === "high" || s === "medium" || s === "low" ? s : "low");
const asConfidence = (s: unknown): Confidence | null =>
  s === "high" || s === "medium" || s === "low" ? s : null;
const asKey = (k: unknown): ScoreKey | null =>
  typeof k === "string" && (SCORE_KEYS as string[]).includes(k) ? (k as ScoreKey) : null;

function compact(sources: Source[], max = 40): string {
  return sources.slice(0, max).map((s, i) => `[${i + 1}] ${clip(s.title, 120)}\nURL: ${s.url}\n${s.snippet ?? ""}`).join("\n\n");
}

const DIM_LIST = SCORES.map((s) => `${s.key}: ${s.label} — ${s.description}`).join("\n");

// ---------- Agent ----------
export async function* runResearch(company: string): AsyncGenerator<ResearchEvent> {
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;
  const name = clean(company).slice(0, 120) || "Knorr-Bremse";

  const tv = tavily({ apiKey: process.env.TAVILY_API_KEY });
  let searchesUsed = 0;
  const seen = new Map<string, Source>(); // url -> source (all collected evidence)

  async function search(query: string, dimension?: string): Promise<Source[]> {
    if (searchesUsed >= MAX_SEARCHES) return [];
    searchesUsed++;
    const topic = dimension && /media|labor|news/i.test(dimension) ? "news" : "general";
    const res = await tv.search(query, { searchDepth: "advanced", maxResults: 5, topic });
    const out: Source[] = (res.results ?? []).map((r) => ({
      url: r.url,
      title: clean(r.title || r.url),
      snippet: clip(clean(r.content || ""), SNIPPET),
    }));
    for (const s of out) if (!seen.has(s.url)) seen.set(s.url, s);
    return out;
  }

  // ---- 1. Plan ----
  yield { type: "status", text: `Planning research on "${name}"…` };
  let disambiguation = "";
  let queries: Query[] = [];
  try {
    const plan = await chatJson<{ disambiguation?: string; queries?: Query[] }>(
      "You are a supplier-risk research analyst planning web searches for a procurement due-diligence check.",
      `Company: ${name}
Produce a research plan:
- "disambiguation": one sentence identifying the exact legal entity (full name, HQ country, industry, official website if known).
- "queries": 7 web search queries, one per risk group from: ${DIMENSION_GROUPS.join(", ")}. Each query must include the company name, be specific (e.g. "recall", "insolvency", "fine", "strike"), and favour recent events (2025, 2026).
JSON shape: {"disambiguation": string, "queries": [{"dimension": string, "query": string}]}`,
      2000,
    );
    disambiguation = clean(plan?.disambiguation ?? "");
    queries = (plan?.queries ?? [])
      .filter((q) => q && typeof q.query === "string" && q.query.trim())
      .map((q) => ({ dimension: String(q.dimension ?? "general"), query: clip(clean(q.query), 200) }))
      .slice(0, 8);
  } catch (e) {
    yield { type: "error", text: `Planning failed (${(e as Error).message}); using template plan.` };
  }
  if (queries.length < 3) queries = fallbackQueries(name);
  yield {
    type: "plan",
    text: disambiguation || `Research ${name} across ${queries.length} risk groups.`,
    queries,
  };

  // ---- 2. Search ----
  yield { type: "status", text: `Searching the web (${queries.length} queries)…` };
  const BATCH = 4;
  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH);
    const settled = await Promise.allSettled(batch.map((q) => search(q.query, q.dimension)));
    for (let j = 0; j < batch.length; j++) {
      const r = settled[j];
      if (r.status === "fulfilled") yield { type: "search", query: batch[j].query, dimension: batch[j].dimension, results: r.value };
      else yield { type: "error", text: `Search failed for "${batch[j].query}": ${(r.reason as Error)?.message ?? r.reason}` };
    }
  }

  // ---- 3. Assess ----
  const flags: RedFlag[] = [];
  const validateFlags = (raw: unknown): RedFlag[] => {
    const arr = Array.isArray(raw) ? raw : [];
    const out: RedFlag[] = [];
    for (const f of arr as Record<string, unknown>[]) {
      const url = typeof f?.url === "string" ? f.url.trim() : "";
      if (!seen.has(url)) continue; // must cite a URL we actually retrieved
      const key = String(f?.title ?? "").toLowerCase().slice(0, 24);
      if ([...flags, ...out].some((x) => x.url === url || x.title.toLowerCase().slice(0, 24) === key)) continue;
      out.push({
        title: clip(clean(String(f.title ?? "Red flag")), 140),
        severity: asSeverity(f.severity),
        dimension: asKey(f.dimension),
        detail: clip(clean(String(f.detail ?? "")), 500),
        url,
      });
    }
    return out;
  };

  const assessPrompt = (sources: Source[], extra = "") => `Company: ${name}${disambiguation ? ` (${disambiguation})` : ""}
Search results:
${compact(sources)}

Identify supplier-risk RED FLAGS for this company only (ignore results about other companies). Only report issues supported by a result above; cite its exact URL. Severity: high = material threat to supply continuity, legal/financial standing or safety; medium = notable concern; low = minor. ${extra}
"dimension" must be one of these keys or null:
${SCORE_KEYS.join(", ")}
JSON shape: {"flags": [{"title": string, "severity": "low"|"medium"|"high", "dimension": string|null, "detail": string, "url": string}]}
Return at most 8 flags. If none, return {"flags": []}.`;

  if (seen.size) {
    yield { type: "status", text: `Assessing ${seen.size} sources for red flags…` };
    try {
      const a = await chatJson<{ flags?: unknown }>(
        "You are a meticulous supplier-risk analyst. You never invent facts or URLs.",
        assessPrompt([...seen.values()]),
      );
      for (const f of validateFlags(a?.flags)) { flags.push(f); yield { type: "redflag", flag: f }; }
      if (!a) yield { type: "error", text: "Assessment returned no parsable output; continuing." };
    } catch (e) {
      yield { type: "error", text: `Assessment failed: ${(e as Error).message}` };
    }
  } else {
    yield { type: "error", text: "No search results collected." };
  }

  // ---- 4. Dig deeper ----
  const rank = { high: 0, medium: 1, low: 2 } as const;
  const toDig = flags.filter((f) => f.severity !== "low").sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 3);
  if (toDig.length && elapsed() < TIME_BUDGET_MS * 0.7 && searchesUsed < MAX_SEARCHES) {
    yield { type: "status", text: `Digging deeper into ${toDig.length} red flag${toDig.length > 1 ? "s" : ""}…` };
    const digs = toDig.slice(0, MAX_SEARCHES - searchesUsed).map((f) => {
      const topic = f.title.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "").split(/\s+/).filter(Boolean).slice(0, 7).join(" ");
      return { flag: f, query: `${name} ${topic} 2025 2026`.replace(/\s+/g, " ").trim() };
    });
    const settled = await Promise.allSettled(digs.map((d) => search(d.query, d.flag.dimension ?? undefined)));
    const digSources: Source[] = [];
    for (let i = 0; i < digs.length; i++) {
      const r = settled[i];
      digs[i].flag.followedUp = true;
      if (r.status === "fulfilled") {
        digSources.push(...r.value);
        yield { type: "dig", query: digs[i].query, reason: `Following up ${digs[i].flag.severity}-severity flag: "${digs[i].flag.title}"`, results: r.value };
      } else {
        yield { type: "error", text: `Follow-up search failed: ${(r.reason as Error)?.message ?? r.reason}` };
      }
    }
    if (digSources.length && elapsed() < TIME_BUDGET_MS * 0.75) {
      try {
        const a = await chatJson<{ flags?: unknown }>(
          "You are a meticulous supplier-risk analyst. You never invent facts or URLs.",
          assessPrompt(digSources, `These are FOLLOW-UP results. Already known flags: ${flags.map((f) => f.title).join("; ")}. Report only NEW or materially escalated issues not already covered.`),
          2000,
        );
        for (const f of validateFlags(a?.flags).slice(0, 4)) { f.followedUp = true; flags.push(f); yield { type: "redflag", flag: f }; }
      } catch (e) {
        yield { type: "error", text: `Follow-up assessment failed: ${(e as Error).message}` };
      }
    }
  }

  // ---- 5 + 6. Shadow profile and report (in parallel) ----
  yield { type: "status", text: "Scoring shadow profile on 18 dimensions and writing report…" };
  const all = [...seen.values()];
  const flagText = flags.map((f) => `- [${f.severity}] ${f.title} (${f.dimension ?? "n/a"}): ${f.detail} <${f.url}>`).join("\n") || "(none)";

  const shadowP = chatJson<{ scores?: Record<string, unknown>[] }>(
    "You are a supplier-risk analyst scoring a real company on a fixed 18-dimension risk model. You never guess: no evidence means null.",
    `Company: ${name}
Dimensions (key: label — meaning):
${DIM_LIST}

Scale: 0 = no risk, 100 = maximum risk (25+ medium, 50+ high, 75+ critical). A large, stable, well-rated company typically scores 10–35 where evidence supports it.
Red flags found:
${flagText}

Evidence:
${compact(all, 45)}

For EACH of the 18 keys return {"key", "score": integer 0-100 or null, "confidence": "low"|"medium"|"high"|null, "rationale": one short sentence, "url": exact evidence URL from above or null}.
If no result above provides evidence for a dimension, use score null, confidence null, url null, rationale "no evidence found". Do not reuse an unrelated URL just to fill a dimension.
JSON shape: {"scores": [ ...18 items... ]}`,
    4000,
  ).catch(() => null);

  const reportP = chatJson<{ summary?: string; facts?: { text?: string; url?: string }[]; unverified?: { text?: string; url?: string }[] }>(
    "You are a supplier-risk analyst writing a concise due-diligence brief for a procurement buyer. Only state what the evidence supports.",
    `Company: ${name}${disambiguation ? ` (${disambiguation})` : ""}
Red flags:
${flagText}

Evidence:
${compact(all, 45)}

Write:
- "summary": 3-4 sentences: who the company is, overall risk picture, the most important red flags, recommendation for a buyer.
- "facts": 4-8 verified facts, each directly supported by a cited URL from the evidence.
- "unverified": 0-5 claims that appear in a single weak source, are speculative, or conflict between sources (url optional).
JSON shape: {"summary": string, "facts": [{"text": string, "url": string}], "unverified": [{"text": string, "url": string}]}`,
    2500,
  ).catch(() => null);

  const [shadowRaw, reportRaw] = await Promise.all([shadowP, reportP]);

  const byKey = new Map<string, Record<string, unknown>>();
  for (const s of shadowRaw?.scores ?? []) if (s && typeof s.key === "string") byKey.set(s.key, s);
  const shadow: ShadowScore[] = SCORE_KEYS.map((key) => {
    const s = byKey.get(key);
    const url = typeof s?.url === "string" ? s.url.trim() : "";
    const n = typeof s?.score === "number" ? s.score : typeof s?.score === "string" && s.score.trim() !== "" ? Number(s.score) : NaN;
    if (!s || !Number.isFinite(n) || !seen.has(url)) {
      return { key, score: null, confidence: null, rationale: "no evidence found", url: null };
    }
    return {
      key,
      score: Math.max(0, Math.min(100, Math.round(n))),
      confidence: asConfidence(s.confidence) ?? "low",
      rationale: clip(clean(String(s.rationale ?? "")), 300),
      url,
    };
  });
  if (!shadowRaw) yield { type: "error", text: "Shadow profile scoring failed; all dimensions marked no evidence." };

  const tri = partialTri(Object.fromEntries(shadow.map((s) => [s.key, s.score])) as Partial<Record<ScoreKey, number | null>>);

  const facts = (reportRaw?.facts ?? [])
    .filter((f) => f && typeof f.text === "string" && typeof f.url === "string" && seen.has(f.url.trim()))
    .map((f) => ({ text: clip(clean(f.text!), 400), url: f.url!.trim() }));
  const unverified = (reportRaw?.unverified ?? [])
    .filter((f) => f && typeof f.text === "string")
    .map((f) => ({ text: clip(clean(f.text!), 400), ...(typeof f.url === "string" && seen.has(f.url.trim()) ? { url: f.url.trim() } : {}) }));
  const highs = flags.filter((f) => f.severity === "high").length;
  const summary = clean(reportRaw?.summary ?? "") ||
    `${name}: ${flags.length} red flag${flags.length === 1 ? "" : "s"} found (${highs} high) across ${all.length} sources. Report generation failed; review flags and sources directly.`;

  const report: ResearchReport = {
    company: name,
    researchedAt: new Date().toISOString(),
    summary,
    facts,
    unverified,
    redFlags: flags,
    shadow,
    shadowTri: tri.value,
    sources: all,
  };
  yield { type: "status", text: `Done in ${(elapsed() / 1000).toFixed(0)}s · ${searchesUsed} searches · ${all.length} sources · coverage ${Math.round(tri.coverage * 100)}% of TRI weight.` };
  yield { type: "report", report };
}
