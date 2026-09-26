import { NextRequest, NextResponse } from "next/server";
import { parseJiraQuery } from "@/lib/sources/jira/query";
import { jiraSource, jiraErrorResponse } from "@/lib/sources/jira/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/jira/search?q=… — a key or link comes back as { kind: "key" } so
 * the page can import it straight away; anything else runs a Jira search.
 */
export async function GET(req: NextRequest) {
  const parsed = parseJiraQuery(req.nextUrl.searchParams.get("q") ?? "");
  if (parsed.kind === "error") return NextResponse.json({ error: parsed.message }, { status: 400 });
  if (parsed.kind === "key") return NextResponse.json({ kind: "key", key: parsed.key });
  try {
    const results = await jiraSource().search(parsed);
    return NextResponse.json({ kind: "search", description: parsed.description, results });
  } catch (err) {
    const { status, error } = jiraErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
