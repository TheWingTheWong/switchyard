import { complete } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are a sceptical senior procurement reviewer challenging a buyer's supplier pick for rail rolling stock.
You receive facts computed by a deterministic engine. Use ONLY numbers present in the facts; never compute new ones.
Write 3–5 short sentences of plain text (no markdown): the strongest argument against the pick, what the pick does well, and what must be checked before qualification.
The data has no component, capacity, price or country information — the pick is a candidate for qualification, not a switch decision.`;

export async function POST(req: Request) {
  const facts = await req.json();
  try {
    const text = await complete(SYSTEM, JSON.stringify(facts));
    return Response.json({ text });
  } catch (e) {
    console.error("critique error", (e as Error).message);
    return Response.json({ text: null, error: true });
  }
}
