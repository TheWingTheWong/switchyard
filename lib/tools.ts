import "server-only";
import type OpenAI from "openai";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDataset } from "./data-server";
import {
  compare, explainScore, exposure, filterSuppliers, hiddenRisk, level, normId, peerPercentile, round, sortBy,
  type FilterCriteria, type NumField,
} from "./engine";
import { LEVELS, SCORES, SCORE_KEYS, SHORTLIST_CAP, type ScoreKey, type Supplier } from "./schema";

// ---------- Cards rendered in the chat (generative UI). Numbers come from here, never from LLM prose. ----------
export type Card =
  | { type: "table"; title: string; columns: string[]; rows: (string | number)[][]; highlight?: string; note?: string }
  | { type: "waterfall"; id: string }
  | { type: "radar"; ids: string[] }
  | { type: "shortlist-add"; ids: string[] }
  | { type: "text"; title: string; body: string };

export interface ChatContext { shortlist: string[]; pickId: string | null; replaceId: string; }

const FIELDS = [...SCORE_KEYS, "tri", "po", "chg", "del", "conf", "exposure"] as const;
const FIELD_DOC = `Fields: tri (Total Risk Index), ${SCORES.map((s) => `${s.key} (${s.label})`).join(", ")}, po (purchase order volume EUR), chg (order change rate %), del (delivery rating %), conf (order confirmation rate %), exposure (TRI/100 × PO EUR). All risk scores 0=no risk, 100=max risk.`;

export const TOOL_DEFS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  fn("getSupplier", "Full risk profile of one supplier: all 18 scores with levels, TRI, ops metrics, hidden-risk flag, percentiles.", {
    id: { type: "string", description: "Supplier ID, e.g. SUPP_00012" },
  }, ["id"]),
  fn("compareSuppliers", "Compare 2–20 suppliers. Returns their scores and, for the focus field, which one is lowest/highest. Use for 'which of X, Y, Z has the lowest … risk'.", {
    ids: { type: "array", items: { type: "string" } },
    focus: { type: "string", enum: FIELDS, description: "Field to rank on. " + FIELD_DOC },
  }, ["ids"]),
  fn("explainScore", "Exact decomposition of a supplier's Total Risk Index: TRI = Σ score × weight over 18 dimensions (weights recovered from the data, R²=0.9996). Use for 'why is X's risk high'.", {
    id: { type: "string" },
  }, ["id"]),
  fn("filterSuppliers", "Search all 10,000 suppliers. Ranges are inclusive. " + FIELD_DOC + " Levels: Low 0–24, Medium 25–49, High 50–74, Critical 75–100.", {
    ranges: { type: "object", description: "Map field → {min?, max?}. e.g. {\"del\":{\"min\":95},\"tri\":{\"max\":29}}", additionalProperties: { type: "object", properties: { min: { type: "number" }, max: { type: "number" } } } },
    levels: { type: "object", description: "Map field (tri or a score key) → allowed levels, e.g. {\"tri\":[\"Low\"],\"financial\":[\"Critical\"]}", additionalProperties: { type: "array", items: { type: "string", enum: LEVELS } } },
    sourcing: { type: "array", items: { type: "string", enum: ["Low", "Medium", "High"] } },
    complexity: { type: "array", items: { type: "string", enum: ["Simple", "Moderate", "Complex"] } },
    hiddenRiskOnly: { type: "boolean", description: "Only suppliers whose TRI is Low/Medium but have ≥2 Critical sub-scores" },
    sortBy: { type: "string", enum: FIELDS },
    sortDir: { type: "string", enum: ["asc", "desc"] },
    limit: { type: "number", description: "Max rows (default 10, max 20)" },
  }, []),
  fn("hiddenRiskScan", "Find suppliers whose average (TRI) looks Low/Medium but which hide ≥2 Critical sub-scores. Optionally restrict to given ids (e.g. the shortlist).", {
    ids: { type: "array", items: { type: "string" } },
    limit: { type: "number" },
  }, []),
  fn("getShortlist", "The buyer's current shortlist, pick and supplier-to-replace.", {}, []),
  fn("addToShortlist", "Add suppliers to the buyer's shortlist (cap 20).", { ids: { type: "array", items: { type: "string" } } }, ["ids"]),
  fn("glossary", "Definition of a risk dimension or metric from the official criteria document.", { term: { type: "string" } }, ["term"]),
];

function fn(name: string, description: string, properties: Record<string, unknown>, required: string[]): OpenAI.Chat.Completions.ChatCompletionTool {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}

const fv = (s: Supplier, f: string) =>
  f === "tri" ? s.tri : f === "po" ? s.po : f === "chg" ? s.chg : f === "del" ? s.del : f === "conf" ? s.conf : f === "exposure" ? exposure(s) : s.s[SCORE_KEYS.indexOf(f as ScoreKey)];
