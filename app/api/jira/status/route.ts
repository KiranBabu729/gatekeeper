import { NextResponse } from "next/server";
import { jiraSource } from "@/lib/sources/jira/service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await jiraSource().status());
}
