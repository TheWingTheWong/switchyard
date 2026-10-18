// Runs the live research agent against a running dev server and caches the full event stream.
// Usage: pnpm tsx --env-file=.env.local scripts/cache-research.ts [company] [baseUrl]
// (lib/llm.ts imports "server-only", which only resolves inside Next — so we go through /api/research.)
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { ResearchEvent } from "../lib/research-types";

const company = process.argv[2] ?? "Knorr-Bremse";
const base = process.argv[3] ?? "http://localhost:3100";
const auth = process.env.JURY_USER ? "Basic " + Buffer.from(`${process.env.JURY_USER}:${process.env.JURY_PASS ?? ""}`).toString("base64") : undefined;

async function main() {
  const t0 = Date.now();
  const res = await fetch(`${base}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify({ company }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const events: ResearchEvent[] = [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as ResearchEvent;
      events.push(ev);
      const t = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`${t}s ${ev.type}`, ev.type === "status" || ev.type === "error" ? ev.text : ev.type === "redflag" ? `[${ev.flag.severity}] ${ev.flag.title}` : ev.type === "search" || ev.type === "dig" ? `${ev.query} (${ev.results.length})` : "");
    }
  }
  const report = events.find((e) => e.type === "report");
  if (!report) throw new Error("No report event — not caching.");
  const out = path.join(process.cwd(), "data", "cache", `${company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ events }, null, 1));
  console.log(`Cached ${events.length} events -> ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => { console.error(e); process.exit(1); });
