import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { StatusBadge } from "@/components/Badge";
import type { AuditRecord } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const processes = await prisma.process.findMany({
    where: { status: { in: ["approved", "exported"] } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gk-text">Audit records</h1>
        <p className="mt-1 text-sm text-gk-text-secondary">Every approved message, frozen at the moment of approval.</p>
      </div>

      <div className="divide-y divide-gk-border rounded border border-gk-border bg-gk-surface">
        {processes.map((p) => {
          const audit = p.auditRecord as AuditRecord;
          return (
            <Link key={p.id} href={`/audit/${p.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gk-surface-raised">
              <div>
                <span className="gk-mono text-gk-text">{p.ticketKey}</span>
                <span className="ml-3 text-xs text-gk-text-secondary">policy {audit.policyVersion}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gk-text-secondary">{audit.approvals.length} approval(s)</span>
                <StatusBadge status={p.status} />
              </div>
            </Link>
          );
        })}
        {processes.length === 0 && <div className="px-4 py-6 text-sm text-gk-text-secondary">No approved messages yet.</div>}
      </div>
    </div>
  );
}
