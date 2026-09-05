import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parsePolicyYaml } from "@/lib/policy/load";
import { checkPolicy } from "@/lib/pipeline/policy-check";
import type { Variant, VariantAudience, Finding, AuditRecord } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const { yaml } = (await req.json()) as { yaml: string };

  let candidatePolicy;
  try {
    candidatePolicy = parsePolicyYaml(yaml);
  } catch (e) {
    return NextResponse.json({ error: `Could not parse policy YAML: ${(e as Error).message}` }, { status: 400 });
  }

  const approvedProcesses = await prisma.process.findMany({
    where: { status: { in: ["approved", "exported"] } },
  });

  const impact = approvedProcesses.map((process) => {
    const variants = process.variants as Record<VariantAudience, Variant>;
    const triageResult = process.triageResult as { messageType: string };
    const auditRecord = process.auditRecord as AuditRecord | null;
    const priorFindings = auditRecord?.findingsAtApproval ?? {};

    const newFindingsByAudience: Record<string, Finding[]> = {};
    let newlyFailingBlocks = 0;

    for (const audience of Object.keys(variants) as VariantAudience[]) {
      const variant = variants[audience];
      const candidateFindings = checkPolicy(variant, triageResult.messageType, candidatePolicy);
      const priorRuleIds = new Set((priorFindings[audience] ?? []).map((f) => f.ruleId));
      const newFindings = candidateFindings.filter((f) => !priorRuleIds.has(f.ruleId));
      if (newFindings.length > 0) newFindingsByAudience[audience] = newFindings;
      newlyFailingBlocks += newFindings.filter((f) => f.severity === "block").length;
    }

    return {
      processId: process.id,
      ticketKey: process.ticketKey,
      newFindingsByAudience,
      wouldNowFail: newlyFailingBlocks > 0,
    };
  });

  return NextResponse.json({
    policyVersion: candidatePolicy.policy_version,
    totalApprovedMessages: approvedProcesses.length,
    messagesThatWouldNowFail: impact.filter((i) => i.wouldNowFail).length,
    impact,
  });
}
