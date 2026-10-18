// Date parser + per-flag source-tier checks. Run: pnpm tsx scripts/check-dates.ts
import { eventDateFromText, normalizeEventDate } from "../lib/dates";
import { assessFlag, evidenceAdjust, type EvidenceInput } from "../lib/engine";
import type { Supplier } from "../lib/schema";

let fail = 0;
const expect = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(`${ok ? "ok  " : "FAIL"} ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };

expect("25E048", eventDateFromText("Part 573 Safety Recall Report 25E048"), "2025");
expect("24V-559", eventDateFromText("NHTSA campaign 24V-559 air brake"), "2024");
expect("2:18-cv-00469", eventDateFromText("Carruth v. Knorr-Bremse, No. 2:18-cv-00469 (W.D. Pa.)"), "2018");
expect("December 2025", eventDateFromText("Recalls … December 2025"), "2025-12");
expect("NHTSA URL", eventDateFromText("https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E048-6886.pdf"), "2025");
expect("plain year", eventDateFromText("2025 safety recall of brake chambers"), "2025");
expect("nothing → null", eventDateFromText("Brake chamber recall", "https://example.com/a"), null);
expect("LLM 2025-12-04", normalizeEventDate("2025-12-04"), "2025-12");
expect("LLM December 2025", normalizeEventDate("December 2025"), "2025-12");
expect("LLM garbage", normalizeEventDate("recently"), null);

// Tier comes from the flag's own url + supportUrls, never from the dimension's shadow URL.
const today = new Date("2026-10-18T12:00:00Z"), AS_OF = "2025-10-18";
const s: Supplier = { id: "T", name: "T", tri: 20, s: Array(18).fill(20), po: 1, chg: 0, del: 100, conf: 100, src: "Low", cx: "Simple" };
const carruth = { title: "Carruth v. Knorr-Bremse no-poach", severity: "high" as const, dimension: "compliance" as const, eventDate: "2026-01", status: "ongoing" as const, url: "https://www.classaction.org/news/x" };
const ev: EvidenceInput[] = [{ key: "compliance", score: 90, confidence: "high", url: "https://www.federalregister.gov/d/x", flags: [carruth] }];
const r = evidenceAdjust(s, ev, AS_OF, today, "Knorr-Bremse").rows.find((x) => x.key === "compliance")!;
expect("classaction.org flag not lifted to tier 1 by shadow URL", [r.sourceTier, r.counted], ["blocked", false]);
const recall = { title: "Brake chamber recall", severity: "high" as const, dimension: "safety" as const, eventDate: "2025", status: "unknown" as const, url: "https://www.thebrakereport.com/x" };
expect("recall alone → tier 2", assessFlag(recall, AS_OF, today, "Knorr-Bremse").tier, "2");
expect("recall + nhtsa support → tier 1", assessFlag({ ...recall, supportUrls: ["https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E048-6886.pdf"] }, AS_OF, today, "Knorr-Bremse").tier, "1");
expect("Carruth dated 2018 → history", assessFlag({ ...carruth, url: "https://www.justice.gov/x", eventDate: eventDateFromText("2:18-cv-00469") }, AS_OF, today).reason, "before data as-of date — likely already reflected");

console.log(fail ? `\n${fail} FAILED` : "\nall ok");
process.exit(fail ? 1 : 0);
