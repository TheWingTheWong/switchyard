"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDataset } from "@/lib/data-client";
import { explainScore, exposure, fmtEur, hiddenRisk, level, portfolio, topExposure } from "@/lib/engine";
import { LEVELS, LEVEL_RANGES, type Level, type Supplier } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { Kpi, Loading, PageHeader } from "@/components/Shell";
import { LevelTag } from "@/components/LevelTag";
import { Waterfall } from "@/components/Waterfall";

export default function Triage() {
  const ds = useDataset();
  const { replaceId, setReplace } = useStore();
  const p = useMemo(() => (ds ? portfolio(ds.all) : null), [ds]);
  const top = useMemo(() => (ds ? topExposure(ds.all, 10) : []), [ds]);
  // "See more": all suppliers by exposure, local state only (a reload returns to the default top 10).
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");
  const [lvl, setLvl] = useState<Level | null>(null);
  const [limit, setLimit] = useState(25);
  const ranked = useMemo(() => (ds && more ? topExposure(ds.all, ds.all.length) : []), [ds, more]);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ranked.map((s, i) => ({ s, rank: i + 1 }))
      .filter(({ s }) => (!lvl || level(s.tri) === lvl) && (!needle || s.id.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle)));
  }, [ranked, q, lvl]);
  if (!ds || !p) return <Loading />;
  const target = ds.byId.get(replaceId) ?? top[0];
  const e = explainScore(target);
  const hr = hiddenRisk(target);
  const replaceWith = (s: Supplier) => {
    const st = useStore.getState();
    if ((st.shortlist.length || st.pickId || st.memo) && !confirm(`Start a new decision to replace ${s.id}? The current shortlist, pick and memo for ${st.replaceId} will be cleared.`)) return;
    setReplace(s.id);
  };
  const collapse = () => { setMore(false); setQ(""); setLvl(null); setLimit(25); };
  const rows = more ? matches.slice(0, limit) : top.map((s, i) => ({ s, rank: i + 1 }));
  const dist = LEVELS.map((l) => ({ level: `${l} (${LEVEL_RANGES[l][0]}–${LEVEL_RANGES[l][1]})`, count: p.levelCounts[l] }));

  return (
    <div className="max-w-[var(--container)]">
      <PageHeader step="Step 1 · Triage" title="Where is our money at risk?" sub="Exposure = Total Risk Index ÷ 100 × purchase order volume. Pick the supplier you need to replace." />

      <div className="field-grid grid-cols-2 @min-[720px]:grid-cols-5 mb-6">
        <Kpi label="Suppliers" value={p.count.toLocaleString("en")} />
        <Kpi label="Total PO volume" value={fmtEur(p.totalSpend)} />
        <Kpi label="Risk-weighted exposure" value={fmtEur(p.totalExposure)} sub="Σ TRI/100 × PO" />
        <Kpi label="PO volume at Critical TRI" value={fmtEur(p.criticalSpend)} sub={`${p.criticalCount} suppliers with TRI ≥ 75`} strong />
        <Kpi label="Hidden risk" value={p.hiddenRiskCount} sub="Low/Medium TRI but ≥2 Critical sub-scores" />
      </div>

      <div className="grid gap-6 @min-[860px]:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] items-start">
        <section className="min-w-0">
          <h2 className="display text-[18px] mb-2">{more ? "All suppliers by risk-weighted exposure" : "Top 10 by risk-weighted exposure"}</h2>
          {more && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <input className="input text-[12px] w-44" placeholder="Search ID or name" value={q} onChange={(e) => { setQ(e.target.value); setLimit(25); }} />
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by TRI level">
                {([null, "Critical", "High", "Medium", "Low"] as (Level | null)[]).map((l) => (
                  <button key={l ?? "All"} aria-pressed={lvl === l} className={`btn text-[12px] !min-h-[24px] !py-0.5 !px-2 ${lvl === l ? "btn-primary" : "btn-quiet"}`} onClick={() => { setLvl(l); setLimit(25); }}>{l ?? "All"}</button>
                ))}
              </div>
              <span className="ml-auto text-muted text-[11px]"><span className="num">{matches.length.toLocaleString("en")}</span> of {ds.all.length.toLocaleString("en")} match</span>
            </div>
          )}
          <table className="tbl tbl-tight text-[12.5px]">
            <thead><tr>
              <th className="!pl-1 w-6">#</th><th>Supplier</th><th>TRI</th>
              <th className="r">Exposure <span className="normal-case tracking-normal font-normal">of PO</span></th><th />
            </tr></thead>
            <tbody>
              {rows.map(({ s, rank }) => (
                <tr key={s.id} className={s.id === target.id ? "is-current" : ""}>
                  <td className="num !pl-1 text-muted">{rank}</td>
                  <td className="leading-tight"><div className="num font-medium">{s.id}</div><div className="text-muted text-[11.5px] truncate max-w-[160px]">{s.name}{hiddenRisk(s).flag && <span className="cap ml-1 !text-[var(--risk-critical)]">hidden risk</span>}</div></td>
                  <td><LevelTag score={s.tri} /></td>
                  <td className="r leading-tight"><div className="num font-semibold">{fmtEur(exposure(s))}</div><div className="num text-muted text-[11px]">of {fmtEur(s.po)}</div></td>
                  <td className="r !pr-1">{s.id === target.id ? <span className="cap !text-stamp">Replacing</span> : <button className="btn btn-quiet text-[12px] !min-h-[24px] !py-0.5 !px-2" onClick={() => replaceWith(s)}>Replace this</button>}</td>
                </tr>
              ))}
              {more && rows.length === 0 && <tr><td colSpan={5} className="text-muted">No supplier matches.</td></tr>}
            </tbody>
          </table>
          <div className="flex justify-end gap-4 mt-1.5 text-[12px]">
            {!more && <button className="text-stamp hover:underline underline-offset-2" onClick={() => setMore(true)}>See more ›</button>}
            {more && matches.length > limit && <button className="text-stamp hover:underline underline-offset-2" onClick={() => setLimit(limit + 25)}>Show 25 more</button>}
            {more && <button className="text-stamp hover:underline underline-offset-2" onClick={collapse}>Show less</button>}
          </div>

          <h2 className="display text-[18px] mt-7 mb-2">Total Risk Index distribution</h2>
          <div className="h-48 sheet pt-3 pr-2">
            <ResponsiveContainer>
              <BarChart data={dist} margin={{ left: 0, right: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="level" tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--line)" tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--line)" tickLine={false} width={44} />
                <Tooltip cursor={{ fill: "var(--surface)" }} contentStyle={{ border: "1px solid var(--line)", borderRadius: 2, fontSize: 12 }} />
                <Bar dataKey="count" isAnimationActive={false} maxBarSize={72}>
                  {dist.map((d, i) => <Cell key={d.level} fill={BAR_FILLS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="sheet min-w-0">
          <div className="guilloche h-2 border-b border-line" aria-hidden />
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <div className="cap">Supplier to replace</div>
                <div className="flex flex-wrap items-baseline gap-x-2 mt-1">
                  <span className="num text-[20px] font-semibold">{target.id}</span><span className="display text-[22px]">{target.name}</span>
                </div>
              </div>
            </div>
            <div className="field-grid grid-cols-4 my-4 text-[12.5px]">
              <div className="px-2.5 py-2"><div className="cap">TRI</div><div className="mt-1"><LevelTag score={target.tri} /></div></div>
              <div className="px-2.5 py-2"><div className="cap">PO volume</div><div className="num mt-1">{fmtEur(target.po)}</div></div>
              <div className="px-2.5 py-2"><div className="cap">Exposure</div><div className="num mt-1 font-semibold">{fmtEur(exposure(target))}</div></div>
              <div className="px-2.5 py-2"><div className="cap">Sourcing risk</div><div className="mt-1">{target.src}</div></div>
            </div>
            {hr.criticalDims.length > 0 && (
              <p className="mb-3 text-[13px]"><span className="font-semibold text-[var(--risk-critical)]">{hr.criticalDims.length} Critical sub-scores.</span> Why it is risky — every point of the TRI, exactly:</p>
            )}
            <Waterfall e={e} top={8} compact />
            <div className="mt-5 flex gap-2">
              <Link href="/narrow" className="btn btn-primary">Find alternatives →</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const BAR_FILLS = ["var(--risk-low)", "var(--risk-medium)", "var(--risk-high)", "var(--risk-critical)"];
