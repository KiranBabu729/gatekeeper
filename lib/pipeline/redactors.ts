import type { RedactionEntry } from "@/lib/schemas";

export type DetectorHit = Omit<RedactionEntry, "field">;

/**
 * Deterministic (regex/dictionary) redaction detectors. These must never
 * depend on a model — they run first, before anything reaches an LLM.
 */

const SEEDED_CUSTOMER_NAMES = [
  "Northwind Traders",
  "Cortex Labs",
  "Meridian Financial",
  "Solstice Retail",
  "Ashgrove Manufacturing",
  "Talus Health",
];

interface DetectorSpec {
  category: string;
  regex: RegExp;
  replacement: string | ((match: string) => string);
}

const DETECTORS: DetectorSpec[] = [
  { category: "email_address", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[email redacted]" },
  { category: "phone_number", regex: /\+?\d[\d\-. ()]{8,}\d/g, replacement: "[phone redacted]" },
  { category: "handle", regex: /@[a-zA-Z][a-zA-Z0-9._-]{2,}/g, replacement: "[handle redacted]" },
  { category: "account_id", regex: /\b(ACC|CUST)-\d+\b/g, replacement: "[account ID redacted]" },
  { category: "ticket_key", regex: /\b[A-Z]{2,10}(?:-[A-Z0-9]{1,6}){1,3}\b/g, replacement: "[ticket ID redacted]" },
  { category: "internal_url", regex: /https?:\/\/(?:internal|jira|confluence|wiki|admin)[.\-][a-zA-Z0-9./_-]+/g, replacement: "[internal link redacted]" },
  { category: "currency_amount", regex: /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s?(?:k|K|M|million|thousand))?/g, replacement: "[amount redacted]" },
];

export function runDeterministicRedactors(
  text: string,
  field: string
): { text: string; hits: RedactionEntry[] } {
  let result = text;
  const hits: RedactionEntry[] = [];

  for (const spec of DETECTORS) {
    result = result.replace(spec.regex, (match) => {
      const replacement =
        typeof spec.replacement === "function" ? spec.replacement(match) : spec.replacement;
      hits.push({
        field,
        category: spec.category,
        originalSnippet: match,
        replacement,
        method: "deterministic",
      });
      return replacement;
    });
  }

  for (const name of SEEDED_CUSTOMER_NAMES) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    if (re.test(result)) {
      result = result.replace(re, () => {
        hits.push({
          field,
          category: "customer_name",
          originalSnippet: name,
          replacement: "[customer redacted]",
          method: "deterministic",
        });
        return "[customer redacted]";
      });
    }
  }

  return { text: result, hits };
}
