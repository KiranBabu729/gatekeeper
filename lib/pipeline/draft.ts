import type { SanitizedFacts, Variant, VariantAudience } from "@/lib/schemas";
import type { TriageResult } from "@/lib/schemas";
import { callStructuredLLM } from "@/lib/llm";
import { z } from "zod";

/**
 * DRAFT receives SanitizedFacts only — never the raw ticket type. This file
 * must not import that raw-ticket type; see eslint.config.mjs, which turns
 * any reference to it in this file into a lint error, and
 * lib/pipeline/__tests__/boundary.test.ts, which asserts it at build time.
 */

const DraftBodySchema = z.object({ body: z.string() });

/**
 * A real drafting LLM, even given only clean SanitizedFacts, sometimes reaches
 * for confident copywriter language ("this ensures...", "by next quarter") that
 * the policy layer needs to catch — that's the reason stage 5 exists at all.
 * These per-(audience, messageType) flourishes stand in for that behavior so
 * the demo shows real findings instead of a policy checker that never fires.
 */
function flourish(audience: VariantAudience, messageType: TriageResult["messageType"]): string {
  if (audience === "customer_email") {
    if (messageType === "incident") return " We've made changes to ensure this won't happen again.";
    if (messageType === "security_advisory") return " This patch ensures your account stays protected.";
    if (messageType === "feature") return " We're also exploring related improvements, expected by Q4 2026.";
  }
  if (audience === "marketing") {
    if (messageType === "feature") return " This is one of the best updates we've shipped this year.";
    if (messageType === "security_advisory") return " Our security is unbreakable.";
  }
  if (audience === "internal_brief" && messageType === "feature") {
    return " We're also exploring related improvements, expected by Q4 2026.";
  }
  return "";
}

function templateBody(audience: VariantAudience, facts: SanitizedFacts, messageType: TriageResult["messageType"]): string {
  const limitationsLine = facts.knownLimitations.length
    ? `Known limitations: ${facts.knownLimitations.join("; ")}.`
    : "";

  switch (audience) {
    case "internal_brief":
      return [
        `Summary (${messageType}): ${facts.whatChanged}`,
        ``,
        `Customer impact: ${facts.customerImpact}`,
        ``,
        `Known issues: ${limitationsLine || "None known at this time."}`,
        ``,
        `Support talking points: Explain that ${facts.whatChanged.toLowerCase()} ${facts.actionRequired.toLowerCase()}${flourish(audience, messageType)}`,
        ``,
        `Escalation path: Route unresolved customer questions to the product operations on-call channel.`,
      ].join("\n");
    case "customer_email":
      return [
        `What changed: ${facts.whatChanged}`,
        ``,
        `Customer impact: ${facts.customerImpact}`,
        ``,
        `Action required: ${facts.actionRequired}${flourish(audience, messageType)}`,
        ``,
        `Questions? Reach out to your account team.`,
      ].join("\n");
    case "marketing":
      return [
        `Headline: ${facts.whatChanged}`,
        ``,
        `Benefit: ${facts.customerImpact} ${facts.actionRequired}${flourish(audience, messageType)}`,
      ].join("\n");
    case "in_app":
      return `${facts.whatChanged} ${facts.actionRequired}`.trim();
  }
}

export async function draft(
  facts: SanitizedFacts,
  audience: VariantAudience,
  messageType: TriageResult["messageType"]
): Promise<Variant> {
  const result = await callStructuredLLM({
    system: `You write a ${audience} message strictly from the supplied facts. Never invent details, ticket IDs, or names.`,
    prompt: JSON.stringify({ facts, audience, messageType }),
    schema: DraftBodySchema,
    stubResponse: () => ({ body: templateBody(audience, facts, messageType) }),
  });

  return {
    audience,
    body: result.body,
    derivedFromFactsHash: facts.factsHash,
    isStale: false,
    edits: [],
  };
}

export async function draftAll(
  facts: SanitizedFacts,
  messageType: TriageResult["messageType"]
): Promise<Record<VariantAudience, Variant>> {
  const audiences: VariantAudience[] = ["internal_brief", "customer_email", "marketing", "in_app"];
  const variants = await Promise.all(audiences.map((a) => draft(facts, a, messageType)));
  return Object.fromEntries(variants.map((v) => [v.audience, v])) as Record<VariantAudience, Variant>;
}
