import type { SourceArtifact } from "@/lib/schemas";
import { stableHash } from "@/lib/hash";

/** The Jira issue fields Gatekeeper asks for. */
export const ISSUE_FIELDS = ["summary", "description", "issuetype", "status", "labels", "components", "fixVersions", "comment", "updated"];
/** The fields shown in search results. */
export const RESULT_FIELDS = ["summary", "issuetype", "status", "updated"];

interface AdfNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary?: string;
    description?: AdfNode | string | null;
    issuetype?: { name?: string } | null;
    status?: { name?: string; statusCategory?: { key?: string } } | null;
    labels?: string[];
    components?: { name?: string }[];
    fixVersions?: { name?: string }[];
    comment?: { comments?: { author?: { displayName?: string } | null; body?: AdfNode | string | null; created?: string }[] } | null;
    updated?: string;
  };
}

export interface JiraSearchResult {
  key: string;
  summary: string;
  type: string;
  status: string;
  done: boolean;
  updated: string | null;
}

const BLOCKS = new Set(["paragraph", "heading", "blockquote", "codeBlock", "listItem", "rule", "panel", "tableRow", "mediaSingle"]);

/** Flattens Atlassian Document Format to plain text, one line per block. */
export function adfToText(node: AdfNode | string | null | undefined): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  const lines: string[] = [];
  let line = "";
  // A list marker waits here until the list item's first text arrives.
  let marker = "";
  const append = (text: string) => {
    if (!line && marker) {
      line = marker;
      marker = "";
    }
    line += text;
  };
  const flush = () => {
    if (line.trim()) lines.push(line.trim());
    line = "";
  };
  const walk = (n: AdfNode, listPrefix = "") => {
    switch (n.type) {
      case "text":
        append(n.text ?? "");
        return;
      case "hardBreak":
        flush();
        return;
      case "mention":
      case "emoji":
      case "status":
      case "date":
        append(String(n.attrs?.text ?? n.attrs?.shortName ?? ""));
        return;
      case "inlineCard":
        append(String(n.attrs?.url ?? ""));
        return;
      case "bulletList":
      case "orderedList":
        flush();
        (n.content ?? []).forEach((item, i) => walk(item, n.type === "orderedList" ? `${i + 1}. ` : "- "));
        return;
    }
    const block = n.type ? BLOCKS.has(n.type) : false;
    if (block) flush();
    if (listPrefix) marker = listPrefix;
    for (const child of n.content ?? []) walk(child);
    if (block) flush();
  };
  walk(node);
  flush();
  return lines.join("\n");
}

/**
 * Maps Jira's issue type (and a few labels) onto Gatekeeper's issue types.
 * Labels win because Jira types rarely say "security advisory" or "deprecation".
 */
export function mapIssueType(jiraType: string | undefined, labels: string[]): SourceArtifact["issueType"] {
  const tags = new Set(labels.map((l) => l.toLowerCase().replace(/[\s_]+/g, "-")));
  if (tags.has("security") || tags.has("security-advisory") || tags.has("vulnerability")) return "security_advisory";
  if (tags.has("breaking-change") || tags.has("breaking")) return "breaking_change";
  if (tags.has("deprecation") || tags.has("deprecated")) return "deprecation";
  if (tags.has("incident") || tags.has("outage")) return "incident";

  const type = (jiraType ?? "").toLowerCase();
  if (type === "bug" || type === "defect") return "bugfix";
  if (type === "incident" || type === "problem") return "incident";
  if (["story", "feature", "new feature", "improvement", "epic"].includes(type)) return "feature";
  return "maintenance";
}

export function toSourceArtifact(issue: JiraIssue, ingestedAt = new Date().toISOString()): SourceArtifact {
  const f = issue.fields ?? {};
  const labels = (f.labels ?? []).filter((l): l is string => typeof l === "string");
  const ticket: Omit<SourceArtifact, "rawHash" | "ingestedAt"> = {
    id: `jira-${issue.id}`,
    sourceType: "jira",
    issueType: mapIssueType(f.issuetype?.name, labels),
    key: issue.key,
    summary: f.summary ?? "",
    description: adfToText(f.description),
    comments: (f.comment?.comments ?? []).map((c) => ({
      author: c.author?.displayName ?? "Unknown",
      body: adfToText(c.body),
      createdAt: c.created ?? "",
    })),
    labels,
    components: (f.components ?? []).flatMap((c) => (c.name ? [c.name] : [])),
    fixVersion: f.fixVersions?.[0]?.name ?? null,
  };
  return { ...ticket, rawHash: stableHash(ticket), ingestedAt };
}

export function toSearchResult(issue: JiraIssue): JiraSearchResult {
  const f = issue.fields ?? {};
  return {
    key: issue.key,
    summary: f.summary ?? "(no summary)",
    type: f.issuetype?.name ?? "",
    status: f.status?.name ?? "",
    done: f.status?.statusCategory?.key === "done",
    updated: f.updated ?? null,
  };
}
