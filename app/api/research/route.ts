import { readFile } from "node:fs/promises";
import path from "node:path";
import { runResearch } from "@/lib/research";
import type { ResearchEvent } from "@/lib/research-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CACHE_FILE = path.join(process.cwd(), "data", "cache", "knorr-bremse.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function* replayCached(): AsyncGenerator<ResearchEvent> {
  const raw = JSON.parse(await readFile(CACHE_FILE, "utf8")) as { events: ResearchEvent[] };
  for (const ev of raw.events) {
    await sleep(ev.type === "report" ? 300 : 150);
    if (ev.type === "report") yield { ...ev, report: { ...ev.report, cached: true } };
    else yield ev;
  }
}

function ndjson(gen: AsyncGenerator<ResearchEvent>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of gen) controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        controller.enqueue(enc.encode(JSON.stringify({ type: "error", text: `Research failed: ${msg}` } satisfies ResearchEvent) + "\n"));
      } finally {
        controller.close();
      }
    },
    cancel() { void gen.return(undefined); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { company?: string; cached?: boolean };
  if (body.cached) return ndjson(replayCached());
  const company = (body.company ?? "").toString().trim();
  if (!company) return Response.json({ error: "company required" }, { status: 400 });
  return ndjson(runResearch(company));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("cached") === "1") return ndjson(replayCached());
  return Response.json({ error: "POST {company} or GET ?cached=1" }, { status: 400 });
}
