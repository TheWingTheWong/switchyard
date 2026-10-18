# SWITCHYARD — The AI Procurement Decision Room

> Every supplier has a score. Every decision needs a reason.

Built in one day at the **Nebius × NVIDIA Build Week hackathon** (Berlin, 18 Oct 2026), Siemens track: *Supplier Risk Intelligence for rolling stock*.

SWITCHYARD takes a rail buyer from "this supplier is a problem" to an auditable decision memo in six steps:

| Step | What happens |
|---|---|
| **1 · Triage** | Portfolio KPIs (10,000 suppliers, €20.4bn PO volume, 182 hidden-risk suppliers), top-10 risk-weighted exposure, exact TRI breakdown of the supplier to replace (default `SUPP_09733`, TRI 87, €50M). |
| **2 · Narrow** | Filter 10,000 → ≤ 20 on any of the 18 risk scores, levels, ops metrics, sourcing risk, complexity, hidden-risk toggle. Build a shortlist (cap 20). |
| **3 · Compare** | Heatmap (suppliers × 18 scores + ops metrics), "where they differ most", radar overlay, per-supplier TRI waterfall. Pick a candidate. |
| **4 · Challenge** | Six deterministic checks (hidden risk, robustness across 5 priority presets, delivery, sourcing…), re-ranking with presets/custom weights, AI devil's advocate. |
| **5 · Verify** | Research agent on a **real company**: plans → searches (Tavily) → flags red flags → digs deeper → scores a *shadow profile* on the same 18 dimensions with a source URL per score → report. |
| **6 · Decide** | Decision memo: why act, shortlist, pick explained, challenges, external evidence with links, open qualification checks, audit log. Print → PDF. |

A **chat panel** ("Ask SWITCHYARD") is available on every step. It answers with tool calls over the same data engine and renders results as inline tables / waterfalls.

## Live demo

- URL: **https://web-production-109233.up.railway.app**
- Jury login (HTTP Basic Auth): provided in the submission form (stored as `JURY_USER` / `JURY_PASS` env vars on Railway, never in the repo).

## Key insight: the TRI formula, recovered

The brief calls the Total Risk Index "a weighted average" without weights. A linear regression over the 10,000 rows recovers them exactly (R² = 0.9996, weights sum to 1.00, max residual 0.5 = rounding):

| Weight | Scores |
|---|---|
| 0.10 | Operational Resilience, Financial Health, Quality Risk |
| 0.08 | Compliance Risk |
| 0.06 | Credit Rating, Safety Incident, Sub-Tier Visibility |
| 0.05 | Geopolitical Risk, Governance Risk, ESG Performance |
| 0.04 | Environmental Exposure, Labor Stability, Digital Security, Political Stability, Industry Benchmark |
| 0.03 | Market Sentiment, Media Sentiment, External Intelligence |

So "why is this supplier risky?" has an exact answer: contribution = score × weight. And because the index is an average, it can hide trouble: **182 suppliers** have a Low/Medium TRI but ≥ 2 Critical sub-scores ("averages lie").

## Architecture

```
Browser (Next.js client)
 ├─ public/suppliers.json (10,000 suppliers, built from the CSV) → instant filter / rank / reweight
 ├─ Zustand store (persisted): replace target, shortlist, pick, challenge, research, memo, audit log
 └─ Triage · Narrow · Compare · Challenge · Verify · Decide + Chat panel

Next.js server (Railway, long-running Node)
 ├─ /api/chat      Nemotron tool-calling loop → lib/tools.ts → lib/engine.ts → cards
 ├─ /api/research  research agent (Nemotron + Tavily), streams NDJSON steps
 ├─ /api/critique  devil's advocate prose from computed checks
 ├─ /api/memo      executive summary prose from computed facts
 └─ middleware.ts  HTTP Basic Auth for the jury
```

**The LLM never computes numbers.** All math lives in `lib/engine.ts`, shared by the browser and the server. The model chooses tools and explains their results; tables and charts in the chat are rendered from tool output, not from model prose. Research URLs are validated against the actual search results; scores without evidence are left empty ("no evidence found"), never guessed.

| Path | Purpose |
|---|---|
| `data/` | Original dataset + criteria description (committed) |
| `scripts/build-data.ts` | CSV → `public/suppliers.json` (runs on every build) |
| `lib/schema.ts` | Score keys, labels, recovered weights, level thresholds |
| `lib/engine.ts` | explainScore, hiddenRisk, filter, rank, reweight, compare, robustness, exposure, percentiles |
| `lib/challenge.ts` | Deterministic challenge checks |
| `lib/tools.ts` | Chat tool definitions + card generation |
| `lib/research.ts` | Research agent loop |
| `data/cache/knorr-bremse.json` | One cached full research run (demo fallback, labeled "cached" in the UI) |

### Stack
Next.js 15 (App Router) · TypeScript · Tailwind v4 · Recharts · Zustand · OpenAI SDK against **Nebius Token Factory** (`nvidia/Nemotron-3.5-Super-VL`, tool calling) · Tavily search · Railway.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # fill in keys
pnpm dev                      # builds public/suppliers.json, then http://localhost:3000
```

Env vars:

```
NEBIUS_API_KEY=            # Nebius Token Factory
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1
LLM_MODEL=nvidia/Nemotron-3.5-Super-VL
LLM_MODEL_FAST=nvidia/Nemotron-3_5-Lightning
TAVILY_API_KEY=
JURY_USER=                 # Basic Auth (leave empty to disable locally)
JURY_PASS=
```

Re-generate the cached research run: `pnpm tsx --env-file=.env.local scripts/cache-research.ts "Knorr-Bremse" http://localhost:3000`.

## Honest limits

The dataset has no component categories, capacity, prices, qualification status or countries. SWITCHYARD therefore recommends **candidates for qualification**, never "switch now", and the memo lists those open checks explicitly. The chatbot says so when asked (e.g. "Can X replace Y for brake pads?").

## Deploy

```bash
railway up --service web
```
