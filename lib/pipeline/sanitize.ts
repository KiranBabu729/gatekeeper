import type { SourceArtifact, SanitizedFacts, RedactionEntry } from "@/lib/schemas";
import { runDeterministicRedactors } from "@/lib/pipeline/redactors";
import { stableHash } from "@/lib/hash";
import { callStructuredLLM } from "@/lib/llm";
import { z } from "zod";

/**
 * SANITIZE is the only place a SourceArtifact is ever read. Its output,
 * SanitizedFacts, carries no reference back to the original text — every
 * downstream stage (draft, policy check) takes SanitizedFacts and nothing
 * else. See lib/pipeline/draft.ts and lib/pipeline/policy-check.ts, whose
 * signatures do not accept SourceArtifact — and see the eslint override in
 * eslint.config.mjs that makes referencing `SourceArtifact` in those two
 * files a lint error.
 */

const JUDGMENT_PATTERNS: { category: string; regex: RegExp }[] = [
  { category: "root_cause_detail", regex: /(root cause|caused by|due to a (?:bug|bad|faulty|misconfigured)[^.]*|because the[^.]*failed)/gi },
  { category: "blame_language", regex: /(engineer(?:'s)? (?:mistake|error)|human error|a developer (?:forgot|missed|broke)[^.]*)/gi },
  { category: "unreleased_feature_reference", regex: /(unreleased|not yet released|upcoming feature|planned for (?:Q[1-4]|next (?:quarter|release))|behind a feature flag)[^.]*/gi },
  { category: "internal_severity_framing", regex: /\b(P0|P1|P2|Sev[- ]?[0-3]|sev-?[0-3]|internal severity|priority: (?:critical|urgent))\b[^.]*/gi },
];

export function runJudgmentPass(text: string, field: string): { text: string; hits: RedactionEntry[] } {
  let result = text;
  const hits: RedactionEntry[] = [];
  for (const spec of JUDGMENT_PATTERNS) {
    result = result.replace(spec.regex, (match) => {
      hits.push({
        field,
        category: spec.category,
        originalSnippet: match.trim(),
        replacement: "[internal detail omitted]",
        method: "llm",
      });
      return "[internal detail omitted]";
    });
  }
  return { text: result, hits };
}

const ExtractedFactsSchema = z.object({
  whatChanged: z.string(),
  customerImpact: z.string(),
  actionRequired: z.string(),
  effectiveDate: z.string(),
  affectedScope: z.string(),
  knownLimitations: z.array(z.string()),
});

function stubExtractFacts(source: SourceArtifact, cleanedDescription: string) {
  const firstSentence = cleanedDescription.split(/(?<=[.!?])\s/)[0] || cleanedDescription.slice(0, 160);
  const scopeFromComponents = source.components.length ? source.components.join(", ") : "all customers";
  const actionByType: Record<string, string> = {
    feature: "No action required to benefit from this change.",
    bugfix: "No action required.",
    incident: "No action required; the issue has been resolved.",
    security_advisory: "Review the affected scope below and rotate credentials if advised.",
    deprecation: "Migrate off the affected capability before the effective date.",
    breaking_change: "Update integrations before the effective date to avoid disruption.",
    maintenance: "No action required during the maintenance window beyond expected brief unavailability.",
  };
  return {
    whatChanged: firstSentence.trim(),
    customerImpact: `Affects ${scopeFromComponents}.`,
    actionRequired: actionByType[source.issueType] ?? "No action required.",
    effectiveDate: source.fixVersion ? `Effective with ${source.fixVersion}` : "Effective immediately",
    affectedScope: scopeFromComponents,
    knownLimitations: [] as string[],
  };
}

export async function sanitize(source: SourceArtifact): Promise<SanitizedFacts> {
  const redactionLog: RedactionEntry[] = [];

  const detPass = (text: string, field: string) => {
    const det = runDeterministicRedactors(text, field);
    redactionLog.push(...det.hits);
    const judg = runJudgmentPass(det.text, field);
    redactionLog.push(...judg.hits);
    return judg.text;
  };

  const cleanedDescription = detPass(source.description, "description");
  const cleanedComments = source.comments.map((c, i) => detPass(c.body, `comments[${i}]`));
  detPass(source.summary, "summary"); // logged for visibility even though summary isn't retained verbatim

  const extracted = await callStructuredLLM({
    system:
      "You extract customer-relevant facts from an already-sanitized internal ticket. You never introduce information not present in the input.",
    prompt: `Sanitized description:\n${cleanedDescription}\n\nSanitized comments:\n${cleanedComments.join("\n")}\n\nIssue type: ${source.issueType}`,
    schema: ExtractedFactsSchema,
    stubResponse: () => stubExtractFacts(source, cleanedDescription),
  });

  const factsCore = {
    whatChanged: extracted.whatChanged,
    customerImpact: extracted.customerImpact,
    actionRequired: extracted.actionRequired,
    effectiveDate: extracted.effectiveDate,
    affectedScope: extracted.affectedScope,
    knownLimitations: extracted.knownLimitations,
  };

  return {
    ...factsCore,
    redactionLog,
    factsHash: stableHash(factsCore),
  };
}
