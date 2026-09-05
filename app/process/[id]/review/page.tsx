import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { ReviewPanel } from "@/components/ReviewPanel";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const process = await prisma.process.findUnique({ where: { id } });
  if (!process || !process.variants) notFound();

  return (
    <ReviewPanel
      process={{
        id: process.id,
        status: process.status,
        triageResult: process.triageResult as never,
        variants: process.variants as never,
        findings: process.findings as never,
        auditRecord: process.auditRecord as never,
      }}
    />
  );
}
