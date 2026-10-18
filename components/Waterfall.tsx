"use client";
import type { Explanation } from "@/lib/engine";
import type { Level } from "@/lib/schema";
import { LevelTag, levelClass } from "./LevelTag";

/** Horizontal TRI waterfall: each dimension's exact contribution (score × weight), stacked to the total. */
export function Waterfall({ e, top, compact = false }: { e: Explanation; top?: number; compact?: boolean }) {
  const rows = top ? e.contributions.slice(0, top) : e.contributions;
  const rest = top ? e.contributions.slice(top) : [];
  const restSum = rest.reduce((a, c) => a + c.contribution, 0);
  let cum = 0;
  const scale = (v: number) => `${v}%`; // axis 0–100 = TRI scale
  return (
    <div className="text-[12px]">
      {!compact && (
        <div className="flex items-baseline gap-2 mb-3">
          <span className="num font-semibold">{e.id}</span><span className="font-medium truncate">{e.name}</span>
          <span className="ml-auto whitespace-nowrap">TRI <span className="num font-semibold">{e.tri}</span></span>
          <LevelTag lvl={e.triLevel} showScore={false} />
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,140px)_62px_minmax(80px,1fr)_40px] gap-x-2.5 gap-y-[3px] items-center">
        <span className="cap">Dimension</span><span className="cap">Score×Wt</span><span className="cap truncate">Contribution to TRI (0–100)</span><span className="cap text-right">Pts</span>
        {rows.map((c) => {
          const start = cum; cum += c.contribution;
          return (
            <Row key={c.key} label={c.label} meta={<><span className="num">{c.score}</span>×<span className="num">{c.weight.toFixed(2)}</span></>}
              left={scale(start)} width={scale(c.contribution)} lvl={c.level} value={c.contribution} />
          );
        })}
        {rest.length > 0 && <Row label={`${rest.length} other dimensions`} meta="" left={scale(cum)} width={scale(restSum)} value={restSum} muted />}
        <span className="font-semibold border-t border-fg pt-1">= Total Risk Index</span><span className="border-t border-fg self-stretch" />
        <div className="border-t border-fg pt-1"><div className="relative h-3.5 bg-surface"><div className="absolute inset-y-0 left-0 bg-stamp" style={{ width: scale(e.computed) }} /></div></div>
        <span className="num text-right font-semibold border-t border-fg pt-1">{e.computed.toFixed(1)}</span>
      </div>
      <div className="text-muted mt-2.5 leading-snug">
        Weighted sum {e.computed.toFixed(2)} vs reported TRI {e.tri} — difference {e.residual >= 0 ? "+" : ""}{e.residual.toFixed(2)} (rounding ±0.5). Bar colour = sub-score level; red hatched bars = Critical sub-scores.
      </div>
    </div>
  );
}

function Row({ label, meta, left, width, value, lvl, muted }: { label: string; meta: React.ReactNode; left: string; width: string; value: number; lvl?: Level; muted?: boolean }) {
  return (
    <>
      <span className={`truncate ${muted ? "text-muted" : lvl === "Critical" ? "font-semibold" : ""}`}>{label}</span>
      <span className="text-muted whitespace-nowrap">{meta}</span>
      <div className="relative h-3.5 bg-surface" title={lvl ? `${label}: ${lvl}` : label}>
        <div className={`absolute inset-y-0 ${muted ? "bg-[var(--line)]" : `${levelClass(lvl!)} shadow-[inset_0_0_0_1px_rgba(21,26,44,.18)]`}`} style={{ left, width }} />
      </div>
      <span className="num text-right">{value.toFixed(1)}</span>
    </>
  );
}
