"use client";
import { useEffect, useState } from "react";
import { indexDataset, type Dataset } from "./engine";
import type { Supplier } from "./schema";

let cache: Dataset | null = null;
let pending: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch("/suppliers.json")
    .then((r) => r.json() as Promise<Supplier[]>)
    .then((all) => (cache = indexDataset(all)));
  return pending;
}

export function useDataset(): Dataset | null {
  const [ds, setDs] = useState<Dataset | null>(cache);
  useEffect(() => { if (!ds) loadDataset().then(setDs); }, [ds]);
  return ds;
}
