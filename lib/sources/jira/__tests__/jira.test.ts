import { describe, it, expect } from "vitest";
import { parseJiraQuery, extractIssueKey } from "../query";
import { adfToText, mapIssueType, toSourceArtifact, type JiraIssue } from "../map";
import { jiraSource, JiraSourceError } from "../service";
import { SourceArtifactSchema } from "@/lib/schemas";
import type { KeyhouseClient, KeyhouseConnection } from "@/lib/sources/keyhouse";

describe("Jira query box", () => {
  it("recognizes keys and links", () => {
    expect(extractIssueKey("acme-12")).toBe("ACME-12");
    expect(extractIssueKey("https://acme.atlassian.net/browse/ACME-12")).toBe("ACME-12");
    expect(extractIssueKey("https://acme.atlassian.net/jira/software/projects/ACME/boards/1?selectedIssue=ACME-7")).toBe("ACME-7");
    expect(extractIssueKey("javascript:alert(1)")).toBeNull();
    expect(extractIssueKey("csv export")).toBeNull();
  });

  it("builds JQL from keywords and filters", () => {
    const q = parseJiraQuery('csv export project:acme status:"In Progress" is:open updated:7d');
    expect(q).toEqual({
      kind: "search",
      jql: 'text ~ "csv export" AND project = "ACME" AND status = "In Progress" AND statusCategory != Done AND updated >= -7d ORDER BY updated DESC',
      description: 'Issues matching "csv export", in ACME, status In Progress, not done, updated in the last 7d',
    });
  });

  it("can't be used to inject JQL", () => {
    const q = parseJiraQuery('label:x" OR project = SECRET OR labels = "y');
    expect(q.kind).toBe("search");
    if (q.kind === "search") expect(q.jql.startsWith('text ~ "OR project = SECRET OR labels = y" AND labels = "x"')).toBe(true);
    const escaped = parseJiraQuery('status:"a\\" OR 1=1"');
    if (escaped.kind === "search") expect(escaped.jql).toContain('status = "a\\\\"');
  });

  it("explains bad input", () => {
    expect(parseJiraQuery("   ").kind).toBe("error");
    expect(parseJiraQuery("updated:soon").kind).toBe("error");
    expect(parseJiraQuery("is:maybe").kind).toBe("error");
    expect(parseJiraQuery("project:").kind).toBe("error");
    expect(parseJiraQuery("x".repeat(301)).kind).toBe("error");
  });
});

describe("Jira issue mapping", () => {
  const issue: JiraIssue = {
    id: "10001",
    key: "ACME-1",
    fields: {
      summary: "Add CSV export",
      description: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Export any report." }, { type: "hardBreak" }, { type: "text", text: "Ships in 4.12." }] },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Growth plan" }] }] }] },
          { type: "paragraph", content: [{ type: "text", text: "Ask " }, { type: "mention", attrs: { text: "@Priya" } }] },
        ],
      },
      issuetype: { name: "Story" },
      labels: ["customer-facing"],
      components: [{ name: "Reporting" }],
      fixVersions: [{ name: "4.12.0" }],
      comment: { comments: [{ author: { displayName: "Priya" }, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "QA done" }] }] }, created: "2026-09-19" }] },
    },
  };

  it("flattens Atlassian Document Format", () => {
    expect(adfToText(issue.fields.description as never)).toBe("Export any report.\nShips in 4.12.\n- Growth plan\nAsk @Priya");
    expect(adfToText(null)).toBe("");
  });

  it("produces a valid SourceArtifact", () => {
    const a = toSourceArtifact(issue, "2026-09-26T00:00:00.000Z");
    expect(SourceArtifactSchema.parse(a)).toMatchObject({
      id: "jira-10001",
      sourceType: "jira",
      issueType: "feature",
      key: "ACME-1",
      fixVersion: "4.12.0",
      components: ["Reporting"],
      comments: [{ author: "Priya", body: "QA done", createdAt: "2026-09-19" }],
    });
    expect(a.rawHash).toHaveLength(16);
  });

  it("maps issue types, with labels first", () => {
    expect(mapIssueType("Bug", [])).toBe("bugfix");
    expect(mapIssueType("Task", [])).toBe("maintenance");
    expect(mapIssueType("Bug", ["Security"])).toBe("security_advisory");
    expect(mapIssueType("Story", ["breaking_change"])).toBe("breaking_change");
    expect(mapIssueType(undefined, [])).toBe("maintenance");
  });
});