const fieldLabel = (f: string) => SCORES.find((s) => s.key === f)?.label ?? ({ tri: "Total Risk Index", po: "PO volume EUR", chg: "Order change rate %", del: "Delivery rating %", conf: "Confirmation rate %", exposure: "Exposure EUR" } as Record<string, string>)[f] ?? f;

function summaryRow(s: Supplier) {
  const hr = hiddenRisk(s);
  return [s.id, s.name, s.tri, level(s.tri), s.s[1], hr.criticalDims.length, round(s.del, 1), round(s.po)];
}
const SUMMARY_COLS = ["ID", "Name", "TRI", "Level", "Financial", "# Critical", "Delivery %", "PO EUR"];

export function runTool(name: string, args: Record<string, unknown>, ctx: ChatContext): { result: unknown; card?: Card } {
  const ds = getDataset();
  const get = (id: unknown) => ds.byId.get(normId(String(id)));
  switch (name) {
    case "getSupplier": {
      const s = get(args.id);
      if (!s) return { result: { error: `Supplier ${args.id} not found` } };
      const hr = hiddenRisk(s);
      return {
        result: {
          id: s.id, name: s.name, tri: s.tri, triLevel: level(s.tri), triPercentile: peerPercentile(ds, s.tri, "tri"),
          scores: Object.fromEntries(SCORES.map((d, i) => [d.label, { score: s.s[i], level: level(s.s[i]) }])),
          ops: { poVolumeEUR: s.po, orderChangeRate: s.chg, deliveryRating: s.del, confirmationRate: s.conf, sourcingRiskLevel: s.src, supplyChainComplexity: s.cx, exposureEUR: round(exposure(s)) },
          hiddenRisk: { flag: hr.flag, criticalDims: hr.criticalDims.map((k) => fieldLabel(k)) },
        },
        card: { type: "table", title: `${s.id} · ${s.name}`, columns: ["Dimension", "Score", "Level", "Weight"], rows: [["Total Risk Index", s.tri, level(s.tri), "—"], ...SCORES.map((d, i) => [d.label, s.s[i], level(s.s[i]), d.weight])] },
      };
    }
    case "compareSuppliers": {
      const ids = ((args.ids as string[]) ?? []).map(normId);
      const list = ids.map((id) => ds.byId.get(id)).filter(Boolean) as Supplier[];
      const missing = ids.filter((id) => !ds.byId.has(id));
      if (list.length < 1) return { result: { error: "No valid supplier ids", missing } };
      const focus = (args.focus as string) || "tri";
      const sorted = [...list].sort((a, b) => fv(a, focus) - fv(b, focus));
      const c = compare(list);
      return {
        result: {
          focus: fieldLabel(focus),
          values: sorted.map((s) => ({ id: s.id, name: s.name, [fieldLabel(focus)]: round(fv(s, focus), 2), level: focus in { del: 1, conf: 1, po: 1, chg: 1, exposure: 1 } ? undefined : level(fv(s, focus)) })),
          lowest: { id: sorted[0].id, value: round(fv(sorted[0], focus), 2) },
          highest: { id: sorted.at(-1)!.id, value: round(fv(sorted.at(-1)!, focus), 2) },
          tri: list.map((s) => ({ id: s.id, tri: s.tri })),
          largestDifferences: c.topVariance.map((d) => ({ dimension: d.label, spread: d.spread, best: d.bestId, worst: d.worstId })),
          missing,
        },
        card: {
          type: "table", title: `Compared on ${fieldLabel(focus)}`, highlight: sorted[0].id,
          columns: ["ID", "Name", fieldLabel(focus), "Level", "TRI"],
          rows: sorted.map((s) => [s.id, s.name, round(fv(s, focus), 2), focus in { del: 1, conf: 1, po: 1, chg: 1, exposure: 1 } ? "" : level(fv(s, focus)), s.tri]),
          note: `Lowest: ${sorted[0].id}`,
        },
      };
    }
    case "explainScore": {
      const s = get(args.id);
      if (!s) return { result: { error: `Supplier ${args.id} not found` } };
      const e = explainScore(s);
      return {
        result: {
          id: e.id, name: e.name, tri: e.tri, level: e.triLevel, triPercentile: peerPercentile(ds, s.tri, "tri"),
          formula: "TRI = Σ score × weight (18 dimensions)", computedWeightedSum: e.computed, roundingDifference: e.residual,
          topContributors: e.contributions.slice(0, 6).map((c) => ({ dimension: c.label, score: c.score, level: c.level, weight: c.weight, points: round(c.contribution, 1), shareOfTRI: `${round(c.share * 100)}%` })),
          criticalDimensions: e.criticalDims.map(fieldLabel),
        },
        card: { type: "waterfall", id: s.id },
      };
    }
    case "filterSuppliers": {
      const ranges: FilterCriteria["ranges"] = {};
      for (const [k, v] of Object.entries((args.ranges as Record<string, { min?: number; max?: number }>) ?? {})) {
        if ((FIELDS as readonly string[]).includes(k)) ranges[k as NumField] = [v?.min ?? null, v?.max ?? null];
      }
      const crit: FilterCriteria = {
        ranges, levels: (args.levels as FilterCriteria["levels"]) ?? {},
        sourcing: args.sourcing as string[], complexity: args.complexity as string[], hiddenRiskOnly: !!args.hiddenRiskOnly,
      };
      const res = filterSuppliers(ds.all, crit);
      const sortF = ((args.sortBy as string) || "tri") as NumField;
      const dir = (args.sortDir as "asc" | "desc") || (["del", "conf", "po", "exposure"].includes(sortF) && !args.sortDir ? "desc" : "asc");
      const top = sortBy(res, sortF, dir).slice(0, Math.min(Number(args.limit) || 10, 20));
      const extraCol = !["tri", "financial", "del", "po"].includes(sortF);
      return {
        result: { totalMatches: res.length, sortedBy: `${fieldLabel(sortF)} ${dir}`, criteria: args, suppliers: top.map((s) => ({ id: s.id, name: s.name, tri: s.tri, level: level(s.tri), financial: s.s[1], deliveryRating: s.del, ...(extraCol ? { [fieldLabel(sortF)]: round(fv(s, sortF), 2) } : {}), criticalDims: hiddenRisk(s).criticalDims.map(fieldLabel) })) },
        card: {
          type: "table", title: `${res.length.toLocaleString("en")} matches · top ${top.length} by ${fieldLabel(sortF)}`,
          columns: extraCol ? [...SUMMARY_COLS, fieldLabel(sortF)] : SUMMARY_COLS,
          rows: top.map((s) => (extraCol ? [...summaryRow(s), round(fv(s, sortF), 2)] : summaryRow(s))),
        },
      };
    }
    case "hiddenRiskScan": {
      const pool = (args.ids as string[])?.length ? (args.ids as string[]).map((i) => ds.byId.get(normId(i))).filter(Boolean) as Supplier[] : ds.all;
      const hits = pool.filter((s) => hiddenRisk(s).flag).sort((a, b) => hiddenRisk(b).criticalDims.length - hiddenRisk(a).criticalDims.length || a.tri - b.tri);
      const top = hits.slice(0, Math.min(Number(args.limit) || 10, 20));
      return {
        result: { scanned: pool.length, hiddenRiskCount: hits.length, definition: "TRI level Low/Medium AND ≥2 sub-scores at Critical (≥75)", suppliers: top.map((s) => ({ id: s.id, tri: s.tri, criticalDims: hiddenRisk(s).criticalDims.map(fieldLabel) })) },
        card: { type: "table", title: `Hidden risk: ${hits.length} of ${pool.length.toLocaleString("en")} scanned`, columns: ["ID", "Name", "TRI", "Level", "Critical dimensions"], rows: top.map((s) => [s.id, s.name, s.tri, level(s.tri), hiddenRisk(s).criticalDims.map((k) => fieldLabel(k)).join(", ")]) },
      };
    }
    case "getShortlist": {
      const list = ctx.shortlist.map((id) => ds.byId.get(id)).filter(Boolean) as Supplier[];
      return {
        result: { replaceId: ctx.replaceId, pickId: ctx.pickId, shortlist: list.map((s) => ({ id: s.id, name: s.name, tri: s.tri, level: level(s.tri), hiddenRisk: hiddenRisk(s).flag })) },
        card: list.length ? { type: "table", title: `Shortlist (${list.length})`, highlight: ctx.pickId ?? undefined, columns: SUMMARY_COLS, rows: list.map(summaryRow) } : undefined,
      };
    }
    case "addToShortlist": {
      const ids = ((args.ids as string[]) ?? []).map(normId).filter((id) => ds.byId.has(id));
      const room = SHORTLIST_CAP - ctx.shortlist.length;
      const toAdd = ids.filter((id) => !ctx.shortlist.includes(id)).slice(0, Math.max(room, 0));
      return { result: { added: toAdd, shortlistSizeAfter: ctx.shortlist.length + toAdd.length, cap: SHORTLIST_CAP }, card: { type: "shortlist-add", ids: toAdd } };
    }
    case "glossary": {
      const t = String(args.term ?? "").toLowerCase();
      const doc = readFileSync(path.join(process.cwd(), "data", "risk_criteria_description.md"), "utf8");
      const lines = doc.split("\n").filter((l) => l.toLowerCase().includes(t.split(" ")[0]));
      const s = SCORES.find((d) => d.label.toLowerCase().includes(t) || d.key === t);
      return { result: { matches: lines.slice(0, 5), weightInTRI: s?.weight } };
    }
  }
  return { result: { error: `Unknown tool ${name}` } };
}
