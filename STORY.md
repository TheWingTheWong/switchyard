# SWITCHYARD: the story

*Every supplier has a score. Every decision needs a reason.*

Read this once, slowly, and you'll be able to talk about any part of the project without notes. It follows the order the project actually happened in. Each part sets up the next, the same way each screen in the app hands its result to the next one.

---

## Prologue: eight doors, one choice

On the morning of 18 October 2026, at the Nebius × NVIDIA hackathon in Berlin, there were eight challenges to choose from: an NVIDIA agentic challenge built around the Britannica encyclopaedia, deep research with Tavily, SAP's autonomous bug fixing, healthcare paper discovery, sim-to-real robotics, media generation, and Siemens' **Supplier Risk Intelligence for rolling stock**.

We picked Siemens for three reasons.

1. **The data was already there.** 10,000 suppliers and 46 columns, with no infrastructure to set up first. Every hour went into the product instead.
2. **It already had a story in it.** A buyer, a risky supplier, a field of 10,000 to choose from, and a decision to make. Building something people can follow is easier when the problem already has a beginning, a middle and an end.
3. **The rubric rewards exactly this.** Judging is 50% technical execution, 30% creativity, 20% fit to the brief. A track where we can execute cleanly *and* do something nobody expects is the best bet.

We also knew what we were up against. Every team has the same CSV, the same brief and the same AI coding tools, so most of them would build the same thing. Meeting the brief would only get us in the door. We had to win on something else.

---

## Act I: The problem

A train is made of tens of thousands of parts, and each part comes from a supplier the manufacturer has to trust for years.

Picture a procurement lead at a rolling-stock manufacturer. One morning a supplier turns red. **SUPP_09733, "Advanced Systems 379"**, has a Total Risk Index of **87 out of 100**, which is Critical. The company has **€50 million** of purchase orders with it, the most in the whole dataset. Its financial-health risk is **100**, the worst possible. Labor stability is 99, sub-tier visibility 96, media sentiment 90.

The buyer has to act. But in rail, acting badly is worse than waiting. Replacing a supplier means qualification, audits, first-article inspection and months of work. If the replacement becomes the next problem, all of that was wasted.

So the real question isn't *"who has the lowest score?"* It's **"which alternative can I defend, and why?"**

That's the question SWITCHYARD answers.

---

## Act II: The temptation

The obvious build for this brief is a big table with filters, plus a chatbot next to it. You ask "who's risky?" and an AI summarizes a spreadsheet. That's useful, and it's what most teams will show.

It has two weaknesses, though, and our whole project is built on them.

**It can't explain itself.** The brief says the Total Risk Index is *"a weighted average of all risk categories"* and never gives the weights. So when a buyer asks *"why is this supplier's risk so high?"*, every other tool has to guess. The AI says something that sounds plausible, and nobody can check it.

**It doesn't help make the decision.** Ranking is the easy part. The hard part is narrowing the field, comparing honestly, questioning your own choice, checking the real world, and writing it up so someone else can review it.

So we decided early: **we're building a decision room, not a dashboard.**

---

## Act III: The discovery

Before writing any interface, we looked hard at the data.

If the Total Risk Index really is a weighted average of the 18 risk scores, then every supplier gives us one equation: *TRI = w₁ × score₁ + w₂ × score₂ + … + w₁₈ × score₁₈*. There are 18 unknown weights and **10,000 equations**. A linear regression, the simplest tool in statistics, finds the weights that fit all 10,000 at once.

They came out almost perfectly:

- **R² = 0.9996**, meaning the formula explains 99.96% of the index.
- The weights **sum to exactly 1.00**, as a true weighted average should.
- The biggest gap across all 10,000 suppliers is **0.5**, which is just rounding to whole numbers.

| Weight | Risk scores |
|---|---|
| **10%** | Operational Resilience, Financial Health, Quality |
| **8%** | Compliance |
| **6%** | Credit Rating, Safety Incidents, Sub-Tier Visibility |
| **5%** | Geopolitical, Governance, ESG |
| **4%** | Environmental Exposure, Labor Stability, Digital Security, Political Stability, Industry Benchmark |
| **3%** | Market Sentiment, Media Sentiment, External Intelligence |

