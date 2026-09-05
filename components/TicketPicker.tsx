"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SourceArtifact } from "@/lib/schemas";

const ISSUE_TYPE_LABEL: Record<SourceArtifact["issueType"], string> = {
  feature: "Feature",
  bugfix: "Bugfix",
  incident: "Incident",
  security_advisory: "Security advisory",
  deprecation: "Deprecation",
  breaking_change: "Breaking change",
  maintenance: "Maintenance",
};

export function TicketPicker({ tickets }: { tickets: SourceArtifact[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  async function runFixture(fixtureId: string) {
    setLoadingId(fixtureId);
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId }),
    });
    const data = await res.json();
    setLoadingId(null);
    if (res.ok) router.push(`/process/${data.id}`);
  }

  async function runPasted() {
    setPasteError(null);
    let ticket;
    try {
      ticket = JSON.parse(pasted);
    } catch {
      setPasteError("That isn't valid JSON.");
      return;
    }
    setLoadingId("pasted");
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
    });
    const data = await res.json();
    setLoadingId(null);
    if (res.ok) {
      router.push(`/process/${data.id}`);
    } else {
      setPasteError(data.error ?? "Could not process that ticket.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3">
        {tickets.map((t) => (
          <button
            key={t.id}
            onClick={() => runFixture(t.id)}
            disabled={loadingId !== null}
            className="flex flex-col gap-1.5 rounded border border-gk-border bg-gk-surface p-4 text-left hover:border-gk-accent disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="gk-mono text-xs text-gk-text-secondary">{t.key}</span>
              <span className="rounded border border-gk-border px-1.5 py-0.5 text-[11px] text-gk-text-secondary">
                {ISSUE_TYPE_LABEL[t.issueType]}
              </span>
            </div>
            <div className="text-sm text-gk-text">{t.summary}</div>
            {loadingId === t.id && <div className="text-xs text-gk-accent">Running pipeline…</div>}
          </button>
        ))}
      </div>

      <div className="rounded border border-gk-border bg-gk-surface p-4">
        <h2 className="mb-2 text-sm font-medium text-gk-text">Paste raw ticket JSON</h2>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder='{"id": "...", "sourceType": "pasted", "issueType": "feature", "key": "...", "summary": "...", "description": "...", "comments": [], "labels": [], "components": [], "fixVersion": null}'
          rows={6}
          className="w-full rounded border border-gk-border bg-gk-bg p-2 text-xs gk-mono text-gk-text"
        />
        {pasteError && <div className="mt-2 text-xs text-gk-danger">{pasteError}</div>}
        <button
          onClick={runPasted}
          disabled={!pasted || loadingId !== null}
          className="mt-2 rounded bg-gk-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loadingId === "pasted" ? "Running…" : "Run pipeline"}
        </button>
      </div>
    </div>
  );
}
