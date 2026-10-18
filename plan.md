# SWITCHYARD — The AI Procurement Decision Room

**Challenge:** Siemens — Supplier Risk Intelligence for rolling stock
**Event:** Nebius Build Week Hackathon (Nebius × NVIDIA), Berlin, Sun 18 Oct 2026
**Deadline:** 18:30 sharp per master deck (ChatGPT said 17:30 — confirm with organizers; plan for 17:30)
**Judging (all tracks):** 50% Technical Execution · 30% Creativity & Wow · 20% Fit to Challenge
**Side prize to target:** Best use of Nemotron (NVIDIA DGX card) — run the LLM on Nemotron via Nebius Token Factory

> One line: **Every supplier has a score. Every decision needs a reason.**
> SWITCHYARD doesn't just rank suppliers — it shows the exact math behind every risk score, catches risk hidden by averages, challenges the buyer's pick, verifies real companies on the web, and ends with an auditable decision memo.

---

## 0. Deliverables checklist

- [ ] Public GitHub repo with all code + data (`supplier_risk_dataset.csv`, `risk_criteria_description.md`)
- [ ] Live deployed app (Railway) + jury login credentials
- [ ] 2-minute demo video (the "movie" — script in §9)
- [ ] Submitted on Tech Europe platform before deadline
- [ ] Team of 2–4 registered (rule from master deck)
- [ ] `STORY.md` — written at the end: the full narrative of what we built, why, and how, so we can present and answer questions freely (see §11)

---

## 1. Data findings (our unfair advantage)

Verified by analysis of `supplier_risk_dataset.csv` (10,000 rows, 46 columns, 0 nulls, 0 duplicate names).

### 1.1 The Total Risk Index formula — recovered exactly
The brief says TRI is "a weighted average of all risk categories" but gives no weights. Linear regression recovers them exactly (R² = 0.9996, weights sum to 1.00):

| Weight | Scores |
|---|---|
| 0.10 | Operational_Resilience, Financial_Health, Quality_Risk |
| 0.08 | Compliance_Risk |
| 0.06 | Credit_Rating, Safety_Incident, Sub_Tier_Visibility |
| 0.05 | Geopolitical_Risk, Governance_Risk, ESG_Performance |
| 0.04 | Environmental_Exposure, Labor_Stability, Digital_Security, Political_Stability, Industry_Benchmark |
| 0.03 | Market_Sentiment, Media_Sentiment, External_Intelligence |

**Consequence:** "Why is SUPP_00018's TRI so high?" gets an *exact* answer: contribution = score × weight, shown as a waterfall. No LLM guessing. Residual (rounding) shown honestly as "rounding ±0.5".

### 1.2 Level thresholds (same for every score)
Low 0–24 · Medium 25–49 · High 50–74 · Critical 75–100

### 1.3 Hidden risk ("Averages lie")
**182 suppliers** have overall TRI Low/Medium but **≥ 2 Critical sub-scores**. The average masks a real problem. This is the twist in our story.
Definition: `hiddenRisk = TRI_Level ∈ {Low, Medium} AND count(subscore_Level == Critical) ≥ 2`

### 1.4 Exposure
`exposure = TRI / 100 × Purchase Order Volume (EUR)` — total portfolio €20.4bn.
Top exposure: **SUPP_09733 "Advanced Systems 379"** — TRI 87 (Critical), PO €50M (dataset max), Financial 100, Labor 99, Sub-Tier 96, Media 90. **This is our opening scene.**

### 1.5 What the data does NOT have (say it out loud, it earns trust)
No component categories, no capacity, no unit prices, no qualification status, no countries. So SWITCHYARD recommends **candidates for qualification**, never "switch now". The memo lists open qualification checks.

---

## 2. Product flow — one decision, six steps

A top **progress rail** is always visible: `Triage → Narrow → Compare → Challenge → Verify → Decide`. Each step hands its output to the next (shared state). Users can jump freely — the rail is guidance, not a cage.

