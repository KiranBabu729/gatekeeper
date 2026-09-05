import { runEvals, GATES } from "@/evals/runner";

export default function EvalsPage() {
  const report = runEvals();
  const passed = report.results.filter((r) => r.pass).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gk-text">Eval harness</h1>
        <p className="mt-1 text-sm text-gk-text-secondary">
          {passed}/{report.results.length} golden-set examples pass.
        </p>
      </div>

      <div
        className={`rounded border p-4 ${
          report.gatePassed ? "border-gk-success/40 bg-gk-success/10" : "border-gk-danger/40 bg-gk-danger/10"
        }`}
      >
        <div className={`text-sm font-semibold ${report.gatePassed ? "text-gk-success" : "text-gk-danger"}`}>
          Gate: {report.gatePassed ? "PASSED" : "FAILED"}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gk-text-secondary">Block-severity recall: </span>
            <span className="gk-mono text-gk-text">{(report.blockRecall * 100).toFixed(1)}%</span>
            <span className="text-gk-text-secondary"> (gate {GATES.BLOCK_RECALL_GATE * 100}%)</span>
          </div>
          <div>
            <span className="text-gk-text-secondary">Sanitization recall: </span>
            <span className="gk-mono text-gk-text">{(report.sanitizationRecall * 100).toFixed(1)}%</span>
            <span className="text-gk-text-secondary"> (gate {GATES.SANITIZATION_RECALL_GATE * 100}%)</span>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gk-text">Per-rule precision / recall</h2>
        <div className="overflow-x-auto rounded border border-gk-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-gk-surface-raised text-gk-text-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Rule</th>
                <th className="px-3 py-2 font-medium">Precision</th>
                <th className="px-3 py-2 font-medium">Recall</th>
                <th className="px-3 py-2 font-medium">TP / FP / FN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gk-border">
              {report.ruleStats.map((s) => (
                <tr key={s.ruleId}>
                  <td className="gk-mono px-3 py-2 text-gk-text">{s.ruleId}</td>
                  <td className="px-3 py-2 text-gk-text">{s.precision.toFixed(2)}</td>
                  <td className="px-3 py-2 text-gk-text">{s.recall.toFixed(2)}</td>
                  <td className="gk-mono px-3 py-2 text-gk-text-secondary">
                    {s.tp} / {s.fp} / {s.fn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gk-text">Golden-set examples</h2>
        <div className="divide-y divide-gk-border rounded border border-gk-border bg-gk-surface">
          {report.results.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div className="flex items-center gap-3">
                <span className={`gk-mono text-xs font-semibold ${r.pass ? "text-gk-success" : "text-gk-danger"}`}>
                  {r.pass ? "PASS" : "FAIL"}
                </span>
                <span className="text-gk-text">{r.id}</span>
                <span className="rounded border border-gk-border px-1.5 py-0.5 text-[11px] text-gk-text-secondary">
                  {r.category}
                </span>
              </div>
              {r.detail && <span className="text-xs text-gk-danger">{r.detail}</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
