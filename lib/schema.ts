// Single source of truth for score keys, labels, weights and level thresholds.

export type ScoreKey =
  | "operational" | "financial" | "quality"
  | "compliance"
  | "credit" | "safety" | "subTier"
  | "geopolitical" | "governance" | "esg"
  | "environmental" | "labor" | "digital" | "political" | "benchmark"
  | "market" | "media" | "external";

export interface ScoreDef {
  key: ScoreKey;
  column: string; // CSV column name
  label: string;
  weight: number; // recovered TRI weight (R² 0.9996, sums to 1.00)
  description: string;
}

export const SCORES: ScoreDef[] = [
  { key: "operational", column: "Operational_Resilience_Score", label: "Operational Resilience", weight: 0.10, description: "Risks affecting the day-to-day production and logistics capabilities." },
  { key: "financial", column: "Financial_Health_Score", label: "Financial Health", weight: 0.10, description: "Evaluation of the supplier's financial stability, liquidity, and bankruptcy risk." },
  { key: "quality", column: "Quality_Risk_Score", label: "Quality Risk", weight: 0.10, description: "Risk related to product defects, recalls, or quality management failures." },
  { key: "compliance", column: "Compliance_Risk_Score", label: "Compliance Risk", weight: 0.08, description: "Risk involving lawsuits, regulatory fines, or legal disputes." },
  { key: "credit", column: "Credit_Rating_Score", label: "Credit Rating", weight: 0.06, description: "Financial creditworthiness based on international rating standards." },
  { key: "safety", column: "Safety_Incident_Score", label: "Safety Incident", weight: 0.06, description: "Frequency and severity of industrial accidents or safety violations." },
  { key: "subTier", column: "Sub_Tier_Visibility_Score", label: "Sub-Tier Visibility", weight: 0.06, description: "Assessment of risks within the supplier's own supply chain (Tier-N)." },
  { key: "geopolitical", column: "Geopolitical_Risk_Score", label: "Geopolitical Risk", weight: 0.05, description: "Exposure to humanitarian crises or regional instability." },
  { key: "governance", column: "Governance_Risk_Score", label: "Governance Risk", weight: 0.05, description: "Assessment of corporate leadership, ethics, and internal controls." },
  { key: "esg", column: "ESG_Performance_Score", label: "ESG Performance", weight: 0.05, description: "Sustainability and ethical practices (Environmental, Social, Governance pillars)." },
  { key: "environmental", column: "Environmental_Exposure_Score", label: "Environmental Exposure", weight: 0.04, description: "Exposure to geographical risks like earthquakes, floods, or extreme weather events." },
  { key: "labor", column: "Labor_Stability_Score", label: "Labor Stability", weight: 0.04, description: "Risk of strikes, protests, or significant labor disputes at supplier locations." },
  { key: "digital", column: "Digital_Security_Score", label: "Digital Security", weight: 0.04, description: "Vulnerability to data breaches, hacking, or digital infrastructure failures." },
  { key: "political", column: "Political_Stability_Score", label: "Political Stability", weight: 0.04, description: "Risk of political unrest or government changes affecting operations." },
  { key: "benchmark", column: "Industry_Benchmark_Score", label: "Industry Benchmark", weight: 0.04, description: "Comparison of the supplier's risk performance against industry peers and regional standards." },
  { key: "market", column: "Market_Sentiment_Score", label: "Market Sentiment", weight: 0.03, description: "Public and consumer perception risks affecting the supplier." },
  { key: "media", column: "Media_Sentiment_Score", label: "Media Sentiment", weight: 0.03, description: "Real-time risk monitoring based on news, social media, and public reports." },
  { key: "external", column: "External_Intelligence_Score", label: "External Intelligence", weight: 0.03, description: "Risk data derived from third-party intelligence and external databases." },
];

export const SCORE_KEYS: ScoreKey[] = SCORES.map((s) => s.key);
export const SCORE_BY_KEY = Object.fromEntries(SCORES.map((s) => [s.key, s])) as Record<ScoreKey, ScoreDef>;
export const OFFICIAL_WEIGHTS = Object.fromEntries(SCORES.map((s) => [s.key, s.weight])) as Record<ScoreKey, number>;

export type Level = "Low" | "Medium" | "High" | "Critical";
export const LEVELS: Level[] = ["Low", "Medium", "High", "Critical"];
export const LEVEL_RANGES: Record<Level, [number, number]> = {
  Low: [0, 24], Medium: [25, 49], High: [50, 74], Critical: [75, 100],
};

export type Category3 = "Low" | "Medium" | "High";
export type Complexity = "Simple" | "Moderate" | "Complex" | string;

/** Compact supplier record as shipped in public/suppliers.json */
export interface Supplier {
  id: string;
  name: string;
  tri: number;
  s: number[]; // 18 scores in SCORES order
  po: number; // Purchase Order Volume EUR
  chg: number; // Order Change Rate %
  del: number; // Supplier Delivery Rating %
  conf: number; // Order Confirmation Rate %
  src: string; // Sourcing Risk Level
  cx: string; // Supply Chain Complexity
}

export const OPS_METRICS = [
  { key: "po", label: "PO Volume (EUR)", description: "The total financial value of orders placed with the supplier, indicating financial exposure." },
  { key: "chg", label: "Order Change Rate %", description: "The frequency of changes to existing orders, expressed as a percentage (0-100%)." },
  { key: "del", label: "Delivery Rating %", description: "Delivery timeliness and accuracy, expressed as a percentage (0-100%)." },
  { key: "conf", label: "Order Confirmation Rate %", description: "Rate at which the supplier confirms orders within the requested timeframe (0-100%)." },
  { key: "src", label: "Sourcing Risk Level", description: "Internal assessment of the difficulty in replacing the supplier or finding alternative sources." },
  { key: "cx", label: "Supply Chain Complexity", description: "The complexity of the supply chain associated with the supplier (e.g., logistics routes, sub-tiers)." },
] as const;

export const OPENING_CASE_ID = "SUPP_09733";
export const SHORTLIST_CAP = 20;
