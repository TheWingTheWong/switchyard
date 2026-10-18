# The SWITCHYARD story

*Read this once before you present. It's meant to let you talk about every part of the project in your own words.*

---

## 1. The buyer and the €50 million supplier

Picture a procurement lead at a rolling-stock manufacturer. A train has tens of thousands of parts, and every one of them comes from a supplier the company has to trust for years.

One morning a dashboard turns red. Supplier **SUPP_09733, "Advanced Systems 379"**, has a Total Risk Index of **87 out of 100**. That's Critical. The company has **€50 million** in purchase orders with it, the largest volume in the whole dataset. Its financial health score is **100**, the worst possible, and labor, sub-tier visibility and media sentiment are all in the 90s.

The buyer has to act, but acting badly is worse than waiting. Replacing a train supplier means qualification, audits, first-article inspection and months of work. If the replacement turns out to be the next problem, the company has spent that effort for nothing.

So the real question isn't "who has the lowest score?". It's **"which alternative can I defend, and why?"** That's the question SWITCHYARD answers.

## 2. What everyone else would build, and why we didn't

The obvious build for this brief is a table with filters plus a chatbot bolted on the side. You ask "who's risky?" and an LLM summarises a spreadsheet. That's useful, but it has two problems.

1. **It can't explain itself.** The brief says the Total Risk Index is "a weighted average of all risk categories" and gives no weights. So every "why is this supplier risky?" answer turns into the LLM guessing.
2. **It doesn't help make the decision.** Ranking is the easy part. The hard part is narrowing down, comparing, stress-testing your own choice, checking the real world, and writing it all up so someone else can review it.

So we built a **decision room**, not a dashboard. It's six steps (Triage, Narrow, Compare, Challenge, Verify, Decide) and each step hands its output to the next. A grounded chat assistant sits on every page.

## 3. The discovery: we recovered the formula

Before writing any UI we looked hard at the data: 10,000 suppliers, 46 columns, no nulls. If the TRI really is a weighted average of the 18 sub-scores, a linear regression of TRI on those 18 scores should recover the weights.

It did, almost perfectly. **R² = 0.9996**, the weights sum to **1.00**, and after applying them the largest gap to the reported TRI over all 10,000 rows is **0.5**, which is simply rounding to whole numbers.

- **0.10:** Operational Resilience, Financial Health, Quality Risk
- **0.08:** Compliance Risk
- **0.06:** Credit Rating, Safety Incident, Sub-Tier Visibility
- **0.05:** Geopolitical, Governance, ESG
- **0.04:** Environmental Exposure, Labor Stability, Digital Security, Political Stability, Industry Benchmark
- **0.03:** Market Sentiment, Media Sentiment, External Intelligence

The weights make domain sense. Operations, money and quality matter most, and sentiment matters least.

**Why it matters:** every risk score in SWITCHYARD can be broken down to the exact point. Take the brief's own question, "Why is the TRI of SUPP_00018 so high?". The answer isn't a vibe. It's a waterfall: Operational Resilience 95 × 0.10 = **9.5 points**, Compliance 98 × 0.08 = **7.8 points**, Quality 74 × 0.10 = **7.4 points**, and so on, adding up to 80. The small difference from the reported TRI is shown on screen and labelled as rounding.

## 4. The twist: averages lie

Once you know the TRI is an average, the next question asks itself: what can an average hide?

A lot, it turns out. **182 suppliers** have an overall TRI that reads Low or Medium but **two or more sub-scores in the Critical band (≥ 75)**. A buyer sorting by TRI would happily shortlist them. We call these **hidden-risk suppliers**, and they drive the demo's turning point.

Our definition is simple and stated openly: *TRI level is Low or Medium, AND at least two of the 18 sub-scores are Critical.*

## 5. The six steps, and how each one feeds the next

**1. Triage: "Where is our money at risk?"**
The app opens on the whole portfolio: 10,000 suppliers, **€20.4bn** in purchase orders, **€10.3bn** risk-weighted exposure (TRI/100 × PO volume), **€833M** placed with the 384 suppliers at Critical TRI, and the 182 hidden-risk suppliers. The top-10 exposure table puts SUPP_09733 first. Its card shows the exact waterfall of why it's risky. That supplier becomes the **supplier to replace**, which every later step knows about.

**2. Narrow: "10,000 → 20."**
A filter panel covers *every* column: range filters on any of the 18 scores, TRI levels, delivery rating, confirmation rate, order change rate, PO volume, sourcing risk, supply-chain complexity, and a hidden-risk toggle. The supplier being replaced is excluded automatically. Results sort on any metric. For the demo we use one quick filter, **"Proven at scale": PO ≥ €10M, TRI ≤ 49, confirmation ≥ 97%**. It returns exactly 20 suppliers, which are added to the shortlist. That matches the brief's limit of up to 20.

