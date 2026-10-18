// Deterministic source credibility. Decided in code from the URL's domain, never by the LLM.
// Tier 1 (1.0): regulators, government, courts, exchanges/filings, the company's own domains.
// Tier 2 (0.7): reputable news and trade press.
// Tier 3 (0):   everything else — shown, never counted.

export type SourceTier = 1 | 2 | 3;
export const TIER_FACTOR: Record<SourceTier, number> = { 1: 1, 2: 0.7, 3: 0 };

const TIER1 = [
  "nhtsa.gov", "federalregister.gov", "justice.gov", "sec.gov", "europa.eu", "uscourts.gov", "gov.uk",
  "bundesanzeiger.de", "unternehmensregister.de", "bafin.de", "bundeskartellamt.de", "eba.europa.eu",
  "deutsche-boerse.com", "boerse-frankfurt.de", "londonstockexchange.com", "euronext.com", "annualreports.com",
];
const TIER2 = [
  "reuters.com", "bloomberg.com", "ft.com", "handelsblatt.com", "freightwaves.com", "railwaygazette.com",
  "railjournal.com", "just-auto.com", "apnews.com", "bbc.co.uk", "bbc.com", "wsj.com", "heise.de",
];

export function hostOf(url: string | null | undefined): string {
  try { return new URL(String(url)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

const matches = (host: string, domain: string) => host === domain || host.endsWith("." + domain);

/** Company's own domains: the hostname contains the company name with punctuation removed ("knorr-bremse.com" ↔ "Knorr-Bremse"). */
function isCompanyDomain(host: string, company?: string): boolean {
  const slug = String(company ?? "").toLowerCase().replace(/\b(ag|se|sa|plc|inc|gmbh|ltd|corp|group)\b/g, "").replace(/[^a-z0-9]/g, "");
  if (slug.length < 4) return false;
  const labels = host.split(".").slice(0, -1).join("").replace(/[^a-z0-9]/g, ""); // drop TLD
  return labels.includes(slug);
}

export function sourceTier(url: string | null | undefined, company?: string): SourceTier {
  const host = hostOf(url);
  if (!host) return 3;
  if (/\.gov$|\.gov\.[a-z]{2}$|\.gouv\.fr$|\.bund\.de$/.test(host) || TIER1.some((d) => matches(host, d)) || isCompanyDomain(host, company)) return 1;
  if (TIER2.some((d) => matches(host, d))) return 2;
  return 3;
}

export const tierLabel = (t: SourceTier) => (t === 1 ? "regulator / filing / company" : t === 2 ? "reputable press" : "not credible enough");
