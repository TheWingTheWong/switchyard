"use client";
import { useMemo } from "react";
import { evidenceAdjust, evidenceInputsFromReport } from "@/lib/engine";
import type { ResearchReport } from "@/lib/research-types";
import type { Supplier } from "@/lib/schema";
import { EvidenceVerdict } from "@/components/EvidenceVerdict";
import { useStore } from "@/lib/store";
import { LevelTag } from "./LevelTag";

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** Headline: Official TRI X → Evidence-adjusted Y (▲/▼Δ). Both numbers always shown, official first. */
export function EvidenceHeadline({ official, adjusted, size = "lg" }: { official: number; adjusted: number; size?: "lg" | "sm" }) {
  const d = Math.round((adjusted - official) * 10) / 10;
  const f1 = (v: number) => v.toFixed(1);
  const big = size === "lg" ? "text-[26px]" : "text-[16px]";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="cap">Official TRI</span>
      <span className={`num ${big} font-medium`}>{official}</span><LevelTag score={official} showScore={false} />
      <span className="text-muted">→</span>
      <span className="cap">Evidence-adjusted</span>
      <span className={`num ${big} font-semibold`}>{f1(adjusted)}</span><LevelTag score={adjusted} showScore={false} />
      <span className={`num font-semibold ${d > 0 ? "text-[var(--risk-critical)]" : d < 0 ? "text-[var(--pass)]" : "text-muted"}`}>{d > 0 ? `▲${f1(d)}` : d < 0 ? `▼${f1(-d)}` : "±0"}</span>
    </div>
  );
}

export function EvidenceAdjust({ report, supplier }: { report: ResearchReport; supplier: Supplier }) {
  const { asOf, setAsOf, evidence, setEvidence } = useStore();
  const adj = useMemo(() => evidenceAdjust(supplier, evidenceInputsFromReport(report), asOf, new Date(), report.company), [supplier, asOf, report]);
  const applied = evidence?.supplierId === supplier.id && evidence.company === report.company;
  const stale = applied && (evidence.asOf !== asOf || evidence.adjustedTri !== adj.adjustedTri || (evidence.activeHighFlags?.length ?? 0) !== adj.activeHighFlags.length);
  const counted = adj.rows.filter((r) => r.counted);
  const history = adj.rows.filter((r) => !r.counted && r.shadow != null);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start gap-4 mb-3">
        <div className="min-w-0">
          <h2 className="display text-[17px]">Apply evidence to {supplier.id}</h2>
          <p className="text-[12.5px] text-muted max-w-[68ch] mt-1">
            <strong className="text-fg">Assumption: {supplier.id} is {report.company}.</strong> The dataset is anonymised, so this link is the buyer&apos;s call.
            Only adverse red flags that are verified, dated after the data as-of date and from credible sources can move a score, and only upward: regulators and filings fully, reputable and trade press partly, unrated sources a little, social media / blogs / law-firm ads never.
            Positive news never raises risk. Older events are history, never counted twice. The official TRI is not changed.
          </p>
        </div>
        <label className="ml-auto text-[12px] flex flex-col gap-1">
          <span className="cap">Data as-of date</span>
          <input type="date" className="input num" value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-y border-line py-3 mb-3">
        <EvidenceHeadline official={adj.officialTri} adjusted={adj.adjustedTri} />
        <button className="btn btn-primary ml-auto" onClick={() => setEvidence({ supplierId: supplier.id, company: report.company, asOf, rows: adj.rows, officialTri: adj.officialTri, adjustedTri: adj.adjustedTri, activeHighFlags: adj.activeHighFlags, appliedAt: new Date().toISOString() })}>
          {applied && !stale ? `Applied to ${supplier.id} ✓` : `Apply evidence to ${supplier.id}`}
        </button>
        {applied && <button className="linkish text-[12px]" onClick={() => setEvidence(null)}>remove</button>}
      </div>
      {evidence && evidence.supplierId !== supplier.id && (
        <div className="mb-3 border-2 border-stamp bg-stamp-tint px-4 py-2 text-[13px]">
          Evidence was applied to <span className="num">{evidence.supplierId}</span> — re-apply to the new pick?
        </div>
      )}

      <table className="tbl tbl-tight text-[12px]">
        <thead><tr><th>Dimension</th><th className="r">Internal</th><th className="r">Shadow</th><th className="r">Adjusted</th><th className="r">Δ</th><th>Why</th><th>Source</th></tr></thead>
        <tbody>
          {counted.map((r) => (
            <tr key={r.key}>
              <td className="whitespace-nowrap">{r.label}</td>
              <td className="r"><LevelTag score={r.internal} /></td>
              <td className="num r">{r.shadow}</td>
              <td className="r"><LevelTag score={r.adjusted} /></td>
              <td className={`num r font-semibold ${r.delta > 0 ? "text-[var(--risk-critical)]" : r.delta < 0 ? "text-[var(--pass)]" : "text-muted"}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
              <td className="text-muted" title={`severity ${r.severityFactor} × confidence ${r.confidenceFactor} × recency ${r.recency} × status ${r.statusFactor} × source ${r.tierFactor} = ${r.factor}`}>{r.flagTitle && <span className="text-fg">{r.flagTitle} · </span>}{r.reason} <span className="num">· ×{r.factor.toFixed(3)}</span></td>
              <td className="max-w-[120px] truncate">{r.url ? <a className="underline underline-offset-2 decoration-[var(--line)] hover:text-stamp" href={r.url} target="_blank" rel="noopener noreferrer">{host(r.url)}</a> : "—"}</td>
            </tr>
          ))}
          {counted.length === 0 && <tr><td colSpan={7} className="text-muted">No evidence newer than the as-of date — the official scores stand.</td></tr>}
          {history.map((r) => (
            <tr key={r.key} className="text-muted">
              <td className="whitespace-nowrap">{r.label}</td>
              <td className="num r">{r.internal}</td>
              <td className="num r">{r.shadow}</td>
              <td className="num r">{r.adjusted}</td>
              <td className="num r">0</td>
              <td><em>Not counted: {r.reason.replace(/ — not counted$/, "")}</em>{r.flagTitle ? ` · ${r.flagTitle}` : ""}{r.eventDate ? <span className="num"> · {r.eventDate}</span> : null}{r.status !== "unknown" ? ` · ${r.status}` : ""}</td>
              <td className="max-w-[120px] truncate">{r.url ? <a className="underline underline-offset-2 decoration-[var(--line)]" href={r.url} target="_blank" rel="noopener noreferrer">{host(r.url)}</a> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[11px] text-muted mt-2 leading-snug">
        adjusted = internal + severity × confidence × recency × status × source × (shadow − internal), only upward and only with a counted red flag on that dimension (safety and quality share recall evidence). Conservative: scores never move down.
        Severity of the strongest counted red flag: high 0.6 · medium 0.35 · low 0.15. Confidence: high 1 · medium 0.85 · low 0.6. Recency: &lt;1y 1 · 1–3y 0.5 · 3–5y 0.25 · &gt;5y 0 · date unknown 0.25. Status: ongoing 1 · resolved 0.5 · unknown 0.75.
        Source (decided in code from the domain): tier 1 regulator / filing / company 1.0 · tier 2 reputable / trade press 0.7 · unrated 0.35 · social media / blogs / law-firm ads 0; corroborating sources → best tier. Unverified claims 0.
        Evidence-adjusted TRI uses the official weights. {adj.rows.filter((r) => r.shadow == null).length} dimensions had no evidence and keep their internal score.
      </div>
      {applied && <div className="mt-4"><EvidenceVerdict links /></div>}
    </div>
  );
}
