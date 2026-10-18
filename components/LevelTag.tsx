import { level } from "@/lib/engine";
import type { Level } from "@/lib/schema";

const CLS: Record<Level, string> = {
  Low: "bg-[var(--risk-low)] text-[var(--risk-low-fg)]",
  Medium: "bg-[var(--risk-medium)] text-[var(--risk-medium-fg)]",
  High: "bg-[var(--risk-high)] text-[var(--risk-high-fg)]",
  Critical: "bg-[var(--risk-critical)] text-[var(--risk-critical-fg)]",
};

export const levelClass = (l: Level) => CLS[l];

/** Score + level label. Gray shade + text, never colour alone. */
export function LevelTag({ score, lvl, showScore = true }: { score?: number; lvl?: Level; showScore?: boolean }) {
  const l = lvl ?? level(score ?? 0);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-px text-[11px] leading-4 whitespace-nowrap ${CLS[l]}`}>
      {showScore && score != null && <span className="num">{score}</span>}
      <span>{l}</span>
    </span>
  );
}

/** Heatmap cell: score with level shade. */
export function ScoreCell({ score }: { score: number }) {
  return <span className={`num inline-block w-full text-center text-[12px] ${CLS[level(score)]}`} title={level(score)}>{score}</span>;
}
