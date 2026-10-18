// Hand-computed checks for the evidence adjustment. Run: pnpm tsx scripts/check-evidence.ts
// today = 2026-10-18, as-of = 2025-10-18, every internal score 20, official TRI 20.
// factor = severity (0.6/0.35/0.15) × confidence (1/0.85/0.6) × recency × status × source tier (1/0.7/0.35/0)
import { evidenceAdjust, assessFlag, eventPeriodEnd, recencyFactor, type EvidenceInput, type FlagInput } from "../lib/engine";
import { sourceTier } from "../lib/sources";
import type { Supplier } from "../lib/schema";

const today = new Date("2026-10-18T12:00:00Z");
const AS_OF = "2025-10-18";
const NHTSA = "https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E048-6886.pdf";
const s: Supplier = { id: "TEST", name: "Test", tri: 20, s: Array(18).fill(20), po: 1, chg: 0, del: 100, conf: 100, src: "Low", cx: "Simple" };
let fail = 0;
const expect = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(`${ok ? "ok  " : "FAIL"} ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };

const recall: FlagInput = { title: "Brake chamber recall", severity: "high", dimension: "safety", eventDate: "2025-12", status: "ongoing", url: NHTSA };
const ev: EvidenceInput[] = [
  { key: "financial", score: 80, confidence: "high", url: "https://newsroom.knorr-bremse.com/a" },                       // positive only → 20
  { key: "safety", score: 70, confidence: "high", url: NHTSA, flags: [recall] },                                          // .6×1×1×1×1 = .6 → 20+30 = 50
  { key: "quality", score: 60, confidence: "medium", url: NHTSA, flags: [recall] },                                      // group: .6×.85 = .51 → 20+20.4 = 40
  { key: "compliance", score: 90, confidence: "high", url: NHTSA, flags: [{ title: "2018 settlement", severity: "high", dimension: "compliance", eventDate: "2018", status: "resolved", url: "https://www.justice.gov/x" }] }, // history
  { key: "labor", score: 80, confidence: "high", url: null, flags: [{ title: "LinkedIn post", severity: "high", dimension: "labor", eventDate: "2026-03", status: "ongoing", url: "https://www.linkedin.com/posts/x" }] }, // blocked
  { key: "governance", score: 80, confidence: "high", url: null, flags: [{ title: "Unrated news", severity: "high", dimension: "governance", eventDate: "2026-03", status: "ongoing", url: "https://example-news.net/a" }] }, // .6×.35 = .21 → 32.6 → 33
  { key: "esg", score: 80, confidence: "high", url: null, flags: [{ title: "Unverified claim", severity: "high", dimension: "esg", eventDate: "2026-03", status: "ongoing", url: NHTSA, unverified: true }] }, // unverified
  { key: "digital", score: 0, confidence: "high", url: NHTSA, flags: [{ title: "Cyber incident", severity: "high", dimension: "digital", eventDate: "2026-04", status: "ongoing", url: NHTSA }] }, // never down → 20
  { key: "operational", score: 80, confidence: "high", url: null, flags: [{ title: "Plant halt", severity: "medium", dimension: "operational", eventDate: "2026-01", status: "ongoing", url: "https://www.reuters.com/a", supportUrls: [NHTSA] }] }, // corroborated → tier 1: .35 → 41
  { key: "geopolitical", score: 80, confidence: "high", url: null, flags: [{ title: "Sanctions case", severity: "high", dimension: "geopolitical", eventDate: "2026-02", status: "resolved", url: NHTSA }] }, // .6×.5 = .3 → 38
  { key: "credit", score: 70, confidence: "low", url: null, flags: [{ title: "Downgrade", severity: "high", dimension: "credit", eventDate: "2026-05", status: "ongoing", url: "https://www.reuters.com/b" }] }, // .6×.6×.7 = .252 → 32.6 → 33
];
const a = evidenceAdjust(s, ev, AS_OF, today, "Knorr-Bremse");
const r = Object.fromEntries(a.rows.map((x) => [x.key, x]));
expect("positive evidence → no change", r.financial.adjusted, 20);
expect("positive evidence reason", r.financial.reason, "no adverse evidence — positive evidence never raises risk");
expect("recall high/ongoing/2025/nhtsa.gov → counted", r.safety.counted, true);
expect("recall moves safety", r.safety.adjusted, 50);
expect("safety ↔ quality group moves quality", r.quality.adjusted, 40);
expect("2018 resolved → history", r.compliance.reason, "before data as-of date — likely already reflected");
expect("2018 unchanged", r.compliance.adjusted, 20);
expect("linkedin → 0 (blocked)", [r.labor.counted, r.labor.adjusted], [false, 20]);
expect("unrated → 0.35", [r.governance.tierFactor, r.governance.adjusted], [0.35, 33]);
expect("unverified → 0", [r.esg.counted, r.esg.reason], [false, "unverified — not counted"]);
expect("never moves down", r.digital.adjusted, 20);
expect("corroboration → best tier (1)", [r.operational.sourceTier, r.operational.adjusted], ["1", 41]);
expect("resolved halves", r.geopolitical.adjusted, 38);
expect("low confidence × tier 2", r.credit.adjusted, 33);
expect("no evidence untouched", r.environmental.adjusted, 20);
// TRI = 20 + .06×30 + .10×20 + .05×13 + .10×21 + .05×18 + .06×13 = 28.23 → 28
expect("adjusted TRI", a.adjustedTri, 28);
expect("active credible high flags", a.activeHighFlags.map((f) => f.title).sort(), ["Brake chamber recall", "Cyber incident", "Downgrade"]);
expect("zero evidence keeps official TRI", evidenceAdjust(s, [], AS_OF, today).adjustedTri, 20);

// Dates
expect("year-only overlapping as-of counts", assessFlag({ ...recall, eventDate: "2025" }, AS_OF, today).counted, true);
expect("month fully before as-of → history", assessFlag({ ...recall, eventDate: "2025-09" }, AS_OF, today).counted, false);
expect("period end of 2025-03", eventPeriodEnd("2025-03")?.toISOString().slice(0, 10), "2025-03-31");
expect("recency <1y", recencyFactor(new Date("2026-01-01"), today), 1);
expect("recency 1–3y", recencyFactor(new Date("2024-06-01"), today), 0.5);
expect("recency 3–5y", recencyFactor(new Date("2022-06-01"), today), 0.25);
expect("recency >5y", recencyFactor(new Date("2018-06-01"), today), 0);
expect(">5y flag not counted (as-of moved back)", assessFlag({ ...recall, eventDate: "2018" }, "2010-01-01", today).reason, "older than 5 years");
expect("unknown date → recency 0.25", assessFlag({ ...recall, eventDate: null }, AS_OF, today).recency, 0.25);

// Source tiers (decided in code)
expect("nhtsa.gov → tier 1", sourceTier(NHTSA), "1");
expect("vehiclerecalls.gov.au → tier 1", sourceTier("https://www.vehiclerecalls.gov.au/x"), "1");
expect("ir.* → tier 1", sourceTier("https://ir.knorr-bremse.com/x"), "1");
expect("eqs-news.com → tier 1", sourceTier("https://www.eqs-news.com/x"), "1");
expect("company domain → tier 1", sourceTier("https://newsroom.knorr-bremse.com/x", "Knorr-Bremse"), "1");
expect("vitallaw.com → tier 2", sourceTier("https://www.vitallaw.com/x"), "2");
expect("linkedin.com → blocked", sourceTier("https://linkedin.com/in/x"), "blocked");
expect("hausfeld.com → blocked", sourceTier("https://www.hausfeld.com/x"), "blocked");
expect("unknown domain → unrated", sourceTier("https://example-news.net/a"), "unrated");

console.log(fail ? `${fail} FAILED` : "all passed");
process.exit(fail ? 1 : 0);
