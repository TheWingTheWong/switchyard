"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OPENING_CASE_ID, SHORTLIST_CAP } from "./schema";
import { defaultAsOf, type EvidenceAdjustment, type EvidenceRow, type FilterCriteria, type Weights } from "./engine";
import type { ResearchReport } from "./research-types";

export interface AuditEntry { at: string; step: string; text: string; }
/** Research evidence applied to one dataset supplier (the buyer's assumption that the row is that company). */
export interface AppliedEvidence { supplierId: string; company: string; asOf: string; rows: EvidenceRow[]; officialTri: number; adjustedTri: number; activeHighFlags?: EvidenceAdjustment["activeHighFlags"]; appliedAt: string; }

export interface ChallengeResult { pickId: string; hidden: { flag: boolean; criticalDims: string[] }; wins: number; total: number; critique?: string; }

interface State {
  replaceId: string;
  shortlist: string[];
  pickId: string | null;
  filters: FilterCriteria;
  presetId: string;
  customWeights: Weights | null;
  challenge: ChallengeResult | null;
  research: ResearchReport | null;
  memo: string | null;
  evidence: AppliedEvidence | null;
  asOf: string;
  audit: AuditEntry[];
  chatOpen: boolean;
  setReplace: (id: string) => void;
  add: (id: string) => boolean;
  addMany: (ids: string[]) => number;
  remove: (id: string) => void;
  clearShortlist: () => void;
  setPick: (id: string | null) => void;
  setFilters: (f: FilterCriteria) => void;
  setPreset: (id: string) => void;
  setCustomWeights: (w: Weights | null) => void;
  setChallenge: (c: ChallengeResult | null) => void;
  setResearch: (r: ResearchReport | null) => void;
  setMemo: (m: string | null) => void;
  setEvidence: (e: AppliedEvidence | null) => void;
  setAsOf: (d: string) => void;
  log: (step: string, text: string) => void;
  setChatOpen: (o: boolean) => void;
  reset: () => void;
}

const initial = {
  replaceId: OPENING_CASE_ID, shortlist: [] as string[], pickId: null, filters: {} as FilterCriteria,
  presetId: "official", customWeights: null, challenge: null, research: null, memo: null, evidence: null as AppliedEvidence | null, asOf: defaultAsOf(),
  audit: [] as AuditEntry[], chatOpen: true,
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      setReplace: (id) => { set({ replaceId: id }); get().log("Triage", `Supplier to replace: ${id}`); },
      add: (id) => {
        const { shortlist } = get();
        if (shortlist.includes(id)) return true;
        if (shortlist.length >= SHORTLIST_CAP) return false;
        set({ shortlist: [...shortlist, id] });
        return true;
      },
      addMany: (ids) => {
        const cur = get().shortlist;
        const next = [...cur];
        for (const id of ids) if (!next.includes(id) && next.length < SHORTLIST_CAP) next.push(id);
        set({ shortlist: next });
        get().log("Narrow", `Shortlist now ${next.length} suppliers`);
        return next.length - cur.length;
      },
      remove: (id) => set({ shortlist: get().shortlist.filter((x) => x !== id), pickId: get().pickId === id ? null : get().pickId }),
      clearShortlist: () => set({ shortlist: [], pickId: null }),
      setPick: (id) => { set({ pickId: id, challenge: null }); if (id) get().log("Compare", `Buyer's pick: ${id}`); },
      setFilters: (filters) => set({ filters }),
      setPreset: (presetId) => set({ presetId }),
      setCustomWeights: (customWeights) => set({ customWeights }),
      setChallenge: (challenge) => set({ challenge }),
      setResearch: (research) => { set({ research, evidence: null }); // new research invalidates any applied evidence
        if (research) get().log("Verify", `Researched ${research.company}: ${research.redFlags.length} red flags, ${research.sources.length} sources`); },
      setMemo: (memo) => set({ memo }),
      setEvidence: (evidence) => {
        set({ evidence });
        if (evidence) {
          const d = Math.round((evidence.adjustedTri - evidence.officialTri) * 10) / 10;
          get().log("Verify", `Evidence from ${evidence.company} applied to ${evidence.supplierId} (assumption, as-of ${evidence.asOf}): official TRI ${evidence.officialTri} → evidence-adjusted ${evidence.adjustedTri} (${d >= 0 ? "+" : ""}${d}); ${evidence.rows.filter((r) => r.counted).length} dimensions counted`);
        }
      },
      setAsOf: (asOf) => set({ asOf }),
      log: (step, text) => set({ audit: [...get().audit, { at: new Date().toISOString(), step, text }].slice(-100) }),
      setChatOpen: (chatOpen) => set({ chatOpen }),
      reset: () => set({ ...initial, audit: [] }),
    }),
    { name: "switchyard-v1" },
  ),
);
