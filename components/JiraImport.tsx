"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JiraStatus } from "@/lib/sources/jira/service";
import type { JiraSearchResult } from "@/lib/sources/jira/map";
import { FILTER_HELP } from "@/lib/sources/jira/query";

/** Messages for the codes Keyhouse adds to the return URL. Never shows text from the URL itself. */
const RETURN_ERRORS: Record<string, string> = {
  access_denied: "Jira access wasn't granted, so nothing was connected.",
  provider_not_configured: "Jira isn't set up in Keyhouse yet. Add the Jira OAuth app on Keyhouse's Providers page.",
  session_expired: "The connect link expired. Try again.",
};

const shortDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso)) : "";

export function JiraImport({ status, returned }: { status: JiraStatus; returned: { status?: string; error?: string } }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ description: string; items: JiraSearchResult[] } | null>(null);

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      const res = await fetch("/api/jira/connect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Couldn't start connecting Jira.");
    } catch {
      setError("Couldn't reach Gatekeeper's server. Try again.");
    }
    setBusy(null);
  }

  async function runIssue(key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jiraKey: key }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/process/${data.id}`);
        return;
      }
      setError(data.error ?? `Couldn't import ${key}.`);
    } catch {
      setError("Couldn't reach Gatekeeper's server. Try again.");
    }
    setBusy(null);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("search");
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`/api/jira/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
      } else if (data.kind === "key") {
        await runIssue(data.key);
        return;
      } else {
        setResults({ description: data.description, items: data.results });
      }
    } catch {
      setError("Couldn't reach Gatekeeper's server. Try again.");
    }
    setBusy(null);
  }

  const banner =
    returned.status === "connected" ? (
      <p role="status" className="rounded border border-gk-success/40 bg-gk-success/10 px-3 py-2 text-sm text-gk-success">Jira connected. Search for a ticket below.</p>
    ) : returned.status === "error" ? (
      <p role="alert" className="rounded border border-gk-danger/40 bg-gk-danger/10 px-3 py-2 text-sm text-gk-danger">
        {RETURN_ERRORS[returned.error ?? ""] ?? "Connecting Jira didn't finish. Try again."}
      </p>
    ) : null;

  return (
    <section className="space-y-3 rounded border border-gk-border bg-gk-surface p-4" aria-labelledby="jira-import-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="jira-import-heading" className="text-sm font-medium text-gk-text">Import from Jira</h2>
          <p className="mt-0.5 text-xs text-gk-text-secondary">
            Tickets come through Keyhouse, which holds the Jira access. Gatekeeper never stores a Jira token.
          </p>
        </div>
        {status.state === "connected" && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded border border-gk-success/40 bg-gk-success/10 px-2 py-0.5 text-xs font-medium text-gk-success">
            Connected{status.site ? ` · ${status.site}` : ""}
          </span>
        )}
      </div>

      {banner}

      {status.state === "not_configured" && (
        <p className="text-sm text-gk-text-secondary">
          Jira import is off. Set <code className="gk-mono text-xs">KEYHOUSE_BASE_URL</code>, <code className="gk-mono text-xs">KEYHOUSE_SECRET_KEY</code> and{" "}
          <code className="gk-mono text-xs">GATEKEEPER_BASE_URL</code> in <code className="gk-mono text-xs">.env.local</code>, then restart Gatekeeper.
        </p>
      )}

      {status.state === "unavailable" && <p role="alert" className="text-sm text-gk-danger">{status.message}</p>}

      {(status.state === "not_connected" || status.state === "needs_reconnect") && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gk-text-secondary">
            {status.state === "needs_reconnect"
              ? `The Jira connection${status.site ? ` to ${status.site}` : ""} stopped working. Reconnect to keep importing.`
              : "Connect your organization's Jira once. Everyone using Gatekeeper then imports through that connection."}
          </p>
          <button
            onClick={connect}
            disabled={busy !== null}
            className="shrink-0 rounded bg-gk-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "connect" ? "Opening Keyhouse…" : status.state === "needs_reconnect" ? "Reconnect Jira" : "Connect Jira"}
          </button>
        </div>
      )}

      {status.state === "connected" && (
        <>
          <form onSubmit={search} className="flex gap-2">
            <label htmlFor="jira-query" className="sr-only">Jira ticket key, link or search</label>
            <input
              id="jira-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='ACME-123, a Jira link, or keywords like: csv export is:done updated:14d'
              maxLength={300}
              autoComplete="off"
              className="min-w-0 flex-1 rounded border border-gk-border bg-gk-bg px-3 py-1.5 text-sm text-gk-text"
            />
            <button
              type="submit"
              disabled={!query.trim() || busy !== null}
              className="shrink-0 rounded bg-gk-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "search" ? "Searching…" : busy && busy !== "connect" ? "Importing…" : "Find"}
            </button>
          </form>

          <details className="text-xs text-gk-text-secondary">
            <summary className="cursor-pointer select-none">Search filters</summary>
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
              {FILTER_HELP.map((f) => (
                <div key={f.filter} className="contents">
                  <dt className="gk-mono text-gk-text">{f.filter}</dt>
                  <dd>{f.meaning}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2">A ticket key or link imports that ticket straight away. Anything else lists up to 10 matches, newest first.</p>
          </details>
        </>
      )}

      {error && <p role="alert" className="text-sm text-gk-danger">{error}</p>}

      {results && (
        <div>
          <p className="mb-2 text-xs text-gk-text-secondary">{results.description}</p>
          {results.items.length === 0 ? (
            <p className="text-sm text-gk-text-secondary">No tickets match. Try fewer keywords or remove a filter.</p>
          ) : (
            <ul className="divide-y divide-gk-border rounded border border-gk-border">
              {results.items.map((r) => (
                <li key={r.key}>
                  <button
                    onClick={() => runIssue(r.key)}
                    disabled={busy !== null}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gk-surface-raised disabled:opacity-60"
                  >
                    <span className="gk-mono w-24 shrink-0 text-xs text-gk-text-secondary">{r.key}</span>
                    <span className="min-w-0 flex-1 truncate text-gk-text">{r.summary}</span>
                    {r.type && <span className="shrink-0 rounded border border-gk-border px-1.5 py-0.5 text-[11px] text-gk-text-secondary">{r.type}</span>}
                    {r.status && (
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${r.done ? "border-gk-success/40 text-gk-success" : "border-gk-border text-gk-text-secondary"}`}>
                        {r.status}
                      </span>
                    )}
                    <span className="w-24 shrink-0 text-right text-xs text-gk-text-secondary">
                      {busy === r.key ? "Running…" : shortDate(r.updated)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
