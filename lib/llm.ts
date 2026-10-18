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
