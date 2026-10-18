"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDataset } from "@/lib/data-client";
import { explainScore, exposure, fmtEur, hiddenRisk, portfolio, topExposure } from "@/lib/engine";
import { LEVELS, LEVEL_RANGES } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { Kpi, Loading, PageHeader } from "@/components/Shell";
import { LevelTag } from "@/components/LevelTag";
import { Waterfall } from "@/components/Waterfall";

export default function Triage() {
  const ds = useDataset();
  const { replaceId, setReplace } = useStore();
  const p = useMemo(() => (ds ? portfolio(ds.all) : null), [ds]);
  const top = useMemo(() => (ds ? topExposure(ds.all, 10) : []), [ds]);
  if (!ds || !p) return <Loading />;
  const target = ds.byId.get(replaceId) ?? top[0];
  const e = explainScore(target);
  const hr = hiddenRisk(target);
  const dist = LEVELS.map((l) => ({ level: `${l} (${LEVEL_RANGES[l][0]}–${LEVEL_RANGES[l][1]})`, count: p.levelCounts[l] }));

  return (
    <div className="max-w-[var(--container)]">
      <PageHeader step="Step 1 · Triage" title="Where is our money at risk?" sub="Exposure = Total Risk Index ÷ 100 × purchase order volume. Pick the supplier you need to replace." />

      <div className="grid grid-cols-5 gap-3 mb-6">
        <Kpi label="Suppliers" value={p.count.toLocaleString("en")} />
        <Kpi label="Total PO volume" value={fmtEur(p.totalSpend)} />
        <Kpi label="Risk-weighted exposure" value={fmtEur(p.totalExposure)} sub="Σ TRI/100 × PO" />
        <Kpi label="PO volume at Critical TRI" value={fmtEur(p.criticalSpend)} sub={`${p.criticalCount} suppliers with TRI ≥ 75`} />
        <Kpi label="Hidden risk" value={p.hiddenRiskCount} sub="Low/Medium TRI but ≥2 Critical sub-scores" />
      </div>

      <div className="grid grid-cols-[1.25fr_1fr] gap-6">
        <section>
          <h2 className="font-semibold mb-2">Top 10 by risk-weighted exposure</h2>
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-fg text-left">
              <th className="py-1.5 font-medium">#</th><th className="font-medium">Supplier</th><th className="font-medium">TRI</th>
              <th className="font-medium text-right">PO volume</th><th className="font-medium text-right">Exposure</th><th />
            </tr></thead>
            <tbody>
              {top.map((s, i) => (
                <tr key={s.id} className={`border-b border-line ${s.id === target.id ? "bg-surface font-medium" : ""}`}>
                  <td className="py-1.5 num">{i + 1}</td>
                  <td><span className="num">{s.id}</span> <span className="text-muted">{s.name}</span>{hiddenRisk(s).flag && <span className="ml-1 label">hidden risk</span>}</td>
                  <td><LevelTag score={s.tri} /></td>
                  <td className="num text-right">{fmtEur(s.po)}</td>
                  <td className="num text-right">{fmtEur(exposure(s))}</td>
                  <td className="text-right">{s.id === target.id ? <span className="label">replacing</span> : <button className="btn text-[12px]" onClick={() => setReplace(s.id)}>Replace this</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="font-semibold mt-6 mb-2">Total Risk Index distribution</h2>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={dist} margin={{ left: 0, right: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="level" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" />
                <Tooltip cursor={{ fill: "var(--surface)" }} />
                <Bar dataKey="count" fill="var(--chart-1)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-4">
          <div className="label">Supplier to replace</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="num text-xl">{target.id}</span><span className="text-xl font-semibold">{target.name}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 my-3 text-[12px]">
            <div><div className="label">TRI</div><LevelTag score={target.tri} /></div>
            <div><div className="label">PO volume</div><span className="num">{fmtEur(target.po)}</span></div>
            <div><div className="label">Exposure</div><span className="num">{fmtEur(exposure(target))}</span></div>
            <div><div className="label">Sourcing risk</div>{target.src}</div>
          </div>
          {hr.criticalDims.length > 0 && (
            <p className="mb-3 text-[13px]"><span className="font-semibold">{hr.criticalDims.length} Critical sub-scores.</span> Why it is risky — every point of the TRI, exactly:</p>
          )}
          <Waterfall e={e} top={8} compact />
          <div className="mt-4 flex gap-2">
            <Link href="/narrow" className="btn btn-primary">Find alternatives →</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
