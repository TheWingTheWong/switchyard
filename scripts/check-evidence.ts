// Hand-computed checks for evidenceAdjust. Run: pnpm tsx scripts/check-evidence.ts
import { evidenceAdjust, type EvidenceInput } from "../lib/engine";
import { sourceTier } from "../lib/sources";
import type { Supplier } from "../lib/schema";

const today = new Date("2026-10-18T12:00:00Z");
const NHTSA = "https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E048-6886.pdf"; // tier 1 → source factor 1.0
const s: Supplier = { id: "TEST", name: "Test", tri: 20, s: Array(18).fill(20), po: 1, chg: 0, del: 100, conf: 100, src: "Low", cx: "Simple" };
const ev: EvidenceInput[] = [
  { key: "financial", score: 80, confidence: "high", eventDate: "2026-03", status: "ongoing", url: NHTSA },   // 0.5×1×1 → 20+30 = 50
  { key: "quality", score: 60, confidence: "medium", eventDate: "2025-12", status: "resolved", url: NHTSA },  // 0.3×1×0.5 → 20+6 = 26
  { key: "compliance", score: 90, confidence: "high", eventDate: "2018", status: "resolved", url: NHTSA },    // before as-of → 20, not counted
  { key: "safety", score: 70, confidence: "high", eventDate: null, status: "ongoing", url: NHTSA },          // 0.5×0.25×1 → 26.25 → 26
  { key: "labor", score: 100, confidence: "high", eventDate: "2025-11", status: "ongoing", url: NHTSA },      // → 60
  { key: "digital", score: 0, confidence: "high", eventDate: "2026-05", status: "ongoing", url: NHTSA },     // → 10 (moves down too)
  { key: "esg", score: 50, confidence: null, eventDate: "2026-01", status: undefined, url: NHTSA },           // low 0.15 × 1 × unknown 0.75 → 20+3.375 → 23
];
let fail = 0;
const expect = (name: string, got: unknown, want: unknown) => { const ok = got === want; if (!ok) fail++; console.log(`${ok ? "ok  " : "FAIL"} ${name}: got ${got}, want ${want}`); };

const a = evidenceAdjust(s, ev, "2025-10-18", today);
const r = Object.fromEntries(a.rows.map((x) => [x.key, x]));
expect("recent ongoing high", r.financial.adjusted, 50);
expect("resolved halves", r.quality.adjusted, 26);
expect("pre-as-of not counted", r.compliance.counted, false);
expect("pre-as-of unchanged", r.compliance.adjusted, 20);
expect("unknown date → 0.25", r.safety.adjusted, 26);
expect("full move capped by trust", r.labor.adjusted, 60);
expect("evidence can lower risk", r.digital.adjusted, 10);
expect("unknown status/low conf", r.esg.adjusted, 23);
expect("no evidence untouched", r.operational.adjusted, 20);
// TRI = 20 + .10×30 + .10×6 + .06×6 + .04×40 + .04×(−10) + .05×3 = 25.31 → 25
expect("adjusted TRI", a.adjustedTri, 25);

const b = evidenceAdjust(s, [
  { key: "compliance", score: 90, confidence: "high", eventDate: "2018", status: "resolved", url: NHTSA },   // 8.3y → >5y → 0
  { key: "financial", score: 100, confidence: "high", eventDate: "2024-06", status: "ongoing", url: NHTSA }, // 2.4y → 0.5 → 0.25 → 40
  { key: "quality", score: 100, confidence: "high", eventDate: "2022-06", status: "ongoing", url: NHTSA },   // 4.4y → 0.25 → 0.125 → 30
], "2010-01-01", today);
const q = Object.fromEntries(b.rows.map((x) => [x.key, x]));
expect(">5y not counted", q.compliance.counted, false);
expect(">5y reason", q.compliance.reason, "older than 5 years");
expect("1–3y halves", q.financial.adjusted, 40);
expect("3–5y quarter", q.quality.adjusted, 30);
const c = evidenceAdjust({ ...s, s: Array(18).fill(98) , tri: 98 }, [{ key: "financial", score: 100, confidence: "high", eventDate: "2026-09", status: "ongoing", url: NHTSA }], "2025-10-18", today);
expect("clamp ≤ 100", c.rows.find((x) => x.key === "financial")!.adjusted, 99);
expect("zero adjustment keeps official TRI", evidenceAdjust(s, [], "2025-10-18", today).adjustedTri, 20);
const d = evidenceAdjust(s, [
  { key: "safety", score: 60, confidence: "high", eventDate: "2025", status: "ongoing", url: NHTSA },     // year-only, period ends after as-of → counted; age from mid-2025 = 1.3y → 0.5 → 20+10 = 30
  { key: "quality", score: 60, confidence: "high", eventDate: "2025-09", status: "ongoing", url: NHTSA }, // Sep 2025 ends before 18 Oct 2025 → not counted
], "2025-10-18", today);
const t = Object.fromEntries(d.rows.map((x) => [x.key, x]));
expect("year-only overlapping as-of counted", t.safety.adjusted, 30);
expect("month fully before as-of not counted", t.quality.counted, false);
// Source credibility (decided in code from the domain)
const base = { confidence: "high" as const, eventDate: "2026-06", status: "ongoing" as const, score: 80 };
const e = evidenceAdjust(s, [
  { key: "financial", ...base, url: NHTSA },                                                        // tier 1 → 0.5 → 50
  { key: "quality", ...base, url: "https://www.linkedin.com/posts/x" },                             // tier 3 → not counted
  { key: "compliance", ...base, url: NHTSA, unverified: true },                                     // unverified → not counted
  { key: "safety", ...base, url: "https://www.reuters.com/a" },                                     // tier 2 → 0.5×0.7 = 0.35 → 20+21 = 41
  { key: "labor", ...base, url: "https://www.reuters.com/a", supportUrls: ["https://www.ft.com/b"] }, // 2 tier-2 domains → max 0.7 → 41
  { key: "esg", ...base, url: "https://someblog.substack.com/p", supportUrls: ["https://www.justice.gov/c", "https://www.reuters.com/d"] }, // corroborated, best tier 1 → 50
  { key: "governance", ...base, url: "https://newsroom.knorr-bremse.com/x" },                       // company's own domain → tier 1 → 50
], "2025-10-18", today, "Knorr-Bremse");
const u = Object.fromEntries(e.rows.map((x) => [x.key, x]));
expect("nhtsa.gov tier", sourceTier(NHTSA), 1);
expect("nhtsa.gov factor 1.0", u.financial.tierFactor, 1);
expect("nhtsa.gov adjusted", u.financial.adjusted, 50);
expect("linkedin.com tier", sourceTier("https://linkedin.com/in/x"), 3);
expect("linkedin.com not counted", u.quality.counted, false);
expect("linkedin.com reason", u.quality.reason, "source tier 3 (linkedin.com) — not counted");
expect("unverified not counted", u.compliance.counted, false);
expect("unverified reason", u.compliance.reason, "unverified — not counted");
expect("tier 2 (reuters) 0.7", u.safety.adjusted, 41);
expect("two tier-2 domains stay 0.7", u.labor.adjusted, 41);
expect("corroborated → best tier", u.esg.adjusted, 50);
expect("company domain tier 1", u.governance.adjusted, 50);
console.log(fail ? `${fail} FAILED` : "all passed");
process.exit(fail ? 1 : 0);