| # | Step | What the user does | What we show | Output carried forward |
|---|---|---|---|---|
| 1 | **Triage** | Lands on portfolio | KPI row (suppliers, total spend, € at Critical risk, hidden-risk count); top-10 exposure table; level distribution | "Supplier to replace" (default SUPP_09733) |
| 2 | **Narrow** | Filters 10,000 → ≤ 20 | Filter panel (any score range, levels, sourcing risk, complexity, PO volume, delivery/confirmation rates, hidden-risk toggle); sortable table; "Add to shortlist" (cap 20) | Shortlist (≤ 20 IDs) |
| 3 | **Compare** | Views shortlist side by side | Heatmap matrix (suppliers × 18 scores + ops metrics); overlay radar for selected 2–5; "Where they differ most" callouts (highest-variance dimensions); per-supplier TRI waterfall | Buyer's pick |
| 4 | **Challenge** | Clicks "Challenge my decision" | (a) Hidden-risk check on the pick; (b) priority presets + weight sliders → re-ranked shortlist with rank-change arrows; (c) robustness: "Your pick ranks #1 in 3 of 5 priority scenarios"; (d) plain-language critique from AI using these computed facts | Challenge results (pass/fail per check) |
| 5 | **Verify** | Names a real company | Research agent live log (plan → search → red flag → dig deeper → report); **Shadow profile**: real company scored on the same 18 dimensions with a source link per dimension, overlaid on the same radar | Research report + sources |
| 6 | **Decide** | Clicks "Generate memo" | Decision memo: context, shortlist, pick, waterfall, challenges survived, external evidence + links, open qualification checks, audit log; print → PDF | Memo |

**Chat assistant** — a side panel available on every step. Knows current shortlist/pick. Answers grounded via tools and replies with **inline cards/charts** (generative UI), not just text.

---

## 3. Design (phase 1: deliberately blank)

**Rule for now:** plain black & white, one good font, no animation, no gradients, no shadows, no color except risk levels where absolutely necessary (and even those in grayscale first). We restyle later with the design skill.

- Font: **Inter** (body) + **JetBrains Mono** (numbers, IDs) via `next/font`
- Colors: `--bg #fff`, `--fg #000`, `--muted #6b6b6b`, `--line #e5e5e5`
- Risk levels in phase 1: Low/Medium/High/Critical = four gray shades + text label (never rely on color alone)
- Layout: max-width container, 1px borders, generous whitespace, tabular numerals
- **All design tokens live in ONE place** (`app/globals.css` CSS variables + `tailwind.config`) so the later redesign is a swap, not a rewrite
- Charts: Recharts with black/gray strokes, no animation (`isAnimationActive={false}`)

---

## 4. Architecture

```
Browser (Next.js client)
 ├─ All 10,000 suppliers loaded once as JSON (~1–2 MB gz) → instant filter/rank/reweight
 ├─ Zustand store: shortlist, pick, weights, challenge results, research, memo (persisted to localStorage)
 └─ UI: Triage / Narrow / Compare / Challenge / Verify / Decide + Chat panel

Next.js server (Railway, long-running Node — no function timeouts for the research agent)
 ├─ /api/chat      → LLM (Nemotron on Nebius Token Factory, OpenAI-compatible) + tool calls over the same data engine
 ├─ /api/research  → research agent loop (LLM + Tavily), streams steps as NDJSON
 ├─ /api/memo      → LLM writes memo prose from computed facts
 └─ middleware.ts  → HTTP Basic Auth for jury (JURY_USER / JURY_PASS)

lib/engine.ts  (shared by client + server — single source of truth for all math)
```

**Principle: the LLM never computes numbers.** All math is in `lib/engine.ts`. The LLM chooses tools, reads results, explains.

