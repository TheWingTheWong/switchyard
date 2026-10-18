import "server-only";
import OpenAI from "openai";

// Nemotron on Nebius Token Factory (OpenAI-compatible API).
export const llm = new OpenAI({
  apiKey: process.env.NEBIUS_API_KEY,
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
});

export const MODEL = process.env.LLM_MODEL ?? "nvidia/Nemotron-3.5-Super-VL";
export const MODEL_FAST = process.env.LLM_MODEL_FAST ?? MODEL;

/** Strip <think>…</think> reasoning blocks some Nemotron variants emit. */
export function stripThink(s: string | null | undefined): string {
  return (s ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** Extract the first JSON object/array from an LLM reply. */
export function parseJson<T>(s: string): T | null {
  const t = stripThink(s).replace(/```(?:json)?/g, "");
  const start = t.search(/[[{]/);
  if (start < 0) return null;
  const open = t[start], close = open === "{" ? "}" : "]";
  const end = t.lastIndexOf(close);
  try { return JSON.parse(t.slice(start, end + 1)) as T; } catch { return null; }
}

/** One-shot prose completion (thinking disabled for speed). */
export async function complete(system: string, user: string, maxTokens = 600): Promise<string> {
  const res = await llm.chat.completions.create({
    model: MODEL, temperature: 0.2, max_tokens: maxTokens,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    ...({ chat_template_kwargs: { enable_thinking: false } } as object), // Nebius/vLLM extension
  });
  return dedupeSentences(stripThink(res.choices[0].message.content));
}

/** Nemotron occasionally repeats its whole answer; cut at the restart and drop repeated sentences. */
function dedupeSentences(t: string): string {
  const head = t.slice(0, 24);
  const again = head.length === 24 ? t.indexOf(head, 24) : -1;
  if (again > 0) t = t.slice(0, again);
  const seen = new Set<string>();
  return t.split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => { const k = x.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; })
    .join(" ");
}
