import { level } from "@/lib/engine";
import type { Level } from "@/lib/schema";

const CLS: Record<Level, string> = {
  Low: "bg-[var(--risk-low)] text-[var(--risk-low-fg)]",
  Medium: "bg-[var(--risk-medium)] text-[var(--risk-medium-fg)]",
  High: "bg-[var(--risk-high)] text-[var(--risk-high-fg)]",
  Critical: "bg-[var(--risk-critical)] text-[var(--risk-critical-fg)] hatch-critical",
};

export const levelClass = (l: Level) => CLS[l];

/** Score + level label. Colour + text, never colour alone. */
export function LevelTag({ score, lvl, showScore = true }: { score?: number; lvl?: Level; showScore?: boolean }) {
  const l = lvl ?? level(score ?? 0);
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-px text-[11px] leading-4 font-semibold whitespace-nowrap rounded-[2px] ${CLS[l]}`}>
      {showScore && score != null && <span className="num">{score}</span>}
      <span className="[font-stretch:85%] uppercase tracking-[0.03em] text-[10px]">{l}</span>
    </span>
  );
}

/** Heatmap cell: score with level colour; Critical also hatched and bold. */
export function ScoreCell({ score }: { score: number }) {
  const l = level(score);
  return <span className={`num block w-full min-w-[26px] text-center text-[11.5px] leading-[22px] ${CLS[l]} ${l === "Critical" ? "font-bold" : ""}`} title={`${score} · ${l}`}>{score}</span>;
}
