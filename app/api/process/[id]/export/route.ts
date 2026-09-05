import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import type { AuditRecord } from "@/lib/schemas";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const process = await prisma.process.findUnique({ where: { id } });
  if (!process) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (process.status !== "approved") {
    return NextResponse.json({ error: "Message must be approved before export." }, { status: 400 });
  }

  const auditRecord = process.auditRecord as AuditRecord;
  auditRecord.exportedAt = new Date().toISOString();

  const updatedProcess = await prisma.process.update({
    where: { id },
    data: { status: "exported", auditRecord },
  });

  return NextResponse.json(updatedProcess);
}
