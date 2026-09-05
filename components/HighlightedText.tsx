import type { Finding } from "@/lib/schemas";

export function HighlightedText({ text, findings }: { text: string; findings: Finding[] }) {
  const spans = findings.filter((f) => f.span[1] > f.span[0]).sort((a, b) => a.span[0] - b.span[0]);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((f, i) => {
    const [start, end] = f.span;
    if (start < cursor) return; // skip overlaps for this simple renderer
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark key={i} className={`gk-mark gk-mark-${f.severity}`} title={`${f.ruleId}: ${f.rationale}`}>
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}
