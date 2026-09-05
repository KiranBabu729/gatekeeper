import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { ProcessStepper } from "@/components/ProcessStepper";

export const dynamic = "force-dynamic";

export default async function ProcessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const process = await prisma.process.findUnique({ where: { id } });
  if (!process) notFound();

  return (
    <ProcessStepper
      process={{
        id: process.id,
        status: process.status,
        sourceArtifact: process.sourceArtifact as never,
        triageResult: process.triageResult as never,
        sanitizedFacts: process.sanitizedFacts as never,
        variants: process.variants as never,
        findings: process.findings as never,
      }}
    />
  );
}
