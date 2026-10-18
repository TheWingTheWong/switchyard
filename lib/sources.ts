// Deterministic source credibility. Decided in code from the URL's domain, never by the LLM.
// Tier 1 (1.0):      regulators, government, courts, exchanges/regulated disclosures, the company's own domains.
// Tier 2 (0.7):      reputable news and trade press.
// Unrated (0.35):    any other domain — counts a little.
// Blocked (0):       social media, blogs, plaintiff/law-firm marketing, SEO aggregators — shown, never counted.

export type SourceTier = "1" | "2" | "unrated" | "blocked";
export const TIER_FACTOR: Record<SourceTier, number> = { "1": 1, "2": 0.7, unrated: 0.35, blocked: 0 };
/** Higher = more credible; used to pick the best tier among corroborating URLs. */
export const TIER_RANK: Record<SourceTier, number> = { "1": 3, "2": 2, unrated: 1, blocked: 0 };

const TIER1 = [
  "nhtsa.gov", "federalregister.gov", "justice.gov", "sec.gov", "europa.eu", "uscourts.gov", "gov.uk", "gov.au",
  "bundesanzeiger.de", "unternehmensregister.de", "bafin.de", "bundeskartellamt.de",
  "deutsche-boerse.com", "boerse-frankfurt.de", "londonstockexchange.com", "euronext.com", "annualreports.com",
  "eqs-news.com",
];
const TIER2 = [
  "reuters.com", "bloomberg.com", "ft.com", "handelsblatt.com", "freightwaves.com", "railwaygazette.com",
  "railjournal.com", "just-auto.com", "apnews.com", "bbc.co.uk", "bbc.com", "wsj.com", "heise.de",
  "vitallaw.com", "business-humanrights.org", "worktruckonline.com", "fleetowner.com", "pymnts.com",
  "baltimoresun.com", "thebrakereport.com", "railtarget.eu", "trains.com", "progressiverailroading.com",
];
const BLOCKED = [
  "linkedin.com", "facebook.com", "x.com", "twitter.com", "reddit.com", "medium.com", "substack.com",
  "youtube.com", "tiktok.com",
  "classaction.org", "hausfeld.com", "lieffcabraser.com", "saverilawfirm.com", "frankllp.com", "topclassactions.com",
  "easylemon.com", "dealroom.co", "fundslibrary.co.uk",
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
  if (!host) return "blocked";
  if (BLOCKED.some((d) => matches(host, d))) return "blocked";
  if (/\.gov$|\.gov\.[a-z]{2}$|\.gouv\.fr$|\.bund\.de$/.test(host) || host.startsWith("ir.") || TIER1.some((d) => matches(host, d)) || isCompanyDomain(host, company)) return "1";
  if (TIER2.some((d) => matches(host, d))) return "2";
  return "unrated";
}

export const tierLabel = (t: SourceTier) =>
  t === "1" ? "tier 1 (regulator / filing / company)" : t === "2" ? "tier 2 (reputable / trade press)" : t === "unrated" ? "unrated source" : "blocked source";
