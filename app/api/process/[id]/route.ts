import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const process = await prisma.process.findUnique({ where: { id } });
  if (!process) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(process);
}