describe("Jira source through Keyhouse", () => {
  const conn = (over: Partial<KeyhouseConnection>): KeyhouseConnection => ({
    id: "c1",
    provider: "jira",
    owner: { type: "organization" },
    status: "active",
    account: { siteName: "acme", siteUrl: "https://acme.atlassian.net" },
    lastError: null,
    createdAt: "",
    ...over,
  });

  function fake(conns: KeyhouseConnection[], proxy: (path: string, body?: unknown) => { status: number; body: unknown }) {
    const calls: { id: string; path: string; body?: unknown }[] = [];
    const client = {
      createOrgSession: async () => ({ url: "https://keyhouse/connect/new" }),
      reconnectSession: async (_p: string, id: string) => ({ url: `https://keyhouse/connect/re-${id}` }),
      listConnections: async () => conns,
      proxy: async (id: string, req: { path: string; body?: unknown }) => {
        calls.push({ id, path: req.path, body: req.body });
        const r = proxy(req.path, req.body);
        return { status: r.status, headers: {}, body: JSON.stringify(r.body) };
      },
    } as unknown as KeyhouseClient;
    return { client, calls };
  }

  it("reports its state", async () => {
    expect(await jiraSource(null).status()).toEqual({ state: "not_configured" });
    expect(await jiraSource(fake([], () => ({ status: 200, body: {} })).client).status()).toEqual({ state: "not_connected" });
    // Connections owned by a single user don't count as the organization's.
    expect((await jiraSource(fake([conn({ owner: { type: "user", id: "u" } })], () => ({ status: 200, body: {} })).client).status()).state).toBe("not_connected");
    expect((await jiraSource(fake([conn({ status: "needs_reauth" })], () => ({ status: 200, body: {} })).client).status()).state).toBe("needs_reconnect");
    expect(await jiraSource(fake([conn({ status: "revoked", id: "old" }), conn({})], () => ({ status: 200, body: {} })).client).status()).toEqual({
      state: "connected",
      site: "acme",
      siteUrl: "https://acme.atlassian.net",
    });
  });

  it("reconnects a broken connection instead of making a second one", async () => {
    expect(await jiraSource(fake([conn({ status: "needs_reauth" })], () => ({ status: 200, body: {} })).client).connectUrl()).toBe("https://keyhouse/connect/re-c1");
    expect(await jiraSource(fake([], () => ({ status: 200, body: {} })).client).connectUrl()).toBe("https://keyhouse/connect/new");
  });

  it("searches with the new JQL endpoint and fetches issues", async () => {
    const { client, calls } = fake([conn({})], (path) =>
      path === "/rest/api/3/search/jql"
        ? { status: 200, body: { issues: [{ id: "1", key: "ACME-1", fields: { summary: "S", status: { name: "Done", statusCategory: { key: "done" } } } }] } }
        : { status: 200, body: { id: "1", key: "ACME-1", fields: { summary: "S", issuetype: { name: "Bug" } } } }
    );
    const src = jiraSource(client);
    const results = await src.search({ kind: "search", jql: 'text ~ "s"', description: "" });
    expect(results).toEqual([{ key: "ACME-1", summary: "S", type: "", status: "Done", done: true, updated: null }]);
    expect(calls[0]).toMatchObject({ id: "c1", body: { jql: 'text ~ "s"', maxResults: 10 } });
    expect((await src.issue("ACME-1")).issueType).toBe("bugfix");
  });

  it("turns Jira failures into clear errors", async () => {
    const src = jiraSource(fake([conn({})], (path) => (path.includes("search") ? { status: 400, body: { errorMessages: ["The value 'NOPE' does not exist for the field 'project'."] } } : { status: 404, body: {} })).client);
    await expect(src.search({ kind: "search", jql: "x", description: "" })).rejects.toThrow("does not exist for the field 'project'");
    await expect(src.issue("ACME-9")).rejects.toThrow("ACME-9 doesn't exist");
    await expect(src.issue("../admin")).rejects.toBeInstanceOf(JiraSourceError);
    await expect(jiraSource(fake([], () => ({ status: 200, body: {} })).client).issue("ACME-1")).rejects.toThrow("Connect Jira first");
  });
});
