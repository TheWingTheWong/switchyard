"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDataset } from "@/lib/data-client";
import { exposure, filterSuppliers, fmtEur, hiddenRisk, sortBy, type FilterCriteria, type NumField } from "@/lib/engine";
import { LEVELS, SCORES, SHORTLIST_CAP, type Level, type ScoreKey } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { Loading, PageHeader } from "@/components/Shell";
import { LevelTag } from "@/components/LevelTag";

const SORTS: { f: NumField; label: string; dir: "asc" | "desc" }[] = [
  { f: "tri", label: "TRI (lowest first)", dir: "asc" },
  { f: "del", label: "Delivery rating (highest first)", dir: "desc" },
  { f: "conf", label: "Confirmation rate (highest first)", dir: "desc" },
  { f: "financial", label: "Financial risk (lowest first)", dir: "asc" },
  { f: "po", label: "PO volume (highest first)", dir: "desc" },
  { f: "exposure", label: "Exposure (highest first)", dir: "desc" },
];

const QUICK: { label: string; f: FilterCriteria }[] = [
  { label: "Safe & reliable: TRI < 30, delivery > 95%", f: { ranges: { tri: [null, 29], del: [95, null] } } },
  { label: "Low TRI, no Critical financial risk", f: { levels: { tri: ["Low"] }, ranges: { financial: [null, 74] } } },
  { label: "Hidden risk only (averages lie)", f: { hiddenRiskOnly: true } },
];

type DimRange = { key: ScoreKey; min: string; max: string };