### 4.1 Stack
Next.js 15 (App Router) · TypeScript · Tailwind · Recharts · Zustand · Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`) · `@tavily/core` · zod

### 4.2 Env vars
```
NEBIUS_API_KEY=
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1   # confirm
LLM_MODEL=nvidia/...Nemotron...                           # confirm exact ID in Token Factory
TAVILY_API_KEY=
JURY_USER=jury
JURY_PASS=
```

### 4.3 File structure
```
/data/supplier_risk_dataset.csv, risk_criteria_description.md   (originals, committed)
/scripts/build-data.ts         CSV → public/suppliers.json (compact keys)
/lib/schema.ts                 score keys, labels, descriptions, WEIGHTS, level thresholds
/lib/engine.ts                 filter, rank, explainScore, hiddenRisk, compare, reweight, robustness, exposure
/lib/store.ts                  zustand
/lib/llm.ts                    provider setup
/lib/tools.ts                  chat tool definitions (zod) → engine
/lib/research.ts               agent loop
/app/layout.tsx, globals.css
/app/page.tsx                  Triage
/app/narrow/page.tsx
/app/compare/page.tsx
/app/challenge/page.tsx
/app/verify/page.tsx
/app/decide/page.tsx
/app/api/chat|research|memo/route.ts
/components/ProgressRail, ChatPanel, SupplierTable, FilterPanel, Heatmap, RadarOverlay,
            Waterfall, LevelTag, RankShift, ResearchLog, ShadowProfile, Memo, cards/*
/middleware.ts
README.md, plan.md, STORY.md
```

---

## 5. Data engine (`lib/engine.ts`) — function list

| Function | Returns |
|---|---|
| `level(score)` | Low/Medium/High/Critical |
| `explainScore(id)` | per-dimension `{score, weight, contribution, shareOfTotal}` sorted desc + residual |
| `hiddenRisk(supplier)` | `{flag, criticalDims[]}` |
| `filterSuppliers(criteria)` | ids (supports ranges on any column, level sets, categorical, hiddenRisk) |
| `rank(ids, weights?)` | sorted by weighted score (default = official weights) |
| `compare(ids)` | matrix + per-dimension min/max/best/worst + top-variance dimensions |
| `reweight(ids, presetOrWeights)` | new ranking + rank deltas vs official |
| `robustness(pickId, ids)` | rank of pick across presets, count of #1 finishes |
| `exposure(id)` | € at risk |
| `peerPercentile(id, dim)` | percentile among all 10,000 |

**Priority presets** (for Challenge): Official TRI · Financial stability (Financial, Credit, Governance ×3) · Delivery reliability (Operational, Sub-Tier, Quality ×3 + Delivery Rating/Confirmation Rate) · Compliance & ESG · Geopolitical resilience. Custom sliders on top.

Operational metrics (delivery rating, confirmation rate, order change rate) are NOT in TRI — in presets they're normalized to 0–100 risk (`100 − rating`, `changeRate`) and shown separately so we never confuse them with the official index.

---

## 6. Chat assistant

- **Tools** (zod schemas → engine): `getSupplier`, `filterSuppliers`, `compareSuppliers`, `explainScore`, `rankBy`, `hiddenRiskScan`, `getShortlist`, `addToShortlist`, `glossary(term)` (from risk_criteria_description.md)
- **System prompt rules:** every number must come from a tool result; cite supplier IDs; if data can't answer (e.g., component fit, country), say so explicitly; keep answers short.
- **Generative UI:** tool results render as cards in the chat (mini table, waterfall, radar) — the text is just the explanation around them.
- **Must-pass test questions:**
  1. "Which of SUPP_00012, SUPP_00450 and SUPP_00731 has the lowest financial risk?"
  2. "Why is the Total Risk Index of SUPP_00018 so high?"
  3. "Show me Low-risk suppliers with Critical financial health"
  4. "Top 5 suppliers with delivery rating above 95 and TRI below 30"
  5. "Can SUPP_X replace SUPP_09733 for brake pads?" → must explain the data has no component info
- Fallback: if LLM call fails, show the tool result card alone.

---

## 7. Research agent (Verify step)

Loop (max ~12 Tavily calls, ~60s budget), each step streamed to the UI log:

1. **Plan** — LLM produces research plan: entity disambiguation, official site, then queries grouped by risk dimension (financial, legal/compliance, labor, safety/quality recalls, ESG, cyber, geopolitical/sanctions, media).
2. **Search** — Tavily search per group (`search_depth: advanced`, recent news).
3. **Assess** — LLM reads results, flags red flags with severity + source URL.
4. **Dig deeper** — for each red flag above threshold, a follow-up query (e.g., "X insolvency 2026", "X recall brake"). This is the visible "agent took initiative" moment.
5. **Score shadow profile** — LLM maps evidence to the same 18 dimensions (0–100, confidence low/med/high, ≥1 URL each, or "no evidence found" → greyed out, not guessed).
6. **Report** — summary, red flags, facts vs unverified claims, all links, date of research.

**Demo company:** a real rail supplier, e.g. **Knorr-Bremse** (rail brakes — matches our "brake system" storyline). Cache one complete run as JSON for the video/demo fallback, clearly labeled "cached run from HH:MM" if used.

---

## 8. Time plan (start → deadline)

| Block | Duration | Work | Done when |
|---|---|---|---|
| A | 30 min | Scaffold Next.js, Tailwind B/W tokens, build-data script, schema + weights, Basic Auth, **deploy to Railway** | Live URL shows Triage KPIs |
| B | 75 min | Engine + Narrow (filters, table, shortlist) + Compare (heatmap, radar, waterfall) | Can go 10,000 → 20 → pick |
| C | 60 min | Chat panel + tools + cards; pass the 5 test questions | Both brief example questions answered correctly |
| D | 45 min | Research agent + log + shadow profile; cache demo run | Knorr-Bremse report with links |
| E | 40 min | Challenge (hidden risk, presets, sliders, robustness) + Decide memo + progress rail | Full flow end to end |
| F | 20 min | Bug bash on live URL, README, final deploy | Jury can log in and use it |
| G | 30 min | Record + edit 2-min video, submit | Submitted |
| H | after | Write `STORY.md`, rehearse live demo for 20:00 | Can present without notes |

**Cut order if behind:** custom sliders (keep presets) → shadow-profile radar overlay (keep report) → memo AI prose (keep templated memo) → in-chat charts (keep text + table).
**Never cut:** filters/compare/20 shortlist, chat answering brief questions, research agent with links, live URL + login.

---

## 9. The 2-minute video — the movie

Structured like a film: hook, rising tension, twist, climax, resolution. Narration explains *why decisions change*, never "now I click here".

| Time | Scene | On screen | Voice-over (draft) |
|---|---|---|---|
| 0:00–0:12 | **Cold open — the threat** | Triage: SUPP_09733, TRI 87, €50M, Financial 100 | "A train has tens of thousands of parts. This supplier holds fifty million euros of ours — and its financial risk just hit one hundred." |
| 0:12–0:30 | **The search** | Narrow: 10,000 → filters → 20 shortlisted | "We need an alternative. Ten thousand suppliers. We narrow to twenty in seconds." |
| 0:30–0:50 | **Seeing clearly** | Compare heatmap + waterfall; chat answers "Why is SUPP_00018 so high?" with exact breakdown | "Every risk score is decomposed to the exact point. No black box — we reverse-engineered the index itself." |
| 0:50–1:12 | **The twist** | Buyer picks the lowest-TRI supplier → Challenge: "Hidden risk: 2 Critical scores masked by the average" → presets re-rank | "The obvious choice looks safe. SWITCHYARD disagrees. Averages lie — 182 suppliers hide critical risk behind a calm score." |
| 1:12–1:35 | **Into the real world** | Verify: agent plans, searches, finds red flag, digs deeper, shadow profile with links | "Then a real company. The agent plans its own research, follows red flags, and scores it on the same eighteen dimensions — every claim linked." |
| 1:35–1:52 | **Resolution** | Decide: memo with pick, challenges survived, sources, open qualification checks | "The decision, with its reasons, its risks, and its evidence — ready for review." |
| 1:52–2:00 | **Title card** | SWITCHYARD | "Every supplier has a score. Every decision needs a reason." |

Recording tips: 1440×900 browser, zoom 110%, pre-warm chat and research (or use cached run), record scenes separately, cut tightly, voice-over recorded separately, captions on.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| LLM slow / rate-limited during demo | Engine works without LLM; cached research run; short prompts |
| LLM invents numbers | Tools-only numbers rule; numbers rendered from tool output, not LLM text |
| Wrong Nemotron model ID / tool calling unsupported | Test in block A; fallback to another Token Factory model with tool calling |
| Deploy breaks late | Deploy in block A, deploy after every block |
| Over-claiming substitutes | Explicit "candidate for qualification" language + open checks in memo |
| Time | Cut order in §8 |

---

## 11. `STORY.md` (written at the end)

A narrative doc so we can talk about the project freely to judges — not a README. Sections:
1. The problem in one human story (the buyer, the €50M supplier)
2. What we noticed others would build, and why we went another way
3. The discovery: reverse-engineering the TRI weights (how, R², why it matters)
4. "Averages lie": the hidden-risk insight (182 suppliers)
5. Walkthrough of the six steps — what each does and how it hands off to the next
6. How the AI is kept honest (tools, no invented numbers, explicit limits)
7. The research agent: its loop, why "dig deeper", the shadow profile
8. Tech choices and why (client-side engine, Nemotron, Tavily, Railway)
9. What we'd build next (component mapping, live monitoring, ERP integration)
10. Likely judge questions + crisp answers

---

## 12. Open questions (resolve now)

- [ ] Nebius Token Factory API key? Exact Nemotron model ID with tool calling?
- [ ] Tavily API key?
- [ ] Team members (need 2–4)?
- [ ] Deadline 17:30 or 18:30?
- [ ] Ask Thomas Parsch: what decides the Siemens finalist; is our own priority re-weighting OK if clearly separated from official TRI?
