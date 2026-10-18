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
| 0:12–0:26 | **The search** | Click **Find alternatives →**. In Quick filters click **Proven at scale: PO ≥ €10M, TRI ≤ 49, confirmation ≥ 97%** — header reads `10,000 → 20`. Click **Add top 20 to shortlist**. Shortlist column fills, rail shows `Shortlist 20/20`. | "We need an alternative that can carry real volume. Ten thousand suppliers — narrowed to twenty proven partners in seconds." |
| 0:26–0:44 | **Seeing clearly** | Click **Compare shortlist (20) →**. Pan the heatmap. In the chat panel click the suggestion **"Why is the Total Risk Index of SUPP_00018 so high?"** — the answer appears with the inline waterfall card (Operational Resilience 9.5 pts, Compliance 7.8 pts…). | "Every risk score breaks down to the exact point. The brief called the index a weighted average without weights — we recovered them from the data, exactly. No black box, and the AI never makes up a number." |
| 0:44–1:06 | **The twist** | In the heatmap, on row `SUPP_09414 Apex Technologies 927` (TRI 38, Conf. 100, €19.6M, tagged HIDDEN RISK) click **Pick**. Click **Challenge my pick (SUPP_09414) →**. Hold on: `FAIL No hidden risk behind the average — Market Sentiment 84, Media Sentiment 81 despite a Medium TRI of 38`, `#1 in 0 of 5 priority scenarios`. Click the **Financial stability** and **Delivery reliability** presets (the ranking reshuffles, ▲▼ arrows). Click **Argue against my pick** and let the Nemotron critique appear. Click **Switch pick to SUPP_07967**. | "The familiar choice looks safe: medium score, near-perfect order confirmation, twenty million already with us. SWITCHYARD disagrees. Averages lie — 182 suppliers hide critical risk behind a calm score. Under every priority we test, a different supplier wins." |
| 1:06–1:36 | **Into the real world → evidence moves the number** | Click **Verify a real company →**. Company field shows `Knorr-Bremse`. Click **Load cached run**. The agent log streams: PLAN → SEARCH → RED FLAG → DIG DEEPER ×3 → report (speed up 2× in the edit). Scroll past the shadow profile (points only where there is evidence) to **Apply evidence to SUPP_07967**. Hover the assumption line ("Assumption: SUPP_07967 is Knorr-Bremse"). Click **Apply evidence to SUPP_07967**: headline `Official TRI 10 → Evidence-adjusted 11 ▲1`. Pan the table: Financial Health counted (2026, company newsroom, tier 1); the 2018 no-poach case and the 2024 recalls listed as *before data as-of date*; Governance *unverified*; ESG *source tier 3*. Cut to **4 Challenge** in the rail: banner **"Evidence applied — pick still holds"**, `Official 10 → Evidence-adjusted 11`. | "Then a real company. The agent plans its own research, follows red flags deeper, and scores it on the same eighteen dimensions. Now we let that evidence touch the decision — under strict rules. Only what's new since the scores were made, from credible sources, may move a number. The 2018 antitrust case is history. A company report from this year counts. Ten becomes eleven, the official index stays untouched — and our pick holds." |
| 1:36–1:52 | **Resolution** | Click **6. Decide** in the rail. Click **Generate memo** — executive summary appears (it names both numbers and the assumption). Scroll: why act, shortlist, pick waterfall, challenges, external evidence with the **External evidence adjustment** block, open qualification checks, audit log. Click **Print / PDF** (show the print preview for one second). | "The decision — with its reasons, its risks and its evidence — ready for review. A candidate for qualification, not a blind switch." |
| 1:52–2:00 | **Title card** | Black text on white: **SWITCHYARD** · "The AI procurement decision room" · Nemotron on Nebius · Tavily | "Every supplier has a score. Every decision needs a reason." |

## Final voice-over script (read continuously, ~270 words)

> A train has tens of thousands of parts. This supplier holds fifty million euros of our orders — and its financial risk just hit one hundred.
>
> We need an alternative that can carry real volume. Ten thousand suppliers — narrowed to twenty proven partners in seconds.
>
> Every risk score breaks down to the exact point — we recovered the index's hidden weights from the data. No black box, and the AI never makes up a number.
>
> The familiar choice looks safe: medium score, near-perfect confirmation, twenty million already with us. SWITCHYARD disagrees. Averages lie — 182 suppliers hide critical risk behind a calm score.
>
> Then a real company. The agent plans its own research, follows red flags deeper, and scores it on the same eighteen dimensions. Now we let that evidence touch the decision — under strict rules. Only what's new since the scores were made, from credible sources, may move a number. The 2018 antitrust case is history; a company report from this year counts. Ten becomes eleven, the official index stays untouched — and our pick holds.
>
> The decision — with its reasons, its risks and its evidence — ready for review. A candidate for qualification, not a blind switch.
>
> Every supplier has a score. Every decision needs a reason.

## Note on the evidence line

The brief for this feature suggested the line *"Internal data says six. The real world says otherwise."* With today's cached Knorr-Bremse run, that would not be true: the demo pick SUPP_07967 moves 10 → 11, and SUPP_00609 moves only 6 → 7. The script above uses the numbers the app actually shows. If a fresh research run produces a bigger move, update the line to match the screen, never the other way round.

## Backup plan

- LLM slow during recording → the waterfall, challenge checks and memo sections are all computed without the LLM; record those and add the AI parts from a second take.
- Research slow → **Load cached run** (it is honestly labeled "Cached run from … replayed (not live)").
