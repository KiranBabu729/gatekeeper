import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const processes = await prisma.process.findMany({
    where: { status: { in: ["approved", "exported"] } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(processes);
}
