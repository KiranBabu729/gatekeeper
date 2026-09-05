import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import type { Variant, VariantAudience, Finding, SanitizedFacts } from "@/lib/schemas";
import { draft } from "@/lib/pipeline/draft";
import { checkPolicy } from "@/lib/pipeline/policy-check";
import { loadCurrentPolicy } from "@/lib/policy/load";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const process = await prisma.process.findUnique({ where: { id } });
  if (!process) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const variants = process.variants as Record<VariantAudience, Variant>;
  const findings = (process.findings as Record<VariantAudience, Finding[]>) ?? {};
  const facts = process.sanitizedFacts as SanitizedFacts;
  const triageResult = process.triageResult as { messageType: Parameters<typeof draft>[2] };

  const { policy } = loadCurrentPolicy();

  for (const audience of Object.keys(variants) as VariantAudience[]) {
    const variant = variants[audience];
    if (variant.isStale && variant.edits.length === 0) {
      const regenerated = await draft(facts, audience, triageResult.messageType);
      variants[audience] = regenerated;
      findings[audience] = checkPolicy(regenerated, triageResult.messageType, policy);
    } else if (variant.edits.length > 0) {
      variants[audience] = { ...variant, isStale: false };
    }
  }

  const updatedProcess = await prisma.process.update({
    where: { id },
    data: { variants, findings },
  });

  return NextResponse.json(updatedProcess);
}
