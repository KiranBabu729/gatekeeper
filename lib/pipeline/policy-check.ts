import type { Variant, Finding, VariantAudience } from "@/lib/schemas";
import type { Policy } from "@/lib/policy/schema";
import { ruleSeverityForAudience } from "@/lib/policy/schema";
import { CLAIM_DETECTORS } from "@/lib/pipeline/claims-rules";
import { checkChannelContractWithSpec, CHANNEL_CONTRACTS } from "@/lib/pipeline/channel-contracts";

/**
 * checkPolicy receives a rendered Variant (audience + body text) and the
 * message type — never the raw ticket. This file must not import the raw
 * ticket type; enforced by the eslint override in eslint.config.mjs and by
 * lib/pipeline/__tests__/boundary.test.ts.
 */

function ruleApplies(types: string[], messageType: string): boolean {
  return types.includes("all") || types.includes(messageType);
}

export function checkPolicy(variant: Variant, messageType: string, policy: Policy): Finding[] {
  const findings: Finding[] = [];
  const body = variant.body;
  const audience: VariantAudience = variant.audience;

  for (const banned of policy.lexicon.banned) {
    const re = new RegExp(`\\b${banned.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    for (const m of body.matchAll(re)) {
      if (m.index === undefined) continue;
      findings.push({
        ruleId: `LEXICON:${banned.term}`,
        severity: banned.severity,
        span: [m.index, m.index + m[0].length],
        text: m[0],
        rationale: banned.rationale,
        suggestedFix: banned.replacement,
        autoFixAvailable: true,
      });
    }
  }

  for (const rule of policy.rules) {
    const severity = ruleSeverityForAudience(rule, audience);
    if (!severity) continue;
    if (!ruleApplies(rule.scope.types, messageType)) continue;

    const detector = CLAIM_DETECTORS[rule.id];
    if (!detector) continue;
    const matches = detector(body);
    for (const match of matches) {
      findings.push({
        ruleId: rule.id,
        severity,
        span: match.span,
        text: match.text,
        rationale: rule.description,
        suggestedFix: rule.remediation,
        autoFixAvailable: false,
      });
    }
  }

  const policyChannel = policy.channels[audience];
  const contractSpec = policyChannel
    ? {
        maxWords: policyChannel.max_words,
        maxSentences: policyChannel.max_sentences,
        requiredSections: policyChannel.required_sections,
        forbidden: policyChannel.forbidden,
      }
    : CHANNEL_CONTRACTS[audience];
  const contract = checkChannelContractWithSpec(contractSpec, body);
  for (const violation of contract.violations) {
    findings.push({
      ruleId: "CHANNEL_CONTRACT",
      severity: "block",
      span: [0, 0],
      text: "",
      rationale: violation,
      suggestedFix: "Edit the message to satisfy the channel contract.",
      autoFixAvailable: false,
    });
  }

  return findings.sort((a, b) => a.span[0] - b.span[0]);
}

export function checkAllVariants(
  variants: Record<VariantAudience, Variant>,
  messageType: string,
  policy: Policy
): Record<VariantAudience, Finding[]> {
  const result = {} as Record<VariantAudience, Finding[]>;
  for (const audience of Object.keys(variants) as VariantAudience[]) {
    result[audience] = checkPolicy(variants[audience], messageType, policy);
  }
  return result;
}
