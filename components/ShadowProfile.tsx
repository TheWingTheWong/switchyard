"use client";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { SCORES } from "@/lib/schema";
import { partialTri, scoreOf } from "@/lib/engine";
import type { ResearchReport } from "@/lib/research-types";
import type { Supplier } from "@/lib/schema";
import { LevelTag } from "./LevelTag";

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export function ShadowProfile({ report, supplier }: { report: ResearchReport; supplier?: Supplier | null }) {
  const byKey = new Map(report.shadow.map((s) => [s.key, s]));
  const { coverage } = partialTri(Object.fromEntries(report.shadow.map((s) => [s.key, s.score])));
  const scored = report.shadow.filter((s) => s.score != null).length;

  const data = SCORES.map((d) => {
    const s = byKey.get(d.key);
    return {
      dim: d.label + (s?.score == null ? " (n/a)" : ""),
      shadow: s?.score ?? null, // no evidence → gap, never plotted as "0 = no risk"
      dataset: supplier ? scoreOf(supplier, d.key) : undefined,
    };
  });

  return (
    <div className="card p-4">
      <div className="flex items-end gap-6 mb-3 flex-wrap">
        <div>
          <h2 className="display text-[17px]">Shadow profile</h2>
          <div className="text-[13px] text-muted">{report.company} scored on the same 18 dimensions from public evidence.</div>
        </div>
        <div className="ml-auto flex gap-6">
          <div>
            <div className="label">Shadow TRI</div>
            <div className="num text-2xl flex items-center gap-2">{report.shadowTri != null ? <>{report.shadowTri} <LevelTag score={report.shadowTri} showScore={false} /></> : "—"}</div>
          </div>
          <div>
            <div className="label">Coverage</div>
            <div className="num text-2xl">{Math.round(coverage * 100)}%</div>
            <div className="text-[11px] text-muted">{scored}/18 dims · of TRI weight</div>
          </div>
          {supplier && (
            <div>
              <div className="label">{supplier.id} TRI</div>
              <div className="num text-2xl flex items-center gap-2">{supplier.tri} <LevelTag score={supplier.tri} showScore={false} /></div>
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
        <div className="h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="70%">
              <PolarGrid stroke="var(--chart-grid)" />
              <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {supplier && (
                <Radar name={`${supplier.id} (dataset)`} dataKey="dataset" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.08} strokeDasharray="4 3" isAnimationActive={false} />
              )}
              <Radar name={`${report.company} (shadow, evidence only)`} dataKey="shadow" legendType="circle" stroke="var(--chart-1)" strokeWidth={0} fill="none" isAnimationActive={false}
                dot={(p: { cx?: number; cy?: number; index?: number; payload?: { shadow?: number | null } }) =>
                  p.payload?.shadow == null ? <g key={`gap-${p.index}`} /> : <circle key={`pt-${p.index}`} cx={p.cx} cy={p.cy} r={4} fill="var(--chart-1)" stroke="var(--sheet)" strokeWidth={1} />} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="text-[11px] text-muted text-center">Shadow scores are plotted as points only where evidence exists. Dimensions marked (n/a) are left blank: no evidence ≠ no risk.</div>
        </div>

        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="text-left border-b border-line">
              <th className="label py-1 pr-2 font-normal">Dimension</th>
              <th className="label py-1 pr-2 font-normal">Score</th>
              <th className="label py-1 pr-2 font-normal">Conf.</th>
              <th className="label py-1 pr-2 font-normal">Rationale</th>
              <th className="label py-1 font-normal">Source</th>
            </tr>
          </thead>
          <tbody>
            {SCORES.map((d) => {
              const s = byKey.get(d.key);
              const none = !s || s.score == null;
              return (
                <tr key={d.key} className={`border-b border-line align-top ${none ? "text-muted" : ""}`}>
                  <td className="py-1 pr-2 whitespace-nowrap">{d.label}</td>
                  <td className="py-1 pr-2">{none ? "—" : <LevelTag score={s!.score!} />}</td>
                  <td className="py-1 pr-2">{s?.confidence ?? "—"}</td>
                  <td className="py-1 pr-2">{none ? <em>no evidence found</em> : <>{s!.rationale || "See source."}{s!.eventDate || (s!.status && s!.status !== "unknown") ? <span className="text-muted text-[11px]"> · {[s!.eventDate, s!.status !== "unknown" ? s!.status : null].filter(Boolean).join(" · ")}</span> : null}</>}</td>
                  <td className="py-1 max-w-[140px] truncate">
                    {s?.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 decoration-[var(--line)] hover:text-stamp">{host(s.url)}</a> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
