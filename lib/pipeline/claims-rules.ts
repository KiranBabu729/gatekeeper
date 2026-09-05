/**
 * One detector per claims-rule class. In the real system each of these is
 * an LLM classifier call (batched, one per rule class per spec); here they
 * are deterministic pattern matchers so the eval harness and demo run with
 * zero API cost. Swap the body of a detector for an LLM call without
 * touching callers — the interface (text) => matches stays the same.
 */

export interface ClaimMatch {
  span: [number, number];
  text: string;
}

type Detector = (text: string) => ClaimMatch[];

function findAll(text: string, regex: RegExp): ClaimMatch[] {
  const matches: ClaimMatch[] = [];
  for (const m of text.matchAll(regex)) {
    if (m.index === undefined) continue;
    matches.push({ span: [m.index, m.index + m[0].length], text: m[0] });
  }
  return matches;
}

export const CLAIM_DETECTORS: Record<string, Detector> = {
  "FWD-01": (text) =>
    findAll(
      text,
      /\b(by|before|starting|beginning)\s+(Q[1-4]\s?\d{0,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s?\d{0,4}|next (?:month|quarter|year))\b[^.]*/gi
    ),
  "FWD-02": (text) =>
    findAll(text, /\b(upcoming|coming soon|launching soon|not yet released|unreleased|planned feature)\b[^.]*/gi),
  "GUAR-01": (text) =>
    findAll(text, /\b(ensures?|eliminates?|always works|never fails?|100% (?:reliable|uptime)|completely eliminates)\b[^.]*/gi),
  "GUAR-02": (text) => findAll(text, /\b(fully secure|unhackable|impenetrable|completely safe)\b[^.]*/gi),
  "SLA-01": (text) => findAll(text, /\b(guarantee[sd]?\s+\d{2,3}(?:\.\d+)?%\s*(?:uptime|availability)|new sla|updated sla)\b[^.]*/gi),
  "REM-01": (text) => findAll(text, /\b(service credit|refund|will (?:automatically )?(?:credit|reimburse|compensate))\b[^.]*/gi),
  "SUP-01": (text) => findAll(text, /\b(best[- ](?:in[- ]class|of its kind)|#1|number one|the best\b|world[- ]class|revolutionary)\b[^.]*/gi),
  "COMP-01": (text) => findAll(text, /\b(CompetitorX|CompetitorY|(?:unlike|better than|beats)\s+[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b[^.]*/gi),
  "ADM-01": (text) => findAll(text, /\b(our fault|we (?:made a mistake|failed|messed up)|human error caused)\b[^.]*/gi),
  "CAUSE-01": (text) => findAll(text, /\b(caused by|root cause (?:was|is)|due to a (?:bug|misconfigured|faulty))\b[^.]*/gi),
  "PII-01": (text) =>
    findAll(text, /\b[A-Z][a-z]+\s[A-Z][a-z]+\b(?=.{0,40}@)|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\b(ACC|CUST)-\d+\b/g),
  "DISC-01": (text) => (/security policy|disclosure process/i.test(text) ? [] : [{ span: [0, Math.min(text.length, 1)], text: "(missing disclaimer)" }]),
};