The weights also make business sense. Whether a supplier can operate, pay its bills and deliver quality matters most. What people are saying about it matters least.

**Why this changes everything:** every risk score in SWITCHYARD can now be broken down exactly. Take the brief's own example, *"Why is the Total Risk Index of SUPP_00018 so high?"* We don't answer with a guess. We show a waterfall chart: Operational Resilience 95 × 10% = **9.5 points**, Compliance 98 × 8% = **7.8 points**, Quality 74 × 10% = **7.4 points**, and so on down to a total of **80**. The tiny difference from the reported score is shown on screen and labelled as rounding. The UI never hides anything.

> **Say it like this:** "The brief called the index a weighted average but didn't give the weights. We recovered them from the data, exactly. So every risk score in our app breaks down to the point, and the AI never has to guess."

---

## Act IV: The twist: averages lie

Once you know the index is an average, an obvious question follows: **what can an average hide?**

Quite a lot. **182 suppliers** have an overall score that reads Low or Medium, so they look calm, but they have **two or more individual risks in the Critical band (75+)**. A buyer sorting by overall score would put them on a shortlist without a second thought.

We call them **hidden-risk suppliers**, and they set up the turning point of the demo. The definition is simple and stated openly: *overall level is Low or Medium, and at least two of the 18 scores are Critical.*

Another example the chat finds on its own: **52 suppliers** look Low or Medium overall but have Critical financial health. These are companies that could go bankrupt while looking fine on the dashboard.

> **Say it like this:** "An average of eighteen numbers can look calm while two of them are on fire. 182 suppliers in this dataset do exactly that."

---

## Act V: The journey through the product

The whole app is one decision carried through six steps. A rail across the top shows them, **Triage → Narrow → Compare → Challenge → Verify → Decide**, with a check mark as each one is done. It also shows the live context: who we're replacing, how full the shortlist is, and who we picked. Each step hands its output to the next. You can jump around freely; the rail guides you but doesn't lock you in.

