# SWITCHYARD — 2-minute demo video

## Before recording

- Browser 1440×900, zoom 110%, Chrome profile with no extensions visible, bookmarks bar hidden.
- Open https://web-production-109233.up.railway.app and log in (jury credentials) **before** you start, so the auth dialog never appears on camera.
- Clean state: on the Decide page, click "Start a new decision" (or run `localStorage.clear()` in the console) and reload.
- Pre-warm the LLM once: in chat ask "Why is the Total Risk Index of SUPP_00018 so high?" then click "clear".
- Record each scene as its own clip. Voice-over recorded separately, captions on.
- Verify: use **Load cached run** for the take (it replays a real Knorr-Bremse run in ~4 s and is labeled "cached"). If you have time, record a live "Run research" take too (~20–25 s, speed it up 2× in the edit) and use that instead.

## Shot list

| Time | Scene | Exact actions on screen | Voice-over |
|---|---|---|---|
| 0:00–0:12 | **Cold open — the threat** | Triage page. Hold on the KPI row, then move the cursor to the right card: `SUPP_09733 Advanced Systems 379`, `87 Critical`, `€50.0M`. Slowly hover the waterfall: Financial Health `100×0.10 = 10.0`. | "A train has tens of thousands of parts. This supplier holds fifty million euros of our orders — and its financial risk just hit one hundred." |
| 0:12–0:28 | **The search** | Click **Find alternatives →**. In Quick filters click **Proven at scale: PO ≥ €10M, TRI ≤ 49, confirmation ≥ 97%** — header reads `10,000 → 20`. Click **Add top 20 to shortlist**. Shortlist column fills, rail shows `Shortlist 20/20`. | "We need an alternative that can carry real volume. Ten thousand suppliers — narrowed to twenty proven partners in seconds." |
| 0:28–0:48 | **Seeing clearly** | Click **Compare shortlist (20) →**. Pan the heatmap. In the chat panel click the suggestion **"Why is the Total Risk Index of SUPP_00018 so high?"** — the answer appears with the inline waterfall card (Operational Resilience 9.5 pts, Compliance 7.8 pts…). | "Every risk score breaks down to the exact point. The brief called the index a weighted average without weights — we recovered them from the data, exactly. No black box, and the AI never makes up a number." |
| 0:48–1:12 | **The twist** | In the heatmap, on row `SUPP_09414 Apex Technologies 927` (TRI 38, Conf. 100, €19.6M, tagged HIDDEN RISK) click **Pick**. Click **Challenge my pick (SUPP_09414) →**. Hold on: `FAIL No hidden risk behind the average — Market Sentiment 84, Media Sentiment 81 despite a Medium TRI of 38`, `#1 in 0 of 5 priority scenarios`. Click the **Financial stability** and **Delivery reliability** presets (the ranking reshuffles, ▲▼ arrows). Click **Argue against my pick** and let the Nemotron critique appear. Click **Switch pick to SUPP_07967**. | "The familiar choice looks safe: medium score, near-perfect order confirmation, twenty million already with us. SWITCHYARD disagrees. Averages lie — 182 suppliers hide critical risk behind a calm score. Under every priority we test, a different supplier wins." |
| 1:12–1:35 | **Into the real world** | Click **Verify a real company →**. Company field shows `Knorr-Bremse`. Click **Load cached run** (or **Run research**). The agent log streams: PLAN with 7 queries → SEARCH → RED FLAG `[HIGH] Antitrust no-poach settlement…` → DIG DEEPER ×3 → report. Scroll to the shadow profile radar + the table with a source link per dimension and greyed "no evidence found" rows. | "Then a real company. The agent plans its own research, follows red flags deeper, and scores the company on the same eighteen dimensions — every score linked to a source, and blank where there is no evidence." |
| 1:35–1:52 | **Resolution** | Click **6. Decide** in the rail. Click **Generate memo** — executive summary appears. Scroll: why act, shortlist, pick waterfall, challenges, external evidence with links, open qualification checks, audit log. Click **Print / PDF** (show the print preview for one second). | "The decision — with its reasons, its risks and its evidence — ready for review. A candidate for qualification, not a blind switch." |
| 1:52–2:00 | **Title card** | Black text on white: **SWITCHYARD** · "The AI procurement decision room" · Nemotron on Nebius · Tavily | "Every supplier has a score. Every decision needs a reason." |

## Final voice-over script (read continuously, ~265 words)

> A train has tens of thousands of parts. This supplier holds fifty million euros of our orders — and its financial risk just hit one hundred.
>
> We need an alternative that can carry real volume. Ten thousand suppliers — narrowed to twenty proven partners in seconds.
>
> Every risk score breaks down to the exact point. The brief called the index a weighted average without weights — we recovered them from the data, exactly. No black box, and the AI never makes up a number.
>
> The familiar choice looks safe: medium score, near-perfect order confirmation, twenty million already with us. SWITCHYARD disagrees. Averages lie — 182 suppliers hide critical risk behind a calm score. Under every priority we test, a different supplier wins.
>
> Then a real company. The agent plans its own research, follows red flags deeper, and scores the company on the same eighteen dimensions — every score linked to a source, and blank where there is no evidence.
>
> The decision — with its reasons, its risks and its evidence — ready for review. A candidate for qualification, not a blind switch.
>
> Every supplier has a score. Every decision needs a reason.

## Backup plan

- LLM slow during recording → the waterfall, challenge checks and memo sections are all computed without the LLM; record those and add the AI parts from a second take.
- Research slow → **Load cached run** (it is honestly labeled "Cached run from … replayed (not live)").
