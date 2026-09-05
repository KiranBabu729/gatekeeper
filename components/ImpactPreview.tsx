"use client";

import { useState } from "react";

interface ImpactResult {
  policyVersion: string;
  totalApprovedMessages: number;
  messagesThatWouldNowFail: number;
  impact: {
    processId: string;
    ticketKey: string;
    wouldNowFail: boolean;
    newFindingsByAudience: Record<string, { ruleId: string; rationale: string }[]>;
  }[];
}

export function ImpactPreview({ currentRaw }: { currentRaw: string }) {
  const [yaml, setYaml] = useState(currentRaw);
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/policy/impact-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yaml }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data);
    else setError(data.error);
  }

  return (
    <div className="space-y-3">
      <textarea
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        rows={14}
        className="w-full rounded border border-gk-border bg-gk-bg p-3 text-xs gk-mono text-gk-text"
      />
      <button onClick={run} disabled={loading} className="rounded bg-gk-accent px-3 py-1.5 text-sm font-medium text-white">
        {loading ? "Running against approved messages…" : "Run impact preview"}
      </button>
      {error && <div className="text-xs text-gk-danger">{error}</div>}
      {result && (
        <div className="rounded border border-gk-border bg-gk-surface p-4">
          <div className="mb-3 text-sm text-gk-text">
            {result.messagesThatWouldNowFail} of {result.totalApprovedMessages} previously approved messages would now
            fail under this candidate policy.
          </div>
          <div className="space-y-2">
            {result.impact
              .filter((i) => i.wouldNowFail)
              .map((i) => (
                <div key={i.processId} className="rounded border border-gk-danger/40 bg-gk-danger/5 p-3 text-xs">
                  <div className="gk-mono font-medium text-gk-text">{i.ticketKey}</div>
                  {Object.entries(i.newFindingsByAudience).map(([audience, findings]) => (
                    <div key={audience} className="mt-1 text-gk-text-secondary">
                      {audience}: {findings.map((f) => f.ruleId).join(", ")}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
