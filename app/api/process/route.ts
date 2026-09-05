import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { SourceArtifactSchema } from "@/lib/schemas";
import { runPipeline } from "@/lib/pipeline/run";
import { FIXTURE_TICKETS } from "@/fixtures/tickets";

export async function POST(req: NextRequest) {
  const body = await req.json();

  let source;
  if (body.fixtureId) {
    source = FIXTURE_TICKETS.find((t) => t.id === body.fixtureId);
    if (!source) return NextResponse.json({ error: "Unknown fixture" }, { status: 400 });
  } else if (body.ticket) {
    const parsed = SourceArtifactSchema.omit({ rawHash: true, ingestedAt: true }).safeParse(body.ticket);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ticket JSON", issues: parsed.error.issues }, { status: 400 });
    }
    source = { ...parsed.data, rawHash: "pasted", ingestedAt: new Date().toISOString() };
  } else {
    return NextResponse.json({ error: "Provide fixtureId or ticket" }, { status: 400 });
  }

  const result = await runPipeline(source);

  const process = await prisma.process.create({
    data: {
      ticketKey: source.key,
      status: result.status === "sufficiency_failed" ? "sufficiency_failed" : "checked",
      sourceArtifact: source,
      triageResult: result.triageResult,
      sanitizedFacts: result.sanitizedFacts ?? undefined,
      variants: result.variants ?? undefined,
      findings: result.findings ?? undefined,
    },
  });

  return NextResponse.json(process);
}

export async function GET() {
  const processes = await prisma.process.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(processes);
}
