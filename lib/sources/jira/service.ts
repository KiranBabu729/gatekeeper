import type { SourceArtifact } from "@/lib/schemas";
import { keyhouseClient, keyhouseConfig, KeyhouseError, type KeyhouseClient, type KeyhouseConnection } from "@/lib/sources/keyhouse";
import { ISSUE_FIELDS, RESULT_FIELDS, toSearchResult, toSourceArtifact, type JiraIssue, type JiraSearchResult } from "./map";
import type { JiraQuery } from "./query";

const MAX_RESULTS = 10;

export type JiraStatus =
  | { state: "not_configured" }
  | { state: "not_connected" }
  | { state: "needs_reconnect"; site: string | null; connectionId: string; reason: string | null }
  | { state: "connected"; site: string | null; siteUrl: string | null }
  | { state: "unavailable"; message: string };

/** A problem to show the person, with the HTTP status the API route should use. */
export class JiraSourceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** The organization's Jira connection: the newest one that isn't revoked. */
function pickConnection(conns: KeyhouseConnection[]): KeyhouseConnection | null {
  const usable = conns.filter((c) => c.owner.type === "organization" && c.status !== "revoked");
  return usable.find((c) => c.status === "active" || c.status === "refreshing") ?? usable[0] ?? null;
}

const siteName = (c: KeyhouseConnection) => (typeof c.account.siteName === "string" ? c.account.siteName : null);

export function jiraSource(client: KeyhouseClient | null = defaultClient()) {
  async function connection(): Promise<KeyhouseConnection> {
    if (!client) throw new JiraSourceError(503, "Jira import isn't set up. Add the Keyhouse settings to .env.local.");
    const conn = pickConnection(await client.listConnections("jira"));
    if (!conn) throw new JiraSourceError(409, "Connect Jira first.");
    if (conn.status === "needs_reauth" || conn.status === "error") throw new JiraSourceError(409, "The Jira connection needs reconnecting.");
    return conn;
  }

  async function jira(path: string, init: { method?: string; query?: Record<string, string>; body?: unknown } = {}) {
    const conn = await connection();
    let res;
    try {
      res = await client!.proxy(conn.id, { path, ...init });
    } catch (err) {
      if (err instanceof KeyhouseError && err.code === "needs_reauth") throw new JiraSourceError(409, "The Jira connection needs reconnecting.");
      if (err instanceof KeyhouseError && err.code === "rate_limited") throw new JiraSourceError(429, "Too many Jira requests. Wait a moment and try again.");
      throw err;
    }
    let data: Record<string, unknown> = {};
    try {
      data = res.body ? JSON.parse(res.body) : {};
    } catch {
      // Non-JSON error pages are handled by the status checks below.
    }
    return { status: res.status, data };
  }

  const jiraMessage = (data: Record<string, unknown>) => {
    const messages = [...((data.errorMessages as string[] | undefined) ?? []), ...Object.values((data.errors as Record<string, string> | undefined) ?? {})];
    return messages.filter((m) => typeof m === "string").join(" ");
  };

  return {
    async status(): Promise<JiraStatus> {
      if (!client) return { state: "not_configured" };
      try {
        const conn = pickConnection(await client.listConnections("jira"));
        if (!conn) return { state: "not_connected" };
        if (conn.status === "needs_reauth" || conn.status === "error") return { state: "needs_reconnect", site: siteName(conn), connectionId: conn.id, reason: conn.lastError };
        return { state: "connected", site: siteName(conn), siteUrl: typeof conn.account.siteUrl === "string" ? conn.account.siteUrl : null };
      } catch (err) {
        return { state: "unavailable", message: err instanceof KeyhouseError ? err.message : "Couldn't check the Jira connection." };
      }
    },

    async connectUrl(): Promise<string> {
      if (!client) throw new JiraSourceError(503, "Jira import isn't set up. Add the Keyhouse settings to .env.local.");
      const existing = pickConnection(await client.listConnections("jira"));
      const session = existing && existing.status !== "active" ? await client.reconnectSession("jira", existing.id) : await client.createOrgSession("jira");
      return session.url;
    },

    async search(query: Extract<JiraQuery, { kind: "search" }>): Promise<JiraSearchResult[]> {
      const { status, data } = await jira("/rest/api/3/search/jql", { method: "POST", body: { jql: query.jql, maxResults: MAX_RESULTS, fields: RESULT_FIELDS } });
      if (status === 400) throw new JiraSourceError(400, jiraMessage(data) || "Jira couldn't run that search. Check the filter values.");
      if (status === 401 || status === 403) throw new JiraSourceError(409, "Jira refused the request. Reconnect Jira and try again.");
      if (status >= 300) throw new JiraSourceError(502, `Jira returned an error (HTTP ${status}).`);
      return ((data.issues as JiraIssue[] | undefined) ?? []).map(toSearchResult);
    },

    async issue(key: string): Promise<SourceArtifact> {
      if (!/^[A-Z][A-Z0-9_]{0,9}-\d{1,9}$/.test(key)) throw new JiraSourceError(400, "That isn't a Jira issue key.");
      const { status, data } = await jira(`/rest/api/3/issue/${key}`, { query: { fields: ISSUE_FIELDS.join(",") } });
      if (status === 404) throw new JiraSourceError(404, `${key} doesn't exist, or the Jira connection can't see it.`);
      if (status === 401 || status === 403) throw new JiraSourceError(409, "Jira refused the request. Reconnect Jira and try again.");
      if (status >= 300) throw new JiraSourceError(502, `Jira returned an error (HTTP ${status}).`);
      return toSourceArtifact(data as unknown as JiraIssue);
    },
  };
}

function defaultClient(): KeyhouseClient | null {
  const cfg = keyhouseConfig();
  return cfg ? keyhouseClient(cfg) : null;
}

/** Converts any error from the Jira source into a message and status for an API response. */
export function jiraErrorResponse(err: unknown): { status: number; error: string } {
  if (err instanceof JiraSourceError) return { status: err.status, error: err.message };
  if (err instanceof KeyhouseError) {
    if (err.code === "unauthorized" || err.status === 401) return { status: 502, error: "Keyhouse rejected Gatekeeper's key. Check KEYHOUSE_SECRET_KEY." };
    if (err.code === "access_mode") return { status: 502, error: "Gatekeeper's Keyhouse application must use proxy mode." };
    return { status: err.status >= 500 ? 502 : err.status, error: err.message };
  }
  console.error("Jira source error", err);
  return { status: 500, error: "Something went wrong talking to Jira." };
}
