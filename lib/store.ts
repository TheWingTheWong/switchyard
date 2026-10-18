"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OPENING_CASE_ID, SHORTLIST_CAP } from "./schema";
import type { FilterCriteria, Weights } from "./engine";
import type { ResearchReport } from "./research-types";

export interface AuditEntry { at: string; step: string; text: string; }
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
  log: (step: string, text: string) => void;
  setChatOpen: (o: boolean) => void;
  reset: () => void;
}

const initial = {
  replaceId: OPENING_CASE_ID, shortlist: [] as string[], pickId: null, filters: {} as FilterCriteria,
  presetId: "official", customWeights: null, challenge: null, research: null, memo: null,
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
      setResearch: (research) => { set({ research }); if (research) get().log("Verify", `Researched ${research.company}: ${research.redFlags.length} red flags, ${research.sources.length} sources`); },
      setMemo: (memo) => set({ memo }),
      log: (step, text) => set({ audit: [...get().audit, { at: new Date().toISOString(), step, text }].slice(-100) }),
      setChatOpen: (chatOpen) => set({ chatOpen }),
      reset: () => set({ ...initial, audit: [] }),
    }),
    { name: "switchyard-v1" },
  ),
);
