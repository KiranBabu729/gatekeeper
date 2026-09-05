import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import type { AuditRecord, Variant, VariantAudience } from "@/lib/schemas";
import { StatusBadge } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const process = await prisma.process.findUnique({ where: { id } });
  if (!process || !process.auditRecord) notFound();

  const audit = process.auditRecord as AuditRecord;
  const variants = process.variants as Record<VariantAudience, Variant>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="gk-mono text-lg font-semibold text-gk-text">{process.ticketKey}</h1>
          <p className="text-sm text-gk-text-secondary">Immutable audit record</p>
        </div>
        <StatusBadge status={process.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <Meta label="Policy version" value={audit.policyVersion} />
        <Meta label="Model" value={audit.model} />
        <Meta label="Facts hash" value={audit.factsHash} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gk-text">Approvals</h2>
        <ul className="space-y-1 text-sm text-gk-text-secondary">
          {audit.approvals.map((a, i) => (
            <li key={i}>
              {a.by} ({a.role}) at {a.at}
            </li>
          ))}
        </ul>
      </section>

      {audit.overrides.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-gk-text">Overrides</h2>
          <ul className="space-y-1 text-sm text-gk-text-secondary">
            {audit.overrides.map((o, i) => (
              <li key={i} className="rounded border border-gk-border bg-gk-surface p-2">
                <span className="gk-mono text-gk-text">{o.ruleId}</span> on {o.audience} — &ldquo;{o.justification}&rdquo; ({o.by})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-gk-text">Approved messages</h2>
        <div className="space-y-3">
          {(Object.keys(variants) as VariantAudience[]).map((a) => (
            <div key={a} className="rounded border border-gk-border bg-gk-surface p-3">
              <div className="mb-1 text-xs text-gk-text-secondary">{a}</div>
              <pre className="whitespace-pre-wrap text-sm text-gk-text">{variants[a].body}</pre>
            </div>
          ))}
        </div>
      </section>

      <details className="rounded border border-gk-border bg-gk-surface p-3">
        <summary className="cursor-pointer text-sm text-gk-text-secondary">Full audit record JSON</summary>
        <pre className="gk-mono mt-2 max-h-96 overflow-auto text-xs text-gk-text-secondary">
          {JSON.stringify(audit, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gk-border bg-gk-surface p-3">
      <div className="text-xs text-gk-text-secondary">{label}</div>
      <div className="gk-mono text-sm text-gk-text">{value}</div>
    </div>
  );
}
