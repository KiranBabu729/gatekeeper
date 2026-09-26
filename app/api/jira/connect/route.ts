import { NextResponse } from "next/server";
import { jiraSource, jiraErrorResponse } from "@/lib/sources/jira/service";

/** Starts (or restarts) the organization's Jira connection through Keyhouse. */
export async function POST() {
  try {
    return NextResponse.json({ url: await jiraSource().connectUrl() });
  } catch (err) {
    const { status, error } = jiraErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
