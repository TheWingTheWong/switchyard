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

      <div className="field-grid grid-cols-1 @min-[720px]:grid-cols-3 mb-5">
        {cmp.topVariance.map((d) => (
          <div key={d.key} className="px-4 py-3 text-[13px]">
            <div className="cap">Where they differ most</div>
            <div className="font-semibold mt-0.5">{d.label} <span className="text-muted font-normal">· spread <span className="num text-fg font-semibold">{d.spread}</span> pts</span></div>
            <div className="text-muted mt-0.5">Best <span className="num text-fg">{d.bestId}</span> ({d.min}) · worst <span className="num text-fg">{d.worstId}</span> ({d.max})</div>
          </div>
        ))}
      </div>

      <div className="sheet overflow-x-auto">
        <table className="text-[12px] w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="cap text-left py-1.5 pl-3 pr-2 sticky left-0 z-10 bg-sheet border-b border-fg align-bottom">Supplier</th>
              <th className="cap px-1 border-b border-fg align-bottom">Radar</th>
              <th className="cap px-1 border-b border-fg align-bottom text-left">TRI</th>
              {SCORES.map((d) => (
                <th key={d.key} className="font-medium px-px align-bottom border-b border-fg" title={`${d.label} — weight ${d.weight}`}>
                  <div className="[writing-mode:vertical-rl] rotate-180 h-[104px] text-left whitespace-nowrap text-[11px] [font-stretch:85%]">{d.label} <span className="text-stamp num">{d.weight.toFixed(2)}</span></div>
                </th>
              ))}
              <th className="cap px-1.5 border-b border-fg align-bottom">Deliv.</th><th className="cap px-1.5 border-b border-fg align-bottom">Conf.</th><th className="cap px-1.5 border-b border-fg align-bottom">PO</th><th className="border-b border-fg" />
            </tr>
          </thead>
          <tbody>
            {replace && (
              <tr className="text-muted bg-surface">
                <td className="py-1 pl-3 pr-2 sticky left-0 bg-surface whitespace-nowrap border-b-2 border-fg"><span className="num">{replace.id}</span> <span className="cap !text-[var(--risk-critical)]">to replace</span></td>
                <td className="border-b-2 border-fg" /><td className="px-1 border-b-2 border-fg"><LevelTag score={replace.tri} /></td>
                {replace.s.map((v, i) => <td key={i} className="px-px py-px opacity-55 border-b-2 border-fg"><ScoreCell score={v} /></td>)}
                <td className="num px-1.5 border-b-2 border-fg">{replace.del.toFixed(0)}</td><td className="num px-1.5 border-b-2 border-fg">{replace.conf.toFixed(0)}</td><td className="num px-1.5 border-b-2 border-fg whitespace-nowrap">{fmtEur(replace.po)}</td><td className="border-b-2 border-fg" />
              </tr>
            )}
            {list.map((s) => {
              const hr = hiddenRisk(s);
              const isPick = s.id === pickId;
              const focused = focusSupplier.id === s.id;
              const bg = isPick ? "bg-stamp-tint" : focused ? "bg-surface" : "bg-sheet";
              return (
                <tr key={s.id} className={`cursor-pointer ${bg} hover:bg-surface`} onClick={() => setFocus(s.id)}>
                  <td className={`py-1 pl-3 pr-2 sticky left-0 z-[1] ${bg} whitespace-nowrap border-b border-line ${focused ? "shadow-[inset_3px_0_0_var(--stamp)]" : ""}`}>
                    <span className={`num ${isPick ? "font-bold text-stamp" : "font-medium"}`}>{isPick ? "★ " : ""}{s.id}</span> <span className="text-muted">{s.name}</span>
                    {hr.flag && <span className="cap ml-1.5 !text-[var(--risk-critical)]">hidden risk</span>}
                  </td>
                  <td className="px-1 text-center border-b border-line" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Show ${s.id} on radar`} checked={sel.includes(s.id)} onChange={() => toggleSel(s.id)} /></td>
                  <td className="px-1 border-b border-line"><LevelTag score={s.tri} /></td>
                  {s.s.map((v, i) => <td key={i} className="px-px py-px border-b border-line"><ScoreCell score={v} /></td>)}
                  <td className="num px-1.5 border-b border-line">{s.del.toFixed(0)}</td><td className="num px-1.5 border-b border-line">{s.conf.toFixed(0)}</td><td className="num px-1.5 border-b border-line whitespace-nowrap">{fmtEur(s.po)}</td>
                  <td className="px-1.5 whitespace-nowrap border-b border-line" onClick={(e) => e.stopPropagation()}>
                    <button className={`btn text-[11px] !min-h-[24px] !py-0 ${isPick ? "btn-primary" : "btn-quiet"}`} onClick={() => setPick(isPick ? null : s.id)}>{isPick ? "Picked" : "Pick"}</button>
                    <button className="ml-1 linkish no-underline px-1" onClick={() => remove(s.id)} title="Remove from shortlist" aria-label={`Remove ${s.id} from shortlist`}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted text-[11px] mt-2">
        <span className="cap">Key</span>
        <LevelTag lvl="Low" showScore={false} /><span className="num">0–24</span>
        <LevelTag lvl="Medium" showScore={false} /><span className="num">25–49</span>
        <LevelTag lvl="High" showScore={false} /><span className="num">50–74</span>
        <LevelTag lvl="Critical" showScore={false} /><span className="num">75–100</span> (bold, hatched)
        <span>· Column weights in violet. Ops metrics are not part of the TRI.</span>
      </div>

      <div className="grid gap-6 mt-6 @min-[900px]:grid-cols-2 items-start">
        <section className="sheet p-5 min-w-0">
          <h2 className="display text-[19px] mb-3">Why is {focusSupplier.id} rated {focusSupplier.tri}?</h2>
          <Waterfall e={explainScore(focusSupplier)} />
          <div className="mt-4">
            <button className="btn btn-primary" onClick={() => setPick(focusSupplier.id)} disabled={focusSupplier.id === pickId}>
              {focusSupplier.id === pickId ? "This is your pick" : `Pick ${focusSupplier.id}`}
            </button>
          </div>
        </section>
        <section className="sheet p-5 min-w-0">
          <h2 className="display text-[19px] mb-1">Risk profile overlay</h2>
          <RadarOverlay series={radarSeries} />
        </section>
      </div>
    </div>
  );
}
