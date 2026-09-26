/**
 * Turns what someone types in the Jira box into either a single issue key or
 * a JQL search. No model involved: it recognizes keys, Jira links, a few
 * filters and plain keywords.
 *
 *   ACME-123                               → that issue
 *   https://acme.atlassian.net/browse/ACME-123
 *   csv export project:ACME is:done updated:7d
 *   status:"In Progress" label:customer-facing type:bug
 */

export type JiraQuery = { kind: "key"; key: string } | { kind: "search"; jql: string; description: string };

const KEY = /^[A-Za-z][A-Za-z0-9_]{0,9}-\d{1,9}$/;

export const FILTER_HELP = [
  { filter: "project:ACME", meaning: "Only this project" },
  { filter: 'status:"In Progress"', meaning: "Exact status name" },
  { filter: "is:open / is:done", meaning: "Not done yet / done" },
  { filter: "type:bug", meaning: "Issue type" },
  { filter: "label:customer-facing", meaning: "Has this label" },
  { filter: "component:Reporting", meaning: "In this component" },
  { filter: "updated:7d", meaning: "Updated in the last 7 days (also h, w)" },
];

/** Returns the issue key if the input is a key or a link to one issue. */
export function extractIssueKey(input: string): string | null {
  const text = input.trim();
  if (KEY.test(text)) return text.toUpperCase();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const selected = url.searchParams.get("selectedIssue");
  if (selected && KEY.test(selected)) return selected.toUpperCase();
  const fromPath = /\/browse\/([^/?#]+)/.exec(url.pathname)?.[1];
  if (fromPath && KEY.test(fromPath)) return fromPath.toUpperCase();
  return null;
}

/** Quotes a value for JQL. */
export function jqlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Splits on spaces, keeping name:"quoted value" and "quoted phrases" together. */
function tokenize(input: string): string[] {
  return input.match(/[^\s"]+:"[^"]*"?|"[^"]*"?|\S+/g) ?? [];
}

const FILTERS = new Set(["project", "status", "is", "type", "label", "component", "updated"]);

const unquote = (v: string) => v.replace(/^"|"$/g, "");

export function parseJiraQuery(input: string): JiraQuery | { kind: "error"; message: string } {
  const text = input.trim();
  if (!text) return { kind: "error", message: "Type a ticket key, paste a Jira link, or enter some keywords." };
  if (text.length > 300) return { kind: "error", message: "That's too long for a search. Use a few keywords or filters." };

  const key = extractIssueKey(text);
  if (key) return { kind: "key", key };

  const clauses: string[] = [];
  const parts: string[] = [];
  const words: string[] = [];

  for (const token of tokenize(text)) {
    const m = /^([a-z]+):(.*)$/i.exec(token);
    const name = m && FILTERS.has(m[1].toLowerCase()) ? m[1].toLowerCase() : undefined;
    const value = name ? unquote(m![2]).trim() : "";
    if (name && !value) return { kind: "error", message: `Give ${name}: a value, e.g. ${FILTER_HELP.find((f) => f.filter.startsWith(name))?.filter ?? `${name}:something`}.` };

    switch (name) {
      case "project":
        clauses.push(`project = ${jqlString(value.toUpperCase())}`);
        parts.push(`in ${value.toUpperCase()}`);
        break;
      case "status":
        clauses.push(`status = ${jqlString(value)}`);
        parts.push(`status ${value}`);
        break;
      case "is":
        if (value.toLowerCase() === "open") {
          clauses.push("statusCategory != Done");
          parts.push("not done");
        } else if (value.toLowerCase() === "done") {
          clauses.push("statusCategory = Done");
          parts.push("done");
        } else return { kind: "error", message: `is: understands open or done, not "${value}".` };
        break;
      case "type":
        clauses.push(`issuetype = ${jqlString(value)}`);
        parts.push(`type ${value}`);
        break;
      case "label":
        clauses.push(`labels = ${jqlString(value)}`);
        parts.push(`label ${value}`);
        break;
      case "component":
        clauses.push(`component = ${jqlString(value)}`);
        parts.push(`component ${value}`);
        break;
      case "updated": {
        const age = /^(\d{1,4})([hdw])$/i.exec(value);
        if (!age) return { kind: "error", message: `updated: takes an age like 24h, 7d or 2w, not "${value}".` };
        clauses.push(`updated >= -${age[1]}${age[2].toLowerCase()}`);
        parts.push(`updated in the last ${age[1]}${age[2].toLowerCase()}`);
        break;
      }
      default:
        // Not a known filter (or no filter at all): search for the text.
        words.push(unquote(token));
    }
  }

  // Jira's text search treats these as operators; searching for them as words isn't useful.
  const phrase = words.join(" ").replace(/[+\-&|!(){}[\]^~*?\\:"]/g, " ").replace(/\s+/g, " ").trim();
  if (phrase) {
    clauses.unshift(`text ~ ${jqlString(phrase)}`);
    parts.unshift(`matching "${phrase}"`);
  }
  if (!clauses.length) return { kind: "error", message: "Add a keyword or a filter to search for." };

  return { kind: "search", jql: `${clauses.join(" AND ")} ORDER BY updated DESC`, description: `Issues ${parts.join(", ")}` };
}
