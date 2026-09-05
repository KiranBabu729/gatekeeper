import { NextResponse } from "next/server";
import { loadCurrentPolicy, loadPreviousPolicy } from "@/lib/policy/load";

export async function GET() {
  const current = loadCurrentPolicy();
  const previous = loadPreviousPolicy();
  return NextResponse.json({
    current: current.policy,
    currentRaw: current.raw,
    previous: previous.policy,
    previousRaw: previous.raw,
  });
}
