import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { indexDataset, type Dataset } from "./engine";
import type { Supplier } from "./schema";

let ds: Dataset | null = null;
export function getDataset(): Dataset {
  if (!ds) {
    const all = JSON.parse(readFileSync(path.join(process.cwd(), "public", "suppliers.json"), "utf8")) as Supplier[];
    ds = indexDataset(all);
  }
  return ds;
}
