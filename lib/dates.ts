// Deterministic event-date extraction from text. Pure; never invents: returns null when nothing in the text says.
// Order of trust: regulator / docket ids (encode the filing year) → "Month YYYY" → a plain 20xx year (earliest wins,
// which is conservative: an older event is treated as history rather than as new evidence).

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON3 = MONTHS.map((m) => m.slice(0, 3));
const maxYear = () => new Date().getFullYear() + 1;
const okYear = (y: number) => y >= 1900 && y <= maxYear();

/** Normalise an LLM / API date ("2025-12", "2025-12-04", "December 2025", "2025") to "YYYY-MM" or "YYYY"; else null. */
export function normalizeEventDate(d: unknown): string | null {
  const s = String(d ?? "").trim().toLowerCase();
  if (!s || s === "null" || s === "unknown") return null;
  let m = s.match(/^(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.]\d{1,2})?(?:t.*)?$/);
  if (m) {
    const y = Number(m[1]), mo = m[2] ? Number(m[2]) : 0;
    if (!okYear(y)) return null;
    return mo >= 1 && mo <= 12 ? `${y}-${String(mo).padStart(2, "0")}` : String(y);
  }
  m = s.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const i = MON3.indexOf(m[1].slice(0, 3));
    const y = Number(m[2]);
    if (i >= 0 && okYear(y)) return `${y}-${String(i + 1).padStart(2, "0")}`;
  }
  return null;
}

/** Event date from free text (title, detail, snippet, URL). */
export function eventDateFromText(...parts: (string | null | undefined)[]): string | null {
  const t = parts.filter(Boolean).join(" \n ");
  if (!t) return null;
  // NHTSA campaign / equipment ids: 24V-559, 25E048, 23E-012 → 2024 / 2025 / 2023.
  const nhtsa = t.match(/\b(\d{2})([VEICT])-?(\d{3})\b/);
  if (nhtsa) { const y = 2000 + Number(nhtsa[1]); if (okYear(y)) return String(y); }
  // US federal docket ids: 2:18-cv-00469, 1:21-cr-123 → 2018 / 2021.
  const docket = t.match(/\b\d:(\d{2})-(?:cv|cr|mc|md)-\d{2,6}\b/i);
  if (docket) { const y = 2000 + Number(docket[1]); if (okYear(y)) return String(y); }
  // "December 2025", "Dec. 2025".
  const month = t.toLowerCase().match(new RegExp(`\\b(${MONTHS.join("|")}|${MON3.join("|")})\\.?\\s+(?:\\d{1,2},?\\s+)?((?:19|20)\\d{2})\\b`));
  if (month) {
    const y = Number(month[2]);
    const i = MON3.indexOf(month[1].slice(0, 3));
    if (okYear(y) && i >= 0) return `${y}-${String(i + 1).padStart(2, "0")}`;
  }
  // Plain years (incl. /2025/ in URLs); earliest valid one.
  const years = [...t.matchAll(/(?<![\d.])((?:19|20)\d{2})(?![\d])/g)].map((m) => Number(m[1])).filter(okYear).sort((a, b) => a - b);
  return years.length ? String(years[0]) : null;
}
