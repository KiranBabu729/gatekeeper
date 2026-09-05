import Link from "next/link";
import { FIXTURE_TICKETS } from "@/fixtures/tickets";
import { TicketPicker } from "@/components/TicketPicker";
import { prisma } from "@/lib/db/client";
import { StatusBadge } from "@/components/Badge";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recent = await prisma.process.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-lg font-semibold text-gk-text">Pick a ticket</h1>
        <p className="mt-1 text-sm text-gk-text-secondary">
          Run any of the 8 seeded fixtures through the pipeline, or paste raw ticket JSON.
        </p>
      </div>

      <TicketPicker tickets={FIXTURE_TICKETS} />

      {recent.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-gk-text">Recent runs</h2>
          <div className="divide-y divide-gk-border rounded border border-gk-border bg-gk-surface">
            {recent.map((p) => (
              <Link
                key={p.id}
                href={`/process/${p.id}`}
                className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gk-surface-raised"
              >
                <span className="gk-mono text-gk-text-secondary">{p.ticketKey}</span>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