**3. Compare: "Seeing clearly."**
The shortlist appears as a heatmap: suppliers × 18 scores (columns ordered by weight) plus operational metrics. The supplier being replaced is pinned on top as a reference. Three callouts show **where the candidates differ most** (the dimensions with the biggest spread, with best and worst supplier). Click a row to get its exact TRI waterfall. Tick rows to overlay them on a radar. Here the buyer **picks** a candidate.

**4. Challenge: "SWITCHYARD disagrees."**
This is the step nobody else builds. The tool tries to talk the buyer out of their pick, using only deterministic checks:
- Is there **hidden risk** behind the average?
- Is the pick **robust**? We re-rank the shortlist under five priority lenses (Official TRI, Financial stability, Delivery reliability, Compliance & ESG, Geopolitical resilience) and count how often the pick wins.
- Is it clearly better than the supplier being replaced (≥ 20 TRI points)?
- Delivery and confirmation ≥ 90%? Not itself hard to replace? Lowest TRI on the shortlist?

In the demo the buyer picks **SUPP_09414**, a familiar-looking supplier with a Medium TRI of 38, 99.7% order confirmation and nearly €20M already placed with it. The challenge fails it on hidden risk (**Market Sentiment 84, Media Sentiment 81**), and it ranks **#1 in 0 of 5 scenarios**. **SUPP_07967** (TRI 10) wins all five, and one click switches the pick. Presets and custom weight sliders re-rank live with ▲▼ arrows. A Nemotron "devil's advocate" then writes a short critique based only on the computed check results.

We are careful about one thing here: **re-weighting is our lens, not the official index.** The official TRI is never changed. The operational metrics we fold into the "Delivery reliability" preset aren't part of the TRI, and the UI says so.

**5. Verify: "Into the real world."**
The dataset is anonymised, but procurement happens with real companies. You type a real company name (we use **Knorr-Bremse**, the rail-brake maker, to fit the brake-system storyline) and a research agent goes to work, streaming every step to a live log:
1. **Plan.** It identifies the exact legal entity and writes ~7 search queries, one per risk group (financial, legal/compliance, labor, safety/recalls, ESG, cyber, geopolitical/sanctions).
2. **Search.** It runs them through Tavily in parallel batches.
3. **Assess.** It flags red flags with a severity, a risk dimension and a source URL.
4. **Dig deeper.** It takes the top medium- and high-severity flags and runs follow-up searches, then re-assesses with what it finds. This is the visible moment where the agent takes initiative.
5. **Shadow profile.** It scores the real company on the **same 18 dimensions** as the dataset. Each score carries a confidence level and a source link. Where nothing was found it says "no evidence found" and shows the row greyed out, never guessed. The shadow profile is overlaid on the radar against the dataset supplier, and its TRI-equivalent is computed by *our engine* with the official weights, renormalised over the dimensions that have evidence. The coverage percentage is shown.
6. **Report.** Summary, red flags, verified facts vs unverified claims, every source, and the research timestamp.

A live run takes about **20–25 seconds** (Knorr-Bremse: 10 searches, 44 sources, 3 red flags followed up). One full run is cached as a demo fallback, and when it's used the UI labels it clearly as "Cached run from … replayed (not live)".

**6. Decide: "A decision someone else can review."**
The memo puts it all together: why we act (the waterfall of the supplier being replaced), the shortlist, the pick and its waterfall, which challenges it passed or failed, the external evidence with links, **open qualification checks**, and an audit log of every step the buyer took. Nemotron writes only the executive summary, from a facts object we hand it. Print → PDF.

**The chat panel** runs alongside every step. It knows the current shortlist and pick. It answers with tool calls and shows the results as **inline cards** (tables, waterfalls), so the numbers come from the engine and the text only explains them.

## 6. How we keep the AI honest

This is the design principle we'd defend hardest: **the LLM never computes a number.**

- All the math (decomposition, filtering, ranking, re-weighting, robustness, hidden risk, exposure, percentiles) lives in one file, `lib/engine.ts`. The browser and the server share it, so the table you see and the chatbot's answer come from the same code.
- The chat model (Nemotron on Nebius) gets **tools**, not data: `getSupplier`, `compareSuppliers`, `explainScore`, `filterSuppliers`, `hiddenRiskScan`, `getShortlist`, `addToShortlist`, `glossary`. The system prompt forbids numbers that didn't come from a tool result.
- Tool results are shown as cards built **from the tool output itself**. Even if the prose were wrong, the card underneath would be right.
- The model is told what the data **can't** answer. Ask "Can SUPP_00731 replace SUPP_09733 for brake pads?" and it says plainly that the dataset has no component, capacity, price, qualification or country data. It then offers what the data can say: a lower-risk profile, as a candidate for qualification.
- The research agent can only cite URLs that actually came back from search. A red flag or shadow score pointing at any other URL is dropped. Empty evidence means an empty score.
- If the LLM fails, the chat still shows the computed card, and every challenge check and memo section still works without it.

