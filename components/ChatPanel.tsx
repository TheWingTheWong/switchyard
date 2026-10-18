"use client";
import { useEffect, useRef, useState } from "react";
import { useDataset } from "@/lib/data-client";
import { explainScore } from "@/lib/engine";
import { useStore } from "@/lib/store";
import type { Card } from "@/lib/tools";
import type { Level } from "@/lib/schema";
import { LevelTag } from "./LevelTag";
import { RadarOverlay } from "./RadarOverlay";
import { Waterfall } from "./Waterfall";

interface Msg { role: "user" | "assistant"; content: string; cards?: Card[]; tools?: string[]; error?: boolean; }

const SUGGESTIONS = [
  "Which of SUPP_00012, SUPP_00450 and SUPP_00731 has the lowest financial risk?",
  "Why is the Total Risk Index of SUPP_00018 so high?",
  "Show me Low-risk suppliers with Critical financial health",
  "Top 5 suppliers with delivery rating above 95 and TRI below 30",
  "Can SUPP_00731 replace SUPP_09733 for brake pads?",
];

export function ChatPanel() {
  const { shortlist, pickId, replaceId, addMany } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), context: { shortlist, pickId, replaceId } }),
      });
      const j = await r.json();
      for (const c of (j.cards ?? []) as Card[]) if (c.type === "shortlist-add" && c.ids.length) addMany(c.ids);
      setMsgs([...next, { role: "assistant", content: j.text, cards: j.cards, tools: j.toolsUsed, error: j.error }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Request failed. Please retry.", error: true }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-line flex items-baseline">
        <span className="font-semibold">Ask SWITCHYARD</span>
        <span className="ml-2 text-muted text-[11px]">Nemotron · numbers from tools only</span>
        {msgs.length > 0 && <button className="ml-auto text-muted underline text-[11px]" onClick={() => setMsgs([])}>clear</button>}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-[13px]">
        {msgs.length === 0 && (
          <div>
            <p className="text-muted mb-2">Ask about any of the 10,000 suppliers. Every number comes from the data engine.</p>
            {SUGGESTIONS.map((s) => <button key={s} className="btn w-full text-left mb-1 text-[12px]" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "pl-8" : ""}>
            {m.role === "user" ? (
              <div className="border border-fg px-3 py-2">{m.content}</div>
            ) : (
              <div>
                <Text s={m.content} />
                {m.cards?.map((c, j) => <CardView key={j} c={c} />)}
                {m.tools && m.tools.length > 0 && <div className="text-muted text-[11px] mt-1">tools: {m.tools.join(", ")}</div>}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-muted">Thinking — calling tools…</div>}
        <div ref={end} />
      </div>
      <form className="border-t border-line p-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Why is SUPP_09733 risky?" />
        <button className="btn btn-primary" disabled={busy}>Send</button>
      </form>
    </div>
  );
}

function Text({ s }: { s: string }) {
  return (
    <div className="whitespace-pre-wrap">
      {s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </div>
  );
}

const isLevel = (v: unknown): v is Level => v === "Low" || v === "Medium" || v === "High" || v === "Critical";

function CardView({ c }: { c: Card }) {
  const ds = useDataset();
  if (c.type === "table") {
    return (
      <div className="card mt-2 overflow-x-auto">
        <div className="px-2 py-1 border-b border-line label">{c.title}</div>
        <table className="w-full text-[11px]">
          <thead><tr className="border-b border-line text-left">{c.columns.map((h) => <th key={h} className="px-2 py-1 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {c.rows.map((r, i) => (
              <tr key={i} className={`border-b border-line ${c.highlight && r[0] === c.highlight ? "font-semibold bg-surface" : ""}`}>
                {r.map((v, j) => (
                  <td key={j} className={`px-2 py-0.5 whitespace-nowrap ${typeof v === "number" ? "num text-right" : ""}`}>
                    {isLevel(v) ? <LevelTag lvl={v} showScore={false} /> : typeof v === "number" ? v.toLocaleString("en") : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {c.note && <div className="px-2 py-1 text-muted text-[11px]">{c.note}</div>}
      </div>
    );
  }
  if (c.type === "waterfall") {
    const s = ds?.byId.get(c.id);
    return s ? <div className="card mt-2 p-2"><Waterfall e={explainScore(s)} top={8} /></div> : null;
  }
  if (c.type === "radar") {
    if (!ds) return null;
    return <div className="card mt-2 p-2"><RadarOverlay height={260} series={c.ids.map((id) => ({ id, label: id, scores: ds.byId.get(id)?.s ?? [] }))} /></div>;
  }
  if (c.type === "shortlist-add") return <div className="card mt-2 px-2 py-1 text-[12px]">Added to shortlist: <span className="num">{c.ids.join(", ") || "none (already listed or full)"}</span></div>;
  if (c.type === "text") return <div className="card mt-2 p-2"><div className="label">{c.title}</div>{c.body}</div>;
  return null;
}
