# SWITCHYARD — the procurement decision room

> **Every supplier has a score. Every decision needs a reason.**

SWITCHYARD helps a rail buyer go from *"this supplier is a problem"* to *"here is the alternative we can defend"*. You narrow 10,000 suppliers to a shortlist, compare them, let the tool **challenge your pick**, check the real company on the web, and finish with a decision memo an auditor can sign off.

Built for the **Siemens challenge — Supplier Risk Intelligence for rolling stock** at the Nebius × NVIDIA Build Week hackathon, Berlin, 18 Oct 2026.

**Live app:** https://web-production-109233.up.railway.app — jury login is in the submission form.

---

## Try it in three minutes

1. **Triage** — the app opens on the portfolio: €20.4bn of orders, and the most exposed supplier, `SUPP_09733` (risk 87 / Critical, €50M). Its risk score is broken down to the exact point.
2. **Narrow** — click the quick filter **"Proven at scale"** → 10,000 suppliers become 20. **Add top 20 to shortlist.**
3. **Compare** — a heatmap of the 20 across all 18 risk dimensions. Pick `SUPP_09414` (it looks safe: risk 38, 99.7% order confirmation).
4. **Challenge** — SWITCHYARD disagrees: two Critical risks hide behind its calm average, and it wins **0 of 5** priority scenarios. One click switches to `SUPP_07967`.
5. **Verify** — type a real company (default **Knorr-Bremse**) → **Run research** (≈25 s) or **Load cached run**. Then **Apply evidence** to see whether the real-world findings change the decision.
6. **Decide** — **Generate memo** → print to PDF.

The **Ask SWITCHYARD** panel works on every step — try *"Why is the Total Risk Index of SUPP_00018 so high?"*

---

## What makes it different

**1. The risk formula, recovered.** The brief describes the Total Risk Index as "a weighted average of all risk categories" but gives no weights. A regression over all 10,000 suppliers recovers them exactly — R² 0.9996, weights summing to 1.00, largest gap 0.5 (rounding):

| Weight | Risk dimensions |
|---|---|
| 10% | Operational Resilience, Financial Health, Quality |
| 8% | Compliance |
| 6% | Credit Rating, Safety Incidents, Sub-Tier Visibility |
| 5% | Geopolitical, Governance, ESG |
| 4% | Environmental Exposure, Labor Stability, Digital Security, Political Stability, Industry Benchmark |
| 3% | Market Sentiment, Media Sentiment, External Intelligence |

So *"why is this supplier risky?"* gets an exact answer — a waterfall of score × weight — not a guess.

**2. Averages lie.** **182 suppliers** look Low or Medium overall but carry two or more Critical risks. SWITCHYARD flags them everywhere and uses them to challenge the buyer's choice.

**3. A tool that argues back.** The Challenge step runs six deterministic checks on the pick (hidden risk, robustness under five priority lenses, improvement over the supplier being replaced, delivery performance, sourcing risk, lowest risk on the shortlist) and re-ranks live as priorities change. The official index is never altered — re-weighting is a lens, clearly labelled.

**4. Real-world evidence that can change the decision.** The research agent plans its own searches, flags red flags, follows the serious ones deeper, and scores the real company on the **same 18 dimensions** — every score linked to a source, blank where nothing was found. *Apply evidence* then computes an **evidence-adjusted risk score next to the official one** under strict rules:
- only adverse, verified findings move a score, and only upward;
- only events **after the data's as-of date** count — older ones are listed as history, never counted twice;
- weight depends on severity, recency, whether it's still ongoing, and source credibility (regulators and filings fully, reputable press partly, social media and law-firm ads never) — decided in code from the domain;
- a separate check, *"No active credible high-severity red flag"*, catches what an average would hide.

**5. Numbers you can trust.** The language model never computes a number. All math lives in one deterministic engine shared by the screen and the assistant; the model chooses tools and explains their output, and charts in the chat are rendered from the tool results themselves. Research citations must be URLs that actually came back from search.

---

## How it works

```
Browser (Next.js)
 ├─ all 10,000 suppliers loaded once → instant filter, rank, re-weight
 ├─ decision state: replace target, shortlist, pick, challenge, evidence, memo, audit log
 └─ Triage · Narrow · Compare · Challenge · Verify · Decide  +  Ask SWITCHYARD

Server (Next.js on Railway)
 ├─ /api/chat      tool-calling assistant → lib/tools.ts → lib/engine.ts
 ├─ /api/research  research agent (web search), streams each step live
 ├─ /api/critique  devil's-advocate summary of the computed checks
 ├─ /api/memo      executive summary from computed facts
 └─ middleware.ts  jury login (HTTP Basic Auth)
```

**AI models** — all on **Nebius Token Factory**: NVIDIA **Nemotron 3.5 Super VL** for the assistant, red-flag assessment, shadow scoring, critique and memo; **Nemotron 3.5 Lightning** for fast research planning. Web search via **Tavily**.

| Path | Purpose |
|---|---|
| `data/` | Original dataset, criteria description, one cached research run |
| `lib/schema.ts` | Risk dimensions, recovered weights, level bands |
| `lib/engine.ts` | Score breakdown, hidden risk, filters, ranking, robustness, evidence adjustment |
| `lib/challenge.ts` | The six challenge checks + the red-flag check |
| `lib/sources.ts`, `lib/dates.ts` | Source credibility tiers and event-date parsing (deterministic) |
| `lib/research.ts` | Research agent loop |
| `lib/tools.ts` | Assistant tools and result cards |
| `scripts/` | Data build, cache refresh, and checks for the evidence math and date parsing |

**Stack:** Next.js 15 · TypeScript · Tailwind v4 · Recharts · Zustand · Nebius Token Factory (OpenAI-compatible) · Tavily · Railway.

---

## Run locally

```bash
pnpm install
cp .env.example .env.local   # add your Nebius Token Factory and Tavily keys
pnpm dev                     # builds the supplier data, then http://localhost:3000
```

Checks: `pnpm tsx scripts/check-evidence.ts` · `pnpm tsx scripts/check-dates.ts`
Refresh the cached research run: `pnpm tsx --env-file=.env.local scripts/cache-research.ts "Knorr-Bremse" http://localhost:3000`
Deploy: `railway up --service web`

---

## Honest limits

- The dataset has no component categories, capacity, prices, qualification status or countries. SWITCHYARD therefore recommends **candidates for qualification**, never "switch now", and the memo lists the open checks.
- The dataset is anonymised. Linking a real company to a dataset supplier in *Apply evidence* is the buyer's assumption, and the app says so.
- The shadow profile comes from public evidence, not an internal assessment; it shows its coverage and confidence, and calibrating it against known suppliers is the natural next step.
