import type OpenAI from "openai";
import { llm, MODEL, stripThink } from "@/lib/llm";
import { runTool, TOOL_DEFS, type Card, type ChatContext } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are SWITCHYARD, a procurement risk analyst for a rail rolling-stock buyer. You answer questions about a dataset of 10,000 suppliers.

Rules:
- EVERY number you state must come from a tool result in this conversation. Never compute, estimate or invent numbers yourself. Always call a tool first.
- Cite supplier IDs (SUPP_xxxxx). Risk scores: 0 = no risk, 100 = maximum risk. So "lowest financial risk" = lowest Financial Health score.
- The Total Risk Index (TRI) is an exact weighted sum of 18 sub-scores (weights recovered from the data). For "why is X high", call explainScore and name the top contributing dimensions with their points.
- The data has NO component categories, product types, capacity, prices, qualification status or countries. If asked about those (e.g. "can X supply brake pads"), say clearly the data cannot answer that, and offer what it can: comparable risk profiles as candidates for qualification. Never say "switch now".
- Tool results are shown to the user as cards/tables right below your text, so don't repeat whole tables. Keep answers short: 2–5 sentences, plain text, no markdown tables.`;

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function POST(req: Request) {
  const { messages, context } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[]; context: ChatContext };
  const ctx: ChatContext = { shortlist: context?.shortlist ?? [], pickId: context?.pickId ?? null, replaceId: context?.replaceId ?? "SUPP_09733" };
  const convo: Msg[] = [
    { role: "system", content: `${SYSTEM}\n\nCurrent state: supplier to replace ${ctx.replaceId}; shortlist ${ctx.shortlist.length ? ctx.shortlist.join(", ") : "(empty)"}; buyer's pick ${ctx.pickId ?? "(none)"}.` },
    ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content }) as Msg),
  ];
  const cards: Card[] = [];
  const toolsUsed: string[] = [];

  try {
    for (let step = 0; step < 5; step++) {
      const res = await llm.chat.completions.create({
        model: MODEL, messages: convo, tools: TOOL_DEFS, tool_choice: "auto", temperature: 0.1, max_tokens: 900,
      });
      const msg = res.choices[0].message;
      if (!msg.tool_calls?.length) {
        return Response.json({ text: stripThink(msg.content), cards, toolsUsed });
      }
      convo.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* empty args */ }
        const { result, card } = runTool(call.function.name, args, ctx);
        toolsUsed.push(call.function.name);
        if (card) cards.push(card);
        convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    return Response.json({ text: "Here is what the data shows.", cards, toolsUsed });
  } catch (err) {
    // Fallback: show tool results alone if the LLM fails mid-way.
    console.error("chat error", (err as Error).message);
    return Response.json({ text: cards.length ? "The language model is unavailable; here are the computed results." : "The language model is unavailable right now. Please try again.", cards, toolsUsed, error: true });
  }
}
