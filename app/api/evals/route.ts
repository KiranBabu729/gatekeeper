import { NextResponse } from "next/server";
import { runEvals } from "@/evals/runner";

export async function GET() {
  return NextResponse.json(runEvals());
}
