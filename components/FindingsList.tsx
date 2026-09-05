import type { Finding } from "@/lib/schemas";
import { SeverityBadge } from "@/components/Badge";

const ORDER: Record<string, number> = { block: 0, warn: 1, advise: 2 };

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <div className="text-sm text-gk-success">No findings — this message is clean against the current policy.</div>;
  }

  const sorted = [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return (
    <ul className="space-y-2">
      {sorted.map((f, i) => (
        <li key={i} className="rounded border border-gk-border bg-gk-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={f.severity} />
              <span className="gk-mono text-xs text-gk-text-secondary">{f.ruleId}</span>
            </div>
          </div>
          {f.text && (
            <div className="mt-1.5 gk-mono text-xs text-gk-text">
              &ldquo;{f.text}&rdquo;
            </div>
          )}
          <div className="mt-1.5 text-xs text-gk-text-secondary">{f.rationale}</div>
          {f.suggestedFix && (
            <div className="mt-1 text-xs text-gk-text-secondary">
              <span className="text-gk-text">Fix:</span> {f.suggestedFix}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
