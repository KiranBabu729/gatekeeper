import { loadCurrentPolicy, loadPreviousPolicy } from "@/lib/policy/load";
import { lineDiff } from "@/lib/line-diff";
import { SeverityBadge } from "@/components/Badge";
import { ImpactPreview } from "@/components/ImpactPreview";

export default function PolicyPage() {
  const { policy: current, raw: currentRaw } = loadCurrentPolicy();
  const { raw: previousRaw } = loadPreviousPolicy();
  const diff = lineDiff(previousRaw, currentRaw);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gk-text">Policy {current.policy_version}</h1>
          <span className="text-xs text-gk-text-secondary">effective {current.effective_from}</span>
        </div>
        <p className="mt-1 text-sm text-gk-text-secondary">{current.changelog}</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gk-text">Rules ({current.rules.length})</h2>
        <div className="overflow-x-auto rounded border border-gk-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-gk-surface-raised text-gk-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Audiences</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gk-border">
              {current.rules.map((r) => (
                <tr key={r.id}>
                  <td className="gk-mono px-3 py-2 text-gk-text">{r.id}</td>
                  <td className="px-3 py-2">
                    <SeverityBadge severity={r.severity} />
                  </td>
                  <td className="px-3 py-2 text-gk-text-secondary">
                    {r.scope.audiences.join(", ")}
                    {r.scope.audience_overrides?.map((o) => (
                      <div key={o.audience} className="text-[11px] text-gk-warning">
                        → {o.severity} on {o.audience}
                      </div>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-gk-text">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gk-text">Lexicon ({current.lexicon.banned.length} banned terms)</h2>
        <div className="flex flex-wrap gap-2">
          {current.lexicon.banned.map((b) => (
            <span key={b.term} className="rounded border border-gk-border bg-gk-surface px-2 py-1 text-xs text-gk-text-secondary">
              <span className="gk-mono text-gk-text">{b.term}</span> → {b.replacement}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gk-text">Version diff (v1 → current)</h2>
        <pre className="gk-mono max-h-96 overflow-auto rounded border border-gk-border bg-gk-bg p-3 text-xs">
          {diff.map((t, i) => (
            <div
              key={i}
              className={
                t.type === "add"
                  ? "bg-gk-success/15 text-gk-text"
                  : t.type === "remove"
                  ? "bg-gk-danger/15 text-gk-text-secondary line-through"
                  : "text-gk-text-secondary"
              }
            >
              {t.type === "add" ? "+ " : t.type === "remove" ? "- " : "  "}
              {t.line}
            </div>
          ))}
        </pre>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gk-text">Impact preview</h2>
        <p className="mb-2 text-xs text-gk-text-secondary">
          Edit the policy below and run it against every previously approved message to see what would newly fail.
        </p>
        <ImpactPreview currentRaw={currentRaw} />
      </section>
    </div>
  );
}