We verified the brief's two example questions against the engine. **"Which of SUPP_00012, SUPP_00450 and SUPP_00731 has the lowest financial risk?"** → **SUPP_00731** (Financial Health 53, vs 54 and 65). **"Why is SUPP_00018's TRI so high?"** → TRI 80, with the exact contributors listed above and 11 of 18 dimensions Critical.

## 7. Tech choices and why

- **Next.js + TypeScript, one codebase.** UI and API share the engine and types, so there's no drift between what the screen shows and what the chatbot says.
- **Client-side engine over all 10,000 rows.** The dataset ships as a ~2 MB JSON file. Filtering, re-weighting and robustness run instantly in the browser, with no round-trips. The server uses the same functions for the chat tools.
- **Nemotron on Nebius Token Factory** (`nvidia/Nemotron-3.5-Super-VL`). It has reliable tool calling and is fast (~1–2 s per chat turn), and it runs on NVIDIA's own model on Nebius infrastructure, which is the point of this hackathon. For structured steps (research planning, assessment, shadow scoring) we switch off the thinking phase. That took a research run from about 60 s to about 23 s and made the JSON reliable. We also wrote a bracket-balanced JSON extractor, because the model sometimes repeats its answer.
- **Tavily** for search. It's built for agents and returns clean snippets and URLs, which lets us validate every citation.
- **Railway**, not serverless. The research agent streams for 20–60 seconds, and a long-running Node server has no function timeout to fight. We deployed in the first hour and redeployed after every block.
- **Deliberately plain black-and-white UI.** Risk levels are shades of grey *plus* a text label, so color is never the only signal. All design tokens live in one CSS block, so the visual layer can be restyled in one pass.

## 8. What we'd build next

1. **Component mapping.** Join the supplier master with commodity codes and parts lists, so "who else can make brake pads?" becomes answerable and the shortlist is filtered by capability, not just risk.
2. **Live monitoring.** Run the research agent on a schedule for the top-exposure suppliers and alert when a shadow score moves or a new high-severity flag appears.
3. **Calibrating the shadow profile.** Run the agent on suppliers whose internal scores we know, then learn the mapping from web evidence to the internal scale.
4. **ERP integration.** Pull PO volumes and delivery performance live from SAP and push the decision memo into the sourcing workflow as an approval document.
5. **Team decisions.** Several reviewers, comments on the memo, and a sign-off trail.

## 9. Likely judge questions, with short answers

**"Did you just make up the weights?"**
No. We recovered them by linear regression over all 10,000 rows: R² 0.9996, weights sum to 1.00, and the largest gap after rounding is 0.5. The app shows the gap on every waterfall.

**"How do you stop the LLM from hallucinating numbers?"**
It never produces them. Every number comes from a deterministic engine through tool calls, and the chat renders the tool output itself as a card. The model only chooses tools and explains the results.

**"What is 'hidden risk' exactly?"**
TRI level Low or Medium with at least two sub-scores at Critical (≥ 75). There are 182 such suppliers. An average of 18 numbers can look calm while two of them are on fire.

**"Isn't re-weighting just changing the official score?"**
No. The official TRI is never touched. Presets are lenses that test whether a pick is robust: "would you still choose this supplier if financial stability mattered more?" The UI labels this clearly.

**"Why should I trust the research agent?"**
Every red flag and every shadow score must cite a URL that actually came back from search, or it's dropped. Dimensions without evidence stay empty instead of being guessed. The report separates verified facts from unverified claims and timestamps the run.

**"Does it work for any company or only Knorr-Bremse?"**
Any company. Knorr-Bremse is cached as a demo fallback. We also tested Alstom live: 10 searches, 46 sources, 10 red flags (including the FCPA settlement and a hydrogen-train recall), followed up in about 24 seconds.

**"Can it tell me which supplier to switch to?"**
It tells you which suppliers are **candidates for qualification**, and why. The dataset has no component, capacity, price or country data, so a responsible tool doesn't say "switch now". The memo lists exactly what still has to be checked.

**"Where's NVIDIA / Nemotron in this?"**
Every AI step: the chat's tool-calling loop, research planning, red-flag assessment, dig-deeper re-assessment, shadow-profile scoring, the devil's-advocate critique and the memo summary. All of it runs on Nemotron via Nebius Token Factory.

**"What was the hardest part?"**
Making the agent reliable rather than impressive once. That meant turning off the thinking phase for structured steps, extracting JSON robustly, validating every URL, keeping a time and search budget, and having an honest cached fallback.

**"How would Siemens actually use this?"**
As the place where a sourcing decision gets made and recorded. You start from exposure, narrow and compare, let the tool challenge your choice, check the real company, and leave with a memo a manager or auditor can review.

---

*One line to finish on:* **Every supplier has a score. Every decision needs a reason.**
