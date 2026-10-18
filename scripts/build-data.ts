// CSV → public/suppliers.json (compact). Run: pnpm build:data
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import Papa from "papaparse";
import { SCORES, type Supplier } from "../lib/schema";

const csv = readFileSync("data/supplier_risk_dataset.csv", "utf8");
const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });

const suppliers: Supplier[] = data.map((r) => ({
  id: r.supplierID,
  name: r["Supplier Name"],
  tri: Number(r.Total_Risk_Index),
  s: SCORES.map((d) => Number(r[d.column])),
  po: Number(r["Purchase Order Volume (EUR)"]),
  chg: Number(r["Order Change Rate"]),
  del: Number(r["Supplier Delivery Rating"]),
  conf: Number(r["Order Confirmation Rate"]),
  src: r["Sourcing Risk Level"],
  cx: r["Supply Chain Complexity"],
}));

mkdirSync("public", { recursive: true });
writeFileSync("public/suppliers.json", JSON.stringify(suppliers));
console.log(`wrote ${suppliers.length} suppliers`);