export default function Narrow() {
  const ds = useDataset();
  const { filters, setFilters, shortlist, add, addMany, remove, clearShortlist, replaceId, log } = useStore();
  const [sort, setSort] = useState(0);
  const [msg, setMsg] = useState("");

  const f = filters;
  const set = (patch: Partial<FilterCriteria>) => setFilters({ ...f, ...patch });
  const setRange = (k: NumField, i: 0 | 1, v: string) => {
    const cur = f.ranges?.[k] ?? [null, null];
    const next: [number | null, number | null] = [...cur] as [number | null, number | null];
    next[i] = v === "" ? null : Number(v);
    set({ ranges: { ...f.ranges, [k]: next } });
  };
  const dimRanges: DimRange[] = SCORES.filter((d) => f.ranges?.[d.key]).map((d) => ({ key: d.key, min: String(f.ranges![d.key]![0] ?? ""), max: String(f.ranges![d.key]![1] ?? "") }));
  const [newDim, setNewDim] = useState<ScoreKey>("financial");

  const results = useMemo(() => {
    if (!ds) return [];
    const s = SORTS[sort];
    return sortBy(filterSuppliers(ds.all, { ...f, excludeIds: [replaceId] }), s.f, s.dir);
  }, [ds, f, sort, replaceId]);

  if (!ds) return <Loading />;
  const toggle = <T extends string>(arr: T[] | undefined, v: T) => (arr?.includes(v) ? arr.filter((x) => x !== v) : [...(arr ?? []), v]);

  const addTop = () => {
    const n = addMany(results.slice(0, SHORTLIST_CAP).map((s) => s.id));
    setMsg(n ? `Added ${n}.` : `Shortlist full (${SHORTLIST_CAP}).`);
  };

  return (
    <div>
      <PageHeader step="Step 2 · Narrow" title={`10,000 → ${results.length.toLocaleString("en")} → shortlist of ${SHORTLIST_CAP}`}
        sub={<>Find candidates for qualification to replace <span className="num">{replaceId}</span>. Filter on any of the 18 risk scores and the operational metrics.</>}>
        <Link href="/compare" className="btn btn-primary">Compare shortlist ({shortlist.length}) →</Link>
      </PageHeader>

      <div className="grid grid-cols-[260px_1fr_240px] gap-5">
        {/* Filters */}
        <aside className="text-[13px] space-y-4">
          <div>
            <div className="label mb-1">Quick filters</div>
            {QUICK.map((q) => <button key={q.label} className="btn w-full text-left mb-1 text-[12px]" onClick={() => { setFilters(q.f); log("Narrow", `Filter: ${q.label}`); }}>{q.label}</button>)}
            <button className="text-muted underline text-[12px]" onClick={() => setFilters({})}>Clear all filters</button>
          </div>
          <div>
            <div className="label mb-1">Search name / ID</div>
            <input className="input w-full" value={f.nameQuery ?? ""} onChange={(e) => set({ nameQuery: e.target.value })} placeholder="e.g. Apex" />
          </div>
          <div>
            <div className="label mb-1">Total Risk Index level</div>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <label key={l} className="flex items-center gap-1"><input type="checkbox" checked={!!f.levels?.tri?.includes(l)} onChange={() => set({ levels: { ...f.levels, tri: toggle<Level>(f.levels?.tri, l) } })} />{l}</label>
              ))}
            </div>
          </div>
          <RangeInput label="TRI" k="tri" f={f} setRange={setRange} />
          <RangeInput label="Delivery rating %" k="del" f={f} setRange={setRange} />
          <RangeInput label="Confirmation rate %" k="conf" f={f} setRange={setRange} />
          <RangeInput label="Order change rate %" k="chg" f={f} setRange={setRange} />
          <RangeInput label="PO volume €" k="po" f={f} setRange={setRange} />
          <div>
            <div className="label mb-1">Risk score ranges</div>
            {dimRanges.map((d) => (
              <div key={d.key} className="flex items-center gap-1 mb-1">
                <span className="flex-1 truncate">{SCORES.find((s) => s.key === d.key)!.label}</span>
                <input className="input w-12 num" value={d.min} onChange={(e) => setRange(d.key, 0, e.target.value)} placeholder="min" />
                <input className="input w-12 num" value={d.max} onChange={(e) => setRange(d.key, 1, e.target.value)} placeholder="max" />
                <button className="text-muted" onClick={() => { const r = { ...f.ranges }; delete r[d.key]; set({ ranges: r }); }}>×</button>
              </div>
            ))}
            <div className="flex gap-1">
              <select className="input flex-1" value={newDim} onChange={(e) => setNewDim(e.target.value as ScoreKey)}>
                {SCORES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button className="btn" onClick={() => set({ ranges: { ...f.ranges, [newDim]: [null, 49] } })}>+ add</button>
            </div>
          </div>
          <Checks label="Sourcing risk level" values={["Low", "Medium", "High"]} sel={f.sourcing} onToggle={(v) => set({ sourcing: toggle(f.sourcing, v) })} />
          <Checks label="Supply chain complexity" values={["Simple", "Moderate", "Complex"]} sel={f.complexity} onToggle={(v) => set({ complexity: toggle(f.complexity, v) })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.hiddenRiskOnly} onChange={(e) => set({ hiddenRiskOnly: e.target.checked })} />Hidden risk only</label>
        </aside>

        {/* Results */}
        <section className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="num">{results.length.toLocaleString("en")}</span> matches
            <select className="input ml-auto" value={sort} onChange={(e) => setSort(Number(e.target.value))}>
              {SORTS.map((s, i) => <option key={s.label} value={i}>Sort: {s.label}</option>)}
            </select>
            <button className="btn btn-primary" onClick={addTop} disabled={!results.length}>Add top {Math.min(SHORTLIST_CAP, results.length)} to shortlist</button>
          </div>
          {msg && <div className="text-muted text-[12px] mb-1">{msg}</div>}
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-fg text-left">
              <th className="py-1.5 font-medium">Supplier</th><th className="font-medium">TRI</th><th className="font-medium">Financial</th>
              <th className="font-medium">Critical dims</th><th className="font-medium text-right">Delivery</th><th className="font-medium text-right">Confirm.</th>
              <th className="font-medium text-right">PO</th><th className="font-medium">Sourcing</th><th />
            </tr></thead>
            <tbody>
              {results.slice(0, 100).map((s) => {
                const hr = hiddenRisk(s);
                const inList = shortlist.includes(s.id);
                return (
                  <tr key={s.id} className="border-b border-line">
                    <td className="py-1"><span className="num">{s.id}</span> <span className="text-muted">{s.name}</span></td>
                    <td><LevelTag score={s.tri} /></td>
                    <td><LevelTag score={s.s[1]} /></td>
                    <td>{hr.criticalDims.length ? <span>{hr.criticalDims.length}{hr.flag && <span className="label ml-1">hidden</span>}</span> : <span className="text-muted">0</span>}</td>
                    <td className="num text-right">{s.del.toFixed(1)}</td>
                    <td className="num text-right">{s.conf.toFixed(1)}</td>
                    <td className="num text-right" title={`Exposure ${fmtEur(exposure(s))}`}>{fmtEur(s.po)}</td>
                    <td>{s.src}</td>
                    <td className="text-right">{inList ? <button className="btn text-[11px]" onClick={() => remove(s.id)}>✓ Listed</button> : <button className="btn text-[11px]" disabled={shortlist.length >= SHORTLIST_CAP} onClick={() => add(s.id)}>+ Add</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {results.length > 100 && <div className="text-muted mt-2 text-[12px]">Showing first 100 of {results.length.toLocaleString("en")}. Tighten filters or sort.</div>}
        </section>

        {/* Shortlist */}
        <aside className="text-[12px]">
          <div className="flex items-center mb-1">
            <span className="label">Shortlist {shortlist.length}/{SHORTLIST_CAP}</span>
            {shortlist.length > 0 && <button className="ml-auto text-muted underline" onClick={clearShortlist}>clear</button>}
          </div>
          {shortlist.length === 0 && <p className="text-muted">Add up to 20 suppliers.</p>}
          {shortlist.map((id) => {
            const s = ds.byId.get(id)!;
            return (
              <div key={id} className="flex items-center gap-2 border-b border-line py-1">
                <span className="num">{id}</span><LevelTag score={s.tri} />
                <button className="ml-auto text-muted" onClick={() => remove(id)}>×</button>
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}

function RangeInput({ label, k, f, setRange }: { label: string; k: NumField; f: FilterCriteria; setRange: (k: NumField, i: 0 | 1, v: string) => void }) {
  const r = f.ranges?.[k] ?? [null, null];
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="flex gap-1 items-center">
        <input className="input w-full num" placeholder="min" value={r[0] ?? ""} onChange={(e) => setRange(k, 0, e.target.value)} />
        <span className="text-muted">–</span>
        <input className="input w-full num" placeholder="max" value={r[1] ?? ""} onChange={(e) => setRange(k, 1, e.target.value)} />
      </div>
    </div>
  );
}

function Checks({ label, values, sel, onToggle }: { label: string; values: string[]; sel?: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => <label key={v} className="flex items-center gap-1"><input type="checkbox" checked={!!sel?.includes(v)} onChange={() => onToggle(v)} />{v}</label>)}
      </div>
    </div>
  );
}
