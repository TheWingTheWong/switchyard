import "server-only";
import OpenAI from "openai";

// Nemotron on Nebius Token Factory (OpenAI-compatible API).
export const llm = new OpenAI({
  apiKey: process.env.NEBIUS_API_KEY,
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1",
});

export const MODEL = process.env.LLM_MODEL ?? "nvidia/Nemotron-3.5-Super-VL";
export const MODEL_FAST = process.env.LLM_MODEL_FAST ?? MODEL;
/** Research reasoning steps (red-flag assessment, dig-deeper, shadow scoring). Defaults to MODEL: in an A/B on
 *  Knorr-Bremse, Nemotron-3-Ultra-550b-a55b was 10s slower, found fewer red flags and its shadow scores failed
 *  validation. Set LLM_MODEL_REASON to opt back in. */
export const MODEL_REASON = process.env.LLM_MODEL_REASON || MODEL;

/** Display name for the agent log: "nvidia/Nemotron-3_5-Lightning" → "Nemotron 3.5 Lightning". */
export function modelName(id: string): string {
  const n = id.split("/").pop() ?? id;
  if (/lightning/i.test(n)) return "Nemotron 3.5 Lightning";
  if (/ultra/i.test(n)) return "Nemotron 3 Ultra";
  if (/super-vl/i.test(n)) return "Nemotron 3.5 Super VL";
  return n.replace(/[-_]/g, " ");
}

/** Strip <think>…</think> reasoning blocks some Nemotron variants emit. */
export function stripThink(s: string | null | undefined): string {
  return (s ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/** Extract the first complete JSON object/array from an LLM reply (balanced-bracket scan, string-aware). */
export function parseJson<T>(s: string): T | null {
  const t = stripThink(s).replace(/```(?:json)?/g, "");
  for (let start = t.search(/[[{]/); start >= 0 && start < t.length; ) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        if (--depth === 0) {
          try { return JSON.parse(t.slice(start, i + 1)) as T; } catch { break; }
        }
      }
    }
    const next = t.slice(start + 1).search(/[[{]/);
    start = next < 0 ? -1 : start + 1 + next;
  }
  return null;
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
