import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import type { Variant, VariantAudience, Finding } from "@/lib/schemas";
import { checkPolicy } from "@/lib/pipeline/policy-check";
import { loadCurrentPolicy } from "@/lib/policy/load";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { audience, body } = (await req.json()) as { audience: VariantAudience; body: string };

  const process = await prisma.process.findUnique({ where: { id } });
  if (!process) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const variants = process.variants as Record<VariantAudience, Variant>;
  const findings = (process.findings as Record<VariantAudience, Finding[]>) ?? {};
  const editedVariant = variants[audience];
  if (!editedVariant) return NextResponse.json({ error: "Unknown audience" }, { status: 400 });

  const updated: Variant = {
    ...editedVariant,
    body,
    edits: [...editedVariant.edits, { at: new Date().toISOString(), before: editedVariant.body, after: body }],
  };
  variants[audience] = updated;

  for (const otherAudience of Object.keys(variants) as VariantAudience[]) {
    if (otherAudience !== audience) {
      variants[otherAudience] = { ...variants[otherAudience], isStale: true };
    }
  }

  const { policy } = loadCurrentPolicy();
  const triageResult = process.triageResult as { messageType: string };
  findings[audience] = checkPolicy(updated, triageResult.messageType, policy);

  const updatedProcess = await prisma.process.update({
    where: { id },
    data: { variants, findings },
  });

  return NextResponse.json(updatedProcess);
}
