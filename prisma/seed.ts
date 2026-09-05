import "dotenv/config";
import { prisma } from "@/lib/db/client";
import { FIXTURE_TICKETS } from "@/fixtures/tickets";
import { runPipeline } from "@/lib/pipeline/run";

async function main() {
  await prisma.process.deleteMany();

  for (const ticket of FIXTURE_TICKETS) {
    const result = await runPipeline(ticket);
    await prisma.process.create({
      data: {
        ticketKey: ticket.key,
        status: result.status === "sufficiency_failed" ? "sufficiency_failed" : "checked",
        sourceArtifact: ticket,
        triageResult: result.triageResult,
        sanitizedFacts: result.sanitizedFacts ?? undefined,
        variants: result.variants ?? undefined,
        findings: result.findings ?? undefined,
      },
    });
    console.log(`Seeded ${ticket.key} → ${result.status}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
