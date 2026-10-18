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
  { label: "Proven at scale: PO ≥ €10M, TRI ≤ 49, confirmation ≥ 97%", f: { ranges: { po: [10_000_000, null], tri: [null, 49], conf: [97, null] } } },
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

      <div className="grid gap-6 grid-cols-[220px_minmax(0,1fr)] @min-[1240px]:grid-cols-[244px_minmax(0,1fr)_220px] items-start">
        {/* Filters */}
        <aside className="text-[13px] space-y-4">
          <div>
            <div className="cap mb-1.5">Quick filters</div>
            {QUICK.map((q) => <button key={q.label} className="btn btn-quiet w-full !whitespace-normal text-left mb-1 text-[12px] leading-snug !items-start" onClick={() => { setFilters(q.f); log("Narrow", `Filter: ${q.label}`); }}>{q.label}</button>)}
            <button className="linkish text-[12px]" onClick={() => setFilters({})}>Clear all filters</button>
          </div>
          <div className="@min-[1240px]:hidden"><ShortlistPanel ids={shortlist} ds={ds} remove={remove} clear={clearShortlist} /></div>
          <div>
            <div className="cap mb-1">Search name / ID</div>
            <input className="input w-full" value={f.nameQuery ?? ""} onChange={(e) => set({ nameQuery: e.target.value })} placeholder="e.g. Apex" />
          </div>
          <div>
            <div className="cap mb-1">Total Risk Index level</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
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
            <div className="cap mb-1">Risk score ranges</div>
            {dimRanges.map((d) => (
              <div key={d.key} className="flex items-center gap-1 mb-1">
                <span className="flex-1 truncate">{SCORES.find((s) => s.key === d.key)!.label}</span>
                <input className="input w-12 num" value={d.min} onChange={(e) => setRange(d.key, 0, e.target.value)} placeholder="min" />
                <input className="input w-12 num" value={d.max} onChange={(e) => setRange(d.key, 1, e.target.value)} placeholder="max" />
                <button className="linkish px-1 no-underline" aria-label="Remove range" onClick={() => { const r = { ...f.ranges }; delete r[d.key]; set({ ranges: r }); }}>×</button>
              </div>
            ))}
            <div className="flex gap-1">
              <select className="input flex-1 min-w-0" value={newDim} onChange={(e) => setNewDim(e.target.value as ScoreKey)}>
                {SCORES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button className="btn btn-quiet" onClick={() => set({ ranges: { ...f.ranges, [newDim]: [null, 49] } })}>+ add</button>
            </div>
          </div>
          <Checks label="Sourcing risk level" values={["Low", "Medium", "High"]} sel={f.sourcing} onToggle={(v) => set({ sourcing: toggle(f.sourcing, v) })} />
          <Checks label="Supply chain complexity" values={["Simple", "Moderate", "Complex"]} sel={f.complexity} onToggle={(v) => set({ complexity: toggle(f.complexity, v) })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.hiddenRiskOnly} onChange={(e) => set({ hiddenRiskOnly: e.target.checked })} />Hidden risk only</label>
        </aside>

        {/* Results */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="display text-[20px]"><span className="num">{results.length.toLocaleString("en")}</span> matches</span>
            <select className="input ml-auto text-[12.5px]" value={sort} onChange={(e) => setSort(Number(e.target.value))}>
              {SORTS.map((s, i) => <option key={s.label} value={i}>Sort: {s.label}</option>)}
            </select>
            <button className="btn btn-primary" onClick={addTop} disabled={!results.length}>Add top {Math.min(SHORTLIST_CAP, results.length)} to shortlist</button>
          </div>
          {msg && <div className="text-stamp font-medium text-[12px] mb-1" role="status">{msg}</div>}
          <div className="sheet overflow-x-auto">
          <table className="tbl tbl-tight text-[12px]">
            <thead><tr>
              <th>Supplier</th><th>TRI</th><th>Financial</th>
              <th>Crit. dims</th><th className="r">Delivery</th><th className="r">Confirm.</th>
              <th className="r">PO</th><th className="@max-[1100px]:hidden">Sourcing</th><th />
            </tr></thead>
            <tbody>
              {results.slice(0, 100).map((s) => {
                const hr = hiddenRisk(s);
                const inList = shortlist.includes(s.id);
                return (
                  <tr key={s.id} className={inList ? "is-listed" : ""}>
                    <td className="leading-tight"><div className="num font-medium">{s.id}</div><div className="text-muted text-[11px] whitespace-nowrap">{s.name}</div></td>
                    <td><LevelTag score={s.tri} /></td>
                    <td><LevelTag score={s.s[1]} /></td>
                    <td className="whitespace-nowrap">{hr.criticalDims.length ? <span className="num font-semibold">{hr.criticalDims.length}{hr.flag && <span className="cap ml-1 !text-[var(--risk-critical)]">hidden</span>}</span> : <span className="num text-muted">0</span>}</td>
                    <td className="num r">{s.del.toFixed(1)}</td>
                    <td className="num r">{s.conf.toFixed(1)}</td>
                    <td className="num r whitespace-nowrap" title={`Exposure ${fmtEur(exposure(s))}`}>{fmtEur(s.po)}</td>
                    <td className="@max-[1100px]:hidden">{s.src}</td>
                    <td className="r">{inList ? <button className="btn btn-quiet text-[11px] !min-h-[24px] !py-0 !text-stamp !border-stamp" onClick={() => remove(s.id)}>✓ Listed</button> : <button className="btn btn-quiet text-[11px] !min-h-[24px] !py-0" disabled={shortlist.length >= SHORTLIST_CAP} onClick={() => add(s.id)}>+ Add</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {results.length > 100 && <div className="text-muted mt-2 text-[12px]">Showing first 100 of {results.length.toLocaleString("en")}. Tighten filters or sort.</div>}
        </section>

        {/* Shortlist (wide screens) */}
        <aside className="hidden @min-[1240px]:block sticky top-20"><ShortlistPanel ids={shortlist} ds={ds} remove={remove} clear={clearShortlist} /></aside>
      </div>
    </div>
  );
}

function ShortlistPanel({ ids, ds, remove, clear }: { ids: string[]; ds: NonNullable<ReturnType<typeof useDataset>>; remove: (id: string) => void; clear: () => void }) {
  return (
    <div className="sheet text-[12px]">
      <div className="flex items-center px-3 py-2 border-b border-fg">
        <span className="cap !text-fg">Shortlist <span className="num">{ids.length}/{SHORTLIST_CAP}</span></span>
        {ids.length > 0 && <button className="ml-auto linkish" onClick={clear}>clear</button>}
      </div>
      <div className="h-1 bg-surface"><div className="h-1 bg-stamp" style={{ width: `${(ids.length / SHORTLIST_CAP) * 100}%` }} /></div>
      {ids.length === 0 && <p className="text-muted px-3 py-3">Add up to 20 suppliers.</p>}
      <div className="max-h-[300px] overflow-y-auto">
        {ids.map((id) => {
          const s = ds.byId.get(id)!;
          return (
            <div key={id} className="flex items-center gap-2 border-b border-line last:border-b-0 px-3 py-1">
              <span className="num">{id}</span><LevelTag score={s.tri} />
              <button className="ml-auto linkish no-underline px-1" aria-label={`Remove ${id}`} onClick={() => remove(id)}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RangeInput({ label, k, f, setRange }: { label: string; k: NumField; f: FilterCriteria; setRange: (k: NumField, i: 0 | 1, v: string) => void }) {
  const r = f.ranges?.[k] ?? [null, null];
  return (
    <div>
      <div className="cap mb-1">{label}</div>
      <div className="flex gap-1 items-center">
        <input className="input w-full num" placeholder="min" value={r[0] ?? ""} onChange={(e) => setRange(k, 0, e.target.value)} />
        <span className="text-faint">–</span>
        <input className="input w-full num" placeholder="max" value={r[1] ?? ""} onChange={(e) => setRange(k, 1, e.target.value)} />
      </div>
    </div>
  );
}

function Checks({ label, values, sel, onToggle }: { label: string; values: string[]; sel?: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <div className="cap mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => <label key={v} className="flex items-center gap-1"><input type="checkbox" checked={!!sel?.includes(v)} onChange={() => onToggle(v)} />{v}</label>)}
      </div>
    </div>
  );
}
