import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import type { Variant, VariantAudience, Finding, AuditRecord } from "@/lib/schemas";
import { loadCurrentPolicy } from "@/lib/policy/load";
import { GATEKEEPER_MODEL } from "@/lib/llm";

interface ApproveBody {
  by: string;
  role: "author" | "legal_reviewer";
  overrides: { ruleId: string; audience: VariantAudience; justification: string }[];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { by, role, overrides } = (await req.json()) as ApproveBody;

  const process = await prisma.process.findUnique({ where: { id } });
  if (!process) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const triageResult = process.triageResult as { riskTier: "standard" | "requires_legal"; messageType: string };
  if (triageResult.riskTier === "requires_legal" && role !== "legal_reviewer") {
    return NextResponse.json(
      { error: "This message requires approval from the Legal Reviewer role." },
      { status: 403 }
    );
  }

  const variants = process.variants as Record<VariantAudience, Variant>;
  const findings = (process.findings as Record<VariantAudience, Finding[]>) ?? {};

  const overriddenKeys = new Set(overrides.map((o) => `${o.audience}:${o.ruleId}`));
  const unresolvedBlocks: string[] = [];
  for (const audience of Object.keys(findings) as VariantAudience[]) {
    for (const finding of findings[audience]) {
      if (finding.severity === "block" && !overriddenKeys.has(`${audience}:${finding.ruleId}`)) {
        unresolvedBlocks.push(`${audience}: ${finding.ruleId}`);
      }
    }
  }
  if (unresolvedBlocks.length > 0) {
    return NextResponse.json(
      { error: "Cannot approve with unresolved blocking findings.", unresolvedBlocks },
      { status: 400 }
    );
  }

  const { policy } = loadCurrentPolicy();
  const source = process.sourceArtifact as { id: string };
  const sanitizedFacts = process.sanitizedFacts as { factsHash: string };

  const existingAudit = process.auditRecord as AuditRecord | null;
  const auditRecord: AuditRecord = {
    messageId: process.id,
    sourceIds: [source.id],
    policyVersion: policy.policy_version,
    model: GATEKEEPER_MODEL,
    factsHash: sanitizedFacts.factsHash,
    generatedAt: process.createdAt.toISOString(),
    edits: (existingAudit?.edits ?? []).concat(
      Object.values(variants).flatMap((v) => v.edits)
    ),
    findingsAtApproval: findings,
    overrides: [
      ...(existingAudit?.overrides ?? []),
      ...overrides.map((o) => ({ ...o, by, at: new Date().toISOString() })),
    ],
    approvals: [...(existingAudit?.approvals ?? []), { by, role, at: new Date().toISOString() }],
    exportedAt: existingAudit?.exportedAt ?? null,
  };

  const updatedProcess = await prisma.process.update({
    where: { id },
    data: { status: "approved", auditRecord },
  });

  return NextResponse.json(updatedProcess);
}