### Step 1: Triage. *"Where is our money at risk?"*
**What you see:** the whole portfolio at a glance. 10,000 suppliers. **€20.4 billion** in purchase orders. **€10.3 billion** risk-weighted exposure (each supplier's risk ÷ 100 × its order volume). **€833 million** placed with the 384 Critical suppliers. The 182 hidden-risk suppliers. A top-10 table of where money is most exposed, with SUPP_09733 at number one, and its waterfall explaining exactly why.
**What it hands on:** *the supplier to replace.*

### Step 2: Narrow. *"10,000 → 20."*
**What you see:** a filter panel that covers *every* column. You can set a range on any of the 18 scores and filter on risk levels, delivery rating, order confirmation rate, order change rate, order volume, sourcing risk, supply-chain complexity, plus a "hidden risk only" toggle. The supplier being replaced is excluded automatically. The demo uses one quick filter, **"Proven at scale": order volume ≥ €10M, risk ≤ 49, confirmation ≥ 97%**. It returns exactly **20 suppliers**, which is the brief's limit.
**What it hands on:** *a shortlist of up to 20.*

### Step 3: Compare. *"Seeing clearly."*
**What you see:** a heatmap with the 20 suppliers as rows and the 18 risks as columns, ordered by weight, plus the delivery metrics. The supplier being replaced is pinned on top as a reference. Three callouts show **where the candidates differ most**: the dimensions with the biggest spread, naming the best and worst supplier on each. Click a row to see its exact waterfall. Tick several rows to overlay them on a radar chart. This is where the buyer **picks** a candidate.
**What it hands on:** *the buyer's pick.*

### Step 4: Challenge. *"SWITCHYARD disagrees."*
This is the step nobody else builds. The tool **tries to talk the buyer out of the pick**. It runs six checks, all plain math with no AI guessing:

1. **No hidden risk behind the average**: no individual score at Critical.
2. **Holds up under other priorities**: we re-rank the shortlist under five lenses (Official TRI, Financial stability, Delivery reliability, Compliance & ESG, Geopolitical resilience). The pick must come first in at least half of them.
3. **Clearly better than the supplier being replaced**: at least 20 points lower risk.
4. **Delivers reliably**: delivery rating and confirmation rate both ≥ 90%.
5. **Not itself hard to replace**: sourcing risk isn't High.
6. **Lowest official risk on the shortlist**, or if not, which supplier is.

**The demo moment:** the buyer picks **SUPP_09414, "Apex Technologies 927"**. It looks like the safe, familiar choice: Medium risk of 38, **99.7%** order confirmation, and nearly **€20 million** already placed with it. SWITCHYARD stamps it **CHALLENGED**. Behind the calm average are Critical **Market Sentiment (84)** and **Media Sentiment (81)**, and it comes **#1 in 0 of 5** priority scenarios. **SUPP_07967, "Strategic Industries 337"** (risk 10, 98.1% confirmation, €14.5M volume) wins all five. One click switches the pick.

The preset buttons and custom weight sliders re-rank the shortlist instantly, with ▲▼ arrows showing who moved. Then **"Argue against my pick"** has Nemotron write a short devil's-advocate critique, using only the computed check results.

**One thing we're careful about:** re-weighting is *our lens*, not the official index. The official risk score is never changed. The delivery metrics folded into the "Delivery reliability" lens aren't part of the official index, and the UI says so.
**What it hands on:** *which checks the pick passed or failed.*

### Step 5: Verify. *"Into the real world."*
The dataset is anonymized, but real procurement happens with real companies. The buyer types a real company name (we use **Knorr-Bremse**, the rail-brake maker) and a research agent takes over. → *Its full story is in Act VII.*
**What it hands on:** *external evidence with sources.*

### Step 6: Decide. *"A decision someone else can review."*
**What you see:** a decision memo that brings everything together. It covers why we act (the waterfall of the supplier being replaced), the shortlist, the pick and its waterfall, which challenges it passed or failed, external evidence with links, **open qualification checks**, and an **audit log** of every step the buyer took, with timestamps. Nemotron writes only the executive summary, from facts we hand it. The memo carries a stamp that reads **CANDIDATE FOR QUALIFICATION**, and it prints cleanly to PDF.

### The chat that runs alongside everything
On every page there's an **Ask SWITCHYARD** panel. It knows the current shortlist and pick. It answers in about 2–3 seconds, and it doesn't just reply in text: it shows **cards** with tables and waterfall charts, built from the computed results.

---

## Act VI: Keeping the AI honest

This is the principle we'd defend hardest in front of any judge: **the AI never calculates a number.**

How it works:

- **All the math lives in one place**, `lib/engine.ts`, with the challenge checks in `lib/challenge.ts`. That covers score breakdowns, filters, rankings, re-weighting, robustness, hidden risk, exposure and percentiles. The browser and the server run *the same file*. The numbers on screen and the numbers in the chatbot's answer come from the same code, so they can't disagree.
- **The AI gets tools, not data.** The chat model has eight tools: `getSupplier`, `compareSuppliers`, `explainScore`, `filterSuppliers`, `hiddenRiskScan`, `getShortlist`, `addToShortlist`, `glossary`. It decides *which* tool to call. Our code runs it and hands back the result. The AI then explains that result in plain words. Its instructions forbid stating any number that didn't come from a tool.
- **The cards come from the tool output, not from the AI's text.** Even if the AI phrased something badly, the table or chart underneath would still be correct.
- **It knows what the data can't answer.** Ask *"Can SUPP_00731 replace SUPP_09733 for brake pads?"* and it says plainly that the dataset has no product, capacity, price, qualification or country information. Then it offers what the data *can* say: a lower-risk profile, as a candidate for qualification.
- **It degrades gracefully.** If the AI service fails, the chat still shows the computed card. Every challenge check and memo section still works without the AI.

**Verified today on the live site:**
- *"Which of SUPP_00012, SUPP_00450 and SUPP_00731 has the lowest financial risk?"* → **SUPP_00731** (53, vs 54 and 65). Correct. 2 seconds.
- *"Why is the Total Risk Index of SUPP_00018 so high?"* → **80, Critical, 98th percentile**, with the exact point contributions and 11 of 18 dimensions Critical. Correct. 2 seconds.
- *"Can SUPP_00731 replace SUPP_09733 for brake pads?"* → it said clearly that the data can't answer, then gave the honest risk comparison. 3 seconds.

---

## Act VII: The research agent: into the real world

The brief asked for an agent that *"plans its research, crawls news, public sources and company sites, digs deeper when it finds red flags and delivers a risk report with source links."* Ours does exactly that, and every step streams live into a log on screen so you can watch it think:

1. **Plan.** It identifies the exact legal entity and writes about 7 search queries, one per risk area: financial, legal/compliance, labor, safety/recalls, ESG, cyber, geopolitical/sanctions.
2. **Search.** It runs them through **Tavily**, a search engine built for AI agents, in parallel.
3. **Assess.** It reads the results and raises **red flags**, each with a severity (low/medium/high), the risk area, and the source link.
4. **Dig deeper.** This is the moment the agent takes initiative. It picks the **top 3 medium- or high-severity flags** and runs follow-up searches on its own, then re-assesses, reporting only *new or escalated* issues.
5. **Shadow profile.** This is our original idea. It scores the real company on **the same 18 dimensions as the dataset**. Each score carries a confidence level and a source link. Where nothing was found, it says **"no evidence found"** and the row is greyed out, never guessed. The real company is then overlaid on the same radar chart as the dataset suppliers. Our engine (not the AI) computes its risk-index equivalent using the official weights, counting only the dimensions that have evidence, and shows the coverage percentage.
6. **Report.** A summary, red flags, *verified facts kept separate from unverified claims*, every source, and the time the research was done.

**The guardrails:**
- **It can only cite links that actually came back from the search.** Any red flag or score pointing at another URL is dropped.
- **It has a budget:** at most 12 searches and 90 seconds, so it can't run forever.
- **It has an honest fallback.** One complete Knorr-Bremse run is saved. If the network is slow during a demo, "Load cached run" replays it in about 4 seconds, and the screen labels it clearly as *"Cached run … replayed (not live)."*

**Real runs:**
- **Knorr-Bremse:** 10 searches, 44 sources, 3 red flags followed up.
- **Alstom:** 10 searches, 46 sources, 10 red flags, including its FCPA bribery settlement and a hydrogen-train recall. About 24 seconds.
- **Siemens Mobility** (tested today on the live site): 26 seconds, 42 sources, 10 red flags, including halted train deliveries over weld-seam defects. *(See "Careful with" at the end before you ever run this one in front of Siemens.)*

> **Say it like this:** "The agent plans its own research, follows red flags deeper by itself, and scores the real company on the same eighteen dimensions as our data. Every score has a source, and where there's no evidence the score stays blank."

---

## Act VIII: The look: an inspection certificate

We built the app in plain black and white first, on purpose. Function came first, and every colour and font sat in one place so the look could be swapped later in a single pass. Then we redesigned it.

The visual idea comes from rail itself. **Every part of a train ships with an inspection certificate** (EN 10204 3.1): security paper, ruled form fields, blue-black ink, and an inspector's stamp that makes a result official. That's what a decision room should feel like. Every number is traceable, and the final output is a document someone signs.

- **Colours:** pale security-paper green as the background, near-white "form" sheets, blue-black ink for text, and one deep violet "stamp ink" for everything you can click. Risk colours (sage, ochre, orange, red) appear only where they show a risk level.
- **Fonts:** Archivo, with narrow uppercase captions like the field labels on a certificate. JetBrains Mono for every number, ID and score, so digits line up in columns.
- **The signature: the inspector's stamp.** A round rubber-stamp graphic appears only where a verdict is recorded: **CHALLENGED** or **HOLDS** in Challenge, **EVIDENCE** in Verify, and **CANDIDATE FOR QUALIFICATION** on the memo. It's the only animation in the app, a short "press" effect, and it switches off for users who prefer reduced motion.
- **The logo** is a railway turnout: one track splitting into two. That's what a switchyard does, and it's what a sourcing decision is.
- **Accessibility:** colour never carries meaning alone. Every risk level also prints its word, Critical cells are hatched as well as red, and there are no shadows or gradients.

---

## Act IX: The machine room, in plain words

| Piece | What it is | Why we chose it |
|---|---|---|
| **Next.js + TypeScript** | One codebase for the website and its server | The screen and the chatbot share the same math, so they never disagree |
| **Engine in the browser** | All 10,000 suppliers load once as a ~2 MB file | Filtering, re-ranking and slider changes are instant, with no waiting on a server |
| **Nemotron 3.5 Super VL** | NVIDIA's open model, running on **Nebius Token Factory** | Reliable tool calling and fast (~1–2 s per answer). It's NVIDIA's model on Nebius, which is the point of this hackathon. It powers every AI step: chat, research planning, red-flag assessment, digging deeper, shadow scoring, the critique and the memo summary |
| **"Thinking off" for structured steps** | Nemotron can reason at length before answering; for JSON steps we switch that off | One research run dropped from about 60 s to about 23 s, and the output became reliably well-formed |
| **Tavily** | A search API built for AI agents | Clean snippets plus URLs, which is what lets us check every citation |
| **Railway** | Hosting for an always-on server | Research streams for 20–60 s, and serverless hosting would have cut it off |
| **Password protection** | HTTP Basic Auth in front of the whole site | Jury login. The keys live only on the server, never in the code |
| **Zustand store** | The app's memory, saved in the browser | The shortlist, pick, research and audit log survive page changes and reloads |

**Key terms, in one line each:**
- **TRI (Total Risk Index):** the dataset's overall risk score from 0 to 100, where higher is worse.
- **Levels:** Low 0–24, Medium 25–49, High 50–74, Critical 75–100. The same bands apply to every score.
- **Exposure:** risk ÷ 100 × order volume, roughly "euros at risk."
- **Tool calling:** the AI asks our code to run a function and gets the real result back, instead of making the result up.
- **Linear regression / R²:** a way to find the weights that best fit all the data. R² of 0.9996 means a near-perfect fit.
- **Streaming (NDJSON):** the server sends the agent's steps one line at a time, so you watch the log grow live.

---

## Act X: The proof: what was checked before we submitted

On the afternoon of the hackathon, every claim in this document was checked against the raw data and the live site:

- Weights sum to **1.00**, and the largest gap from the official score is **0.5** (rounding).
- **€20.4bn** total orders, **€10.3bn** exposure, **€833M** with the **384** Critical suppliers, **182** hidden-risk suppliers.
- "Proven at scale" returns exactly **20** suppliers.
- SUPP_09414: risk 38, confirmation 99.7%, €19.6M, Critical Market Sentiment 84 and Media Sentiment 81. SUPP_07967: risk 10.
- Every page loads in under 0.6 s on the live site. Logins without the right password are blocked. Type checks and the build pass. The repo is public, contains the data, and has **no secrets** anywhere in its history.
- Chat, critique, memo, live research and cached research all work on the live site.

---

## Epilogue: what comes next

1. **Component mapping.** Join suppliers to parts and commodity codes, so "who else can make brake pads?" becomes answerable and the shortlist filters by capability, not only by risk.
2. **Live monitoring.** Run the research agent on a schedule for the most exposed suppliers, and alert when a shadow score moves or a new serious red flag appears.
3. **Calibrating the shadow profile.** Run the agent on suppliers whose internal scores we already know, and learn how web evidence maps onto the internal scale.
4. **ERP integration.** Pull order volumes and delivery performance live from SAP, and send the decision memo into the approval workflow.
5. **Team decisions.** Multiple reviewers, comments on the memo, and a sign-off trail.

---

# Your toolkit for presenting

## The 30-second pitch
> "Rail buyers choose suppliers for tens of thousands of parts, and every choice has to hold up for years. Most tools rank suppliers. SWITCHYARD helps you make a decision you can defend. We recovered the hidden formula behind the risk index, so every score breaks down exactly. We found that 182 suppliers hide critical risk behind a calm average, so the app challenges your pick instead of agreeing with you. A research agent checks the real company on the web with sources for every claim. You leave with a memo an auditor can read. The AI never makes up a number. Every supplier has a score. Every decision needs a reason."

## Live-demo talk track (if you make the 20:00 final)
1. **Triage:** "Fifty million euros with a supplier whose financial risk is a hundred. We have to act, but carefully."
2. **Narrow:** click *Proven at scale*. "Ten thousand to twenty proven partners in one click."
3. **Compare:** ask the chat *"Why is the Total Risk Index of SUPP_00018 so high?"* "Exact points. We recovered the formula."
4. **Challenge:** pick **SUPP_09414** → *Challenge my pick*. "It looks safe. SWITCHYARD disagrees. Averages lie." Show 0 of 5, then *Switch pick to SUPP_07967*.
5. **Verify:** Knorr-Bremse, then *Load cached run* (or *Run research* if the Wi-Fi is good). "It follows red flags on its own, and every score has a source."
6. **Decide:** *Generate memo*. "A candidate for qualification, not a blind switch." Finish with the tagline.

**Before going on stage:** log in ahead of time so the password prompt never appears on screen. Click "Start a new decision" for a clean state. Ask the chat one question beforehand to warm it up. Keep a second tab open on the same step as a backup.

## Judge questions and short answers

**"Did you make up the weights?"**
No. We recovered them by regression over all 10,000 rows: R² 0.9996, weights summing to 1.00, worst gap 0.5 from rounding. The app shows that gap on every waterfall.

**"How do you stop the AI from hallucinating numbers?"**
It never produces them. Every number comes from our engine through tool calls, and the chat shows the tool's own output as a card. The AI only chooses tools and explains results.

**"What exactly is hidden risk?"**
Overall level Low or Medium, with at least two individual scores Critical (75+). There are 182 of them.

**"Aren't you changing the official score when you re-weight?"**
No. The official index is never touched. The presets are lenses that test whether a pick still wins if, say, financial stability mattered more. The UI labels this clearly.

**"Why should I trust the research agent?"**
Every claim has to cite a URL that actually came back from the search, or it's dropped. Dimensions without evidence stay blank instead of being guessed. Verified facts and unverified claims are kept separate, and the run is timestamped.

**"Does it only work for Knorr-Bremse?"**
It works for any company. Knorr-Bremse is cached as a demo fallback. We ran Alstom and Siemens Mobility live as well.

**"Is the shadow profile directly comparable to the dataset scores?"**
It's on the same 18 dimensions and the same 0–100 scale, computed with the same weights, but it comes from public web evidence, not the internal assessment. That's why it shows its coverage and confidence. Calibrating it against known suppliers is our first next step.

**"Can it tell me which supplier to switch to?"**
It tells you which suppliers are **candidates for qualification**, and why. The data has no component, capacity, price or country information, so a responsible tool doesn't say "switch now". The memo lists exactly what still has to be checked.

**"Where's NVIDIA and Nebius in this?"**
Every AI step runs on Nemotron 3.5 Super VL through Nebius Token Factory: chat with tool calling, research planning, red-flag assessment, digging deeper, shadow scoring, the critique and the memo summary.

**"What was the hardest part?"**
Making the agent *reliable* rather than impressive once. That meant switching off Nemotron's thinking phase for structured steps, extracting JSON robustly, validating every URL, enforcing a search and time budget, and keeping an honestly labelled cached fallback.

**"How would Siemens actually use this?"**
As the place where a sourcing decision gets made *and* recorded. You start from exposure, narrow and compare, let the tool challenge your choice, check the real company, and leave with a memo a manager or auditor can sign off.

## Careful with

- **Don't research Siemens Mobility live in front of Siemens judges** unless you mean to. It works, but the first thing it surfaces is Siemens' own weld-seam delivery halt and a class-action lawsuit. Stick to Knorr-Bremse.
- **The cached run is labelled as cached.** If you use it, say so. Honesty is part of the pitch.
- **Never say "switch now" or "replacement".** Say **"candidate for qualification"**.
- **The re-weighting presets are lenses, not the official score.** Say that before anyone asks.

## The numbers to know by heart

| | |
|---|---|
| Suppliers / columns | **10,000 / 46** |
| Total orders / risk-weighted exposure | **€20.4bn / €10.3bn** |
| Critical suppliers / their orders | **384 / €833M** |
| Hidden-risk suppliers | **182** |
| Formula fit | **R² 0.9996, weights sum to 1.00, max gap 0.5** |
| Top weights | **Operational, Financial, Quality at 10% each** |
| Opening case | **SUPP_09733: risk 87, €50M, financial 100** |
| Demo pick → winner | **SUPP_09414 (38, hidden risk, 0/5) → SUPP_07967 (10, 5/5)** |
| Chat speed / research run | **~2–3 s / ~20–26 s** |
| Model | **Nemotron 3.5 Super VL on Nebius Token Factory** |

*One line to finish on:* **Every supplier has a score. Every decision needs a reason.**
