"use client";
import type { Explanation } from "@/lib/engine";
import { LevelTag } from "./LevelTag";

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
        <div className="flex items-baseline gap-2 mb-2">
          <span className="num">{e.id}</span><span className="font-medium">{e.name}</span>
          <span className="ml-auto">TRI <span className="num font-semibold">{e.tri}</span></span>
          <LevelTag lvl={e.triLevel} showScore={false} />
        </div>
      )}
      <div className="grid grid-cols-[150px_70px_1fr_44px] gap-x-2 gap-y-0.5 items-center">
        <span className="label">Dimension</span><span className="label">Score×Wt</span><span className="label">Contribution to TRI (0–100)</span><span className="label text-right">Pts</span>
        {rows.map((c) => {
          const start = cum; cum += c.contribution;
          return (
            <Row key={c.key} label={c.label} meta={<><span className="num">{c.score}</span>×<span className="num">{c.weight.toFixed(2)}</span></>}
              left={scale(start)} width={scale(c.contribution)} critical={c.level === "Critical"} value={c.contribution} />
          );
        })}
        {rest.length > 0 && <Row label={`${rest.length} other dimensions`} meta="" left={scale(cum)} width={scale(restSum)} value={restSum} muted />}
        <span className="font-semibold">= Total Risk Index</span><span />
        <div className="relative h-3 bg-surface border border-line"><div className="absolute inset-y-0 left-0 bg-fg" style={{ width: scale(e.computed) }} /></div>
        <span className="num text-right font-semibold">{e.computed.toFixed(1)}</span>
      </div>
      <div className="text-muted mt-2">
        Weighted sum {e.computed.toFixed(2)} vs reported TRI {e.tri} — difference {e.residual >= 0 ? "+" : ""}{e.residual.toFixed(2)} (rounding ±0.5). Black bars = Critical sub-scores.
      </div>
    </div>
  );
}

function Row({ label, meta, left, width, value, critical, muted }: { label: string; meta: React.ReactNode; left: string; width: string; value: number; critical?: boolean; muted?: boolean }) {
  return (
    <>
      <span className={`truncate ${muted ? "text-muted" : ""}`}>{label}</span>
      <span className="text-muted whitespace-nowrap">{meta}</span>
      <div className="relative h-3 bg-surface">
        <div className={`absolute inset-y-0 ${critical ? "bg-[var(--risk-critical)]" : muted ? "bg-[var(--risk-low)] border border-line" : "bg-[var(--risk-high)]"}`} style={{ left, width }} />
      </div>
      <span className="num text-right">{value.toFixed(1)}</span>
    </>
  );
}
