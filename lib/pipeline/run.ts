import type { SourceArtifact, Variant, VariantAudience, Finding } from "@/lib/schemas";
import { triage, SUFFICIENCY_GATE } from "@/lib/pipeline/triage";
import { sanitize } from "@/lib/pipeline/sanitize";
import { draftAll } from "@/lib/pipeline/draft";
import { checkAllVariants } from "@/lib/pipeline/policy-check";
import { loadCurrentPolicy } from "@/lib/policy/load";
import { GATEKEEPER_MODEL } from "@/lib/llm";

export interface PipelineResult {
  status: "sufficiency_failed" | "checked";
  triageResult: Awaited<ReturnType<typeof triage>>;
  sanitizedFacts?: Awaited<ReturnType<typeof sanitize>>;
  variants?: Record<VariantAudience, Variant>;
  findings?: Record<VariantAudience, Finding[]>;
  policyVersion?: string;
  model: string;
}

/**
 * The orchestrator is the one place allowed to see both the raw
 * SourceArtifact and drive the sanitize → draft → check sequence. It never
 * hands the raw artifact to draft() or checkPolicy() — only sanitize() gets
 * it, and only SanitizedFacts / Variant flow onward from there.
 */
export async function runPipeline(source: SourceArtifact): Promise<PipelineResult> {
  const triageResult = await triage(source);

  if (triageResult.sufficiencyScore < SUFFICIENCY_GATE) {
    return { status: "sufficiency_failed", triageResult, model: GATEKEEPER_MODEL };
  }

  const sanitizedFacts = await sanitize(source);
  const variants = await draftAll(sanitizedFacts, triageResult.messageType);
  const { policy } = loadCurrentPolicy();
  const findings = checkAllVariants(variants, triageResult.messageType, policy);

  return {
    status: "checked",
    triageResult,
    sanitizedFacts,
    variants,
    findings,
    policyVersion: policy.policy_version,
    model: GATEKEEPER_MODEL,
  };
}
