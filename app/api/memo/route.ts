import { complete } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You write the executive summary of a supplier decision memo for a rail rolling-stock procurement board.
Use ONLY the facts and numbers given; never compute or invent numbers. 4–6 sentences, plain text, no markdown, no headings.
Frame the pick as a candidate for qualification (the data has no component, capacity, price or country information), state why it was chosen, which challenges it survived or failed, what external evidence says, and the key open checks.
If an evidenceAdjustment is present, state both numbers (official TRI and evidence-adjusted TRI, as given), say the company link is the buyer's assumption, and that the official TRI is unchanged.`;

export async function POST(req: Request) {
  const facts = await req.json();
  try {
    return Response.json({ text: await complete(SYSTEM, JSON.stringify(facts), 500) });
  } catch (e) {
    console.error("memo error", (e as Error).message);
    return Response.json({ text: null, error: true });
  }
}
