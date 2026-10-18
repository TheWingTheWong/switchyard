"use client";
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { SCORES } from "@/lib/schema";

const STROKES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const DASHES = ["", "4 3", "1 2", "8 3", "2 4"];

export interface RadarSeries { id: string; label: string; scores: (number | null)[]; }

/** Overlay radar of the 18 risk scores. Short axis labels; no animation. */
export function RadarOverlay({ series, height = 340 }: { series: RadarSeries[]; height?: number }) {
  const data = SCORES.map((d, i) => {
    const row: Record<string, string | number> = { dim: d.label.split(" ")[0] };
    series.forEach((s) => (row[s.id] = s.scores[i] ?? 0));
    return row;
  });
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--chart-grid)" />
          <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: "var(--muted)" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "var(--faint)" }} tickCount={5} stroke="var(--line)" />
          {series.map((s, i) => (
            <Radar key={s.id} name={s.label} dataKey={s.id} stroke={STROKES[i % 5]} strokeDasharray={DASHES[i % 5]} strokeWidth={i === 0 ? 2 : 1.5} fill="none" isAnimationActive={false} />
          ))}
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
