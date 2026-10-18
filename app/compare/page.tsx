"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDataset } from "@/lib/data-client";
import { compare, explainScore, fmtEur, hiddenRisk } from "@/lib/engine";
import { SCORES } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { Loading, PageHeader } from "@/components/Shell";
import { LevelTag, ScoreCell } from "@/components/LevelTag";
import { RadarOverlay } from "@/components/RadarOverlay";
import { Waterfall } from "@/components/Waterfall";

export default function Compare() {
  const ds = useDataset();
  const { shortlist, pickId, setPick, replaceId, remove } = useStore();
  const [sel, setSel] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);

  const list = useMemo(() => (ds ? shortlist.map((id) => ds.byId.get(id)!).filter(Boolean).sort((a, b) => a.tri - b.tri) : []), [ds, shortlist]);
  const cmp = useMemo(() => (list.length ? compare(list) : null), [list]);
  if (!ds) return <Loading />;
  if (!list.length || !cmp) {
    return (
      <div>
        <PageHeader step="Step 3 · Compare" title="Nothing to compare yet" />
        <Link className="btn btn-primary" href="/narrow">← Build a shortlist first</Link>
      </div>
    );
  }
  const replace = ds.byId.get(replaceId);
  const radarIds = (sel.length ? sel : list.slice(0, 3).map((s) => s.id)).slice(0, 5);
  const radarSeries = [
    ...(replace ? [{ id: replace.id, label: `${replace.id} (replace)`, scores: replace.s }] : []),
    ...radarIds.map((id) => ({ id, label: id, scores: ds.byId.get(id)!.s })),
  ].slice(0, 5);
  const focusSupplier = ds.byId.get(focus ?? pickId ?? list[0].id)!;
  const toggleSel = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < 4 ? [...sel, id] : sel);

  return (
    <div>
      <PageHeader step="Step 3 · Compare" title={`${list.length} candidates side by side`}
        sub="Heatmap of all 18 risk scores (columns ordered by TRI weight) plus operational metrics. Click a row for its exact TRI breakdown; tick up to 4 for the radar.">
        {pickId && <Link href="/challenge" className="btn btn-primary">Challenge my pick ({pickId}) →</Link>}
      </PageHeader>

      <div className="mb-4 grid grid-cols-3 gap-3">
        {cmp.topVariance.map((d) => (
          <div key={d.key} className="card p-3 text-[13px]">
            <div className="label">Where they differ most</div>
            <div className="font-semibold">{d.label} <span className="text-muted font-normal">· spread <span className="num">{d.spread}</span> pts</span></div>
            <div className="text-muted">Best <span className="num text-fg">{d.bestId}</span> ({d.min}) · worst <span className="num text-fg">{d.worstId}</span> ({d.max})</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="text-[12px] w-full">
          <thead>
            <tr className="border-b border-fg">
              <th className="text-left font-medium py-1 pr-2 sticky left-0 bg-bg">Supplier</th>
              <th className="font-medium px-1">Radar</th>
              <th className="font-medium px-1">TRI</th>
              {SCORES.map((d) => (
                <th key={d.key} className="font-medium px-0.5 align-bottom" title={`${d.label} — weight ${d.weight}`}>
                  <div className="[writing-mode:vertical-rl] rotate-180 h-24 text-left whitespace-nowrap">{d.label} <span className="text-muted num">{d.weight.toFixed(2)}</span></div>
                </th>
              ))}
              <th className="font-medium px-1">Deliv.</th><th className="font-medium px-1">Conf.</th><th className="font-medium px-1">PO</th><th />
            </tr>
          </thead>
          <tbody>
            {replace && (
              <tr className="border-b border-fg text-muted">
                <td className="py-1 pr-2 sticky left-0 bg-bg"><span className="num">{replace.id}</span> <span className="label">to replace</span></td>
                <td /><td className="px-1"><LevelTag score={replace.tri} /></td>
                {replace.s.map((v, i) => <td key={i} className="px-0.5 opacity-60"><ScoreCell score={v} /></td>)}
                <td className="num px-1">{replace.del.toFixed(0)}</td><td className="num px-1">{replace.conf.toFixed(0)}</td><td className="num px-1">{fmtEur(replace.po)}</td><td />
              </tr>
            )}
            {list.map((s) => {
              const hr = hiddenRisk(s);
              const isPick = s.id === pickId;
              return (
                <tr key={s.id} className={`border-b border-line cursor-pointer ${focusSupplier.id === s.id ? "bg-surface" : ""}`} onClick={() => setFocus(s.id)}>
                  <td className="py-1 pr-2 sticky left-0 bg-inherit whitespace-nowrap">
                    <span className={`num ${isPick ? "font-bold" : ""}`}>{isPick ? "★ " : ""}{s.id}</span> <span className="text-muted">{s.name}</span>
                    {hr.flag && <span className="label ml-1">hidden risk</span>}
                  </td>
                  <td className="px-1 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggleSel(s.id)} /></td>
                  <td className="px-1"><LevelTag score={s.tri} /></td>
                  {s.s.map((v, i) => <td key={i} className="px-0.5"><ScoreCell score={v} /></td>)}
                  <td className="num px-1">{s.del.toFixed(0)}</td><td className="num px-1">{s.conf.toFixed(0)}</td><td className="num px-1">{fmtEur(s.po)}</td>
                  <td className="px-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button className={`btn text-[11px] ${isPick ? "btn-primary" : ""}`} onClick={() => setPick(isPick ? null : s.id)}>{isPick ? "Picked" : "Pick"}</button>
                    <button className="ml-1 text-muted" onClick={() => remove(s.id)} title="Remove from shortlist">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-muted text-[11px] mt-1">Shades: Low 0–24 · Medium 25–49 · High 50–74 · Critical 75–100 (darkest). Ops metrics are not part of the TRI.</div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        <section className="card p-4">
          <h2 className="font-semibold mb-1">Why is {focusSupplier.id} rated {focusSupplier.tri}?</h2>
          <Waterfall e={explainScore(focusSupplier)} />
          <div className="mt-3">
            <button className="btn btn-primary" onClick={() => setPick(focusSupplier.id)} disabled={focusSupplier.id === pickId}>
              {focusSupplier.id === pickId ? "This is your pick" : `Pick ${focusSupplier.id}`}
            </button>
          </div>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold mb-1">Risk profile overlay</h2>
          <RadarOverlay series={radarSeries} />
        </section>
      </div>
    </div>
  );
}
