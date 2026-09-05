import type { RedactionEntry } from "@/lib/schemas";

export function RedactionLog({ entries }: { entries: RedactionEntry[] }) {
  if (entries.length === 0) {
    return <div className="text-sm text-gk-text-secondary">No redactions were necessary.</div>;
  }

  const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded border border-gk-accent/40 bg-gk-accent/[0.08] px-3 py-2">
        <span className="text-sm font-medium text-gk-text">
          {entries.length} item{entries.length === 1 ? "" : "s"} removed before this text reached the drafting model
        </span>
        <span className="text-xs text-gk-text-secondary">
          {Object.entries(byCategory)
            .map(([cat, n]) => `${cat.replace(/_/g, " ")} (${n})`)
            .join(" · ")}
        </span>
      </div>
      <div className="overflow-x-auto rounded border border-gk-border">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[34%]" />
            <col className="w-[26%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="bg-gk-surface-raised text-gk-text-secondary">
            <tr>
              <th className="px-3 py-2 font-medium">Field</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Original</th>
              <th className="px-3 py-2 font-medium">Replaced with</th>
              <th className="px-3 py-2 font-medium">Method</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gk-border">
            {entries.map((e, i) => (
              <tr key={i} className="text-gk-text">
                <td className="gk-mono break-words px-3 py-2 text-gk-text-secondary">{e.field}</td>
                <td className="break-words px-3 py-2">{e.category.replace(/_/g, " ")}</td>
                <td className="gk-mono break-all px-3 py-2 text-gk-danger/90 line-through decoration-gk-danger/60">
                  {e.originalSnippet}
                </td>
                <td className="gk-mono break-words px-3 py-2 text-gk-text-secondary">{e.replacement}</td>
                <td className="px-3 py-2">
                  <span className="rounded border border-gk-border px-1.5 py-0.5 text-[11px] text-gk-text-secondary">
                    {e.method}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
