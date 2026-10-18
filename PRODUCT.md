# Product

SWITCHYARD — the AI procurement decision room. Built for the Nebius × NVIDIA Build Week hackathon (Berlin, 18 Oct 2026), Siemens track "Supplier Risk Intelligence for rolling stock". Tagline: "Every supplier has a score. Every decision needs a reason."

## Platform

web

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 (tokens in `app/globals.css` `:root` + `@theme inline`) · Recharts · Zustand · fonts via `next/font` (currently Inter + JetBrains Mono). Deployed on Railway behind HTTP Basic Auth.

## Users

1. Hackathon judges (primary, today): technical and business jurors from Siemens, Nebius and NVIDIA. They see the app in a 2-minute video and possibly a live demo. Scoring is 50% technical execution, 30% creativity/wow, 20% fit to the brief.
2. Rail procurement buyers and category managers (the users in the story): they are experienced and numerate, they decide under audit pressure, and they work at desktop screens with dense data.

## Product Purpose

A buyer must replace a risky supplier (default case: SUPP_09733, Total Risk Index 87, €50M purchase-order volume). SWITCHYARD walks them through six steps, each handing its output to the next: Triage (where is money at risk) → Narrow (10,000 → ≤20 shortlist) → Compare (heatmap, radar, exact TRI waterfall) → Challenge (the tool argues against the buyer's pick with deterministic checks) → Verify (a research agent investigates a real company on the web, with sources) → Decide (an auditable decision memo, printable). A grounded chat panel is present on every step.

## Positioning

It is a decision room, not a dashboard. Every risk score is decomposed exactly, because the TRI weights were recovered from the data. "Averages lie": 182 suppliers hide Critical sub-scores behind a calm average. The AI never computes numbers; it chooses tools and explains their results.

## Operating Context

The app runs on desktop at 1440×900 with browser zoom 110%, which is how the demo video is recorded. It works with dense tabular data: 20 suppliers × 18 scores in a heatmap. Long sessions. The memo must print cleanly to PDF. Mobile is not required.

## Capabilities and Constraints

- All math is in `lib/engine.ts` and `lib/challenge.ts`. Logic, data, API routes and store must not change during visual work.
- Button labels are used by the video script (VIDEO.md) and a click-through test, so keep their text.
- Risk levels are Low 0–24, Medium 25–49, High 50–74 and Critical 75–100. Any color encoding must be paired with a text label.
- Recharts animations stay off (`isAnimationActive={false}`).
- Hard deadline today (submission ~17:30). Redesign time budget ~60–75 minutes, code-first, one direction.

## Brand Commitments

None pinned: no logo, no brand palette. Phase 1 was deliberately plain black-and-white as a placeholder and is NOT a brand to preserve. The tone should be serious, precise, trustworthy and calm under pressure, with a distinct point of view. It must not read as a generic SaaS template. The subject world is rail and rolling stock, industrial procurement, and audit.

## Evidence on Hand

STORY.md (full narrative), README.md, VIDEO.md (shot list and exact clicks), plan.md (original plan), data/ (the dataset and the criteria description). The live app runs at http://localhost:3000 (dev) and on Railway.

## Product Principles

1. Every number is traceable to data. Show the math, not just the verdict.
2. Honest limits. The data has no component, capacity, price or country information, so the app recommends "candidates for qualification" and never says "switch now".
3. The tool challenges the user instead of flattering them.
4. Hierarchy over decoration. The one number or decision that matters on each screen must be obvious.

## Accessibility & Inclusion

Never use color alone for risk; always pair it with a text label. Keep sufficient contrast for dense tables. Use tabular numerals for figures. Keep keyboard focus visible on interactive elements.
