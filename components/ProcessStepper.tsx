"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  SourceArtifact,
  TriageResult,
  SanitizedFacts,
  Variant,
  VariantAudience,
  Finding,
} from "@/lib/schemas";
import { RedactionLog } from "@/components/RedactionLog";
import { FindingsList } from "@/components/FindingsList";
import { StatusBadge } from "@/components/Badge";

interface ProcessData {
  id: string;
  status: string;
  sourceArtifact: SourceArtifact;
  triageResult: TriageResult | null;
  sanitizedFacts: SanitizedFacts | null;
  variants: Record<VariantAudience, Variant> | null;
  findings: Record<VariantAudience, Finding[]> | null;
  policyVersion?: string | null;
}

const AUDIENCE_LABEL: Record<VariantAudience, string> = {
  internal_brief: "Internal brief",
  customer_email: "Customer email",
  marketing: "Marketing",
  in_app: "In-app",
};

const STAGES = ["Ingest", "Triage", "Sanitize", "Draft", "Check"] as const;

export function ProcessStepper({ process }: { process: ProcessData }) {
  const failedGate = process.status === "sufficiency_failed";
  const [stage, setStage] = useState<(typeof STAGES)[number]>(failedGate ? "Triage" : "Sanitize");
  const [audience, setAudience] = useState<VariantAudience>("customer_email");

  const availableStages = failedGate ? (["Ingest", "Triage"] as const) : STAGES;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="gk-mono text-lg font-semibold text-gk-text">{process.sourceArtifact.key}</h1>
          <p className="text-sm text-gk-text-secondary">{process.sourceArtifact.summary}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={process.status} />
          {!failedGate && (
            <Link
              href={`/process/${process.id}/review`}
              className="rounded bg-gk-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              Go to review →
            </Link>
          )}
        </div>
      </div>

      {failedGate && (
        <div className="rounded border border-gk-danger/40 bg-gk-danger/10 p-4">
          <div className="text-sm font-medium text-gk-danger">
            Pipeline stopped: this ticket doesn&apos;t have enough information to draft a customer-facing message.
          </div>
          <ul className="mt-2 list-inside list-disc text-sm text-gk-text-secondary">
            {process.triageResult?.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-1 border-b border-gk-border">
        {availableStages.map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`rounded-t px-3 py-2 text-sm ${
              stage === s ? "border-b-2 border-gk-accent text-gk-text" : "text-gk-text-secondary hover:text-gk-text"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {stage === "Ingest" && (
        <div className="space-y-2">
          <StageMeta label="Source" value={process.sourceArtifact.sourceType} />
          <StageMeta label="Type" value={process.sourceArtifact.issueType} />
          <StageMeta label="Components" value={process.sourceArtifact.components.join(", ") || "—"} />
          <StageMeta label="Fix version" value={process.sourceArtifact.fixVersion ?? "—"} />
          <RawJson data={process.sourceArtifact} />
        </div>
      )}

      {stage === "Triage" && process.triageResult && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <StageMeta label="Announceability" value={process.triageResult.announceability} />
            <StageMeta label="Message type" value={process.triageResult.messageType} />
            <StageMeta label="Risk tier" value={process.triageResult.riskTier} />
            <StageMeta label="Urgency" value={process.triageResult.urgency} />
          </div>
          <div className="rounded border border-gk-border bg-gk-surface p-3">
            <div className="mb-2 text-sm font-medium text-gk-text">
              Sufficiency score: {(process.triageResult.sufficiencyScore * 100).toFixed(0)}%
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs text-gk-text-secondary">
              {Object.entries(process.triageResult.sufficiencyAxes).map(([axis, score]) => (
                <div key={axis}>
                  {axis}: {(score * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          </div>
          <RawJson data={process.triageResult} />
        </div>
      )}

      {stage === "Sanitize" && process.sanitizedFacts && (
        <div className="space-y-4">
          <RedactionLog entries={process.sanitizedFacts.redactionLog} />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <StageMeta label="What changed" value={process.sanitizedFacts.whatChanged} block />
            <StageMeta label="Customer impact" value={process.sanitizedFacts.customerImpact} block />
            <StageMeta label="Action required" value={process.sanitizedFacts.actionRequired} block />
            <StageMeta label="Effective date" value={process.sanitizedFacts.effectiveDate} block />
          </div>
        </div>
      )}

      {stage === "Draft" && process.variants && (
        <div className="space-y-3">
          <AudienceTabs audience={audience} setAudience={setAudience} />
          <pre className="whitespace-pre-wrap rounded border border-gk-border bg-gk-surface p-4 text-sm text-gk-text">
            {process.variants[audience].body}
          </pre>
          <div className="text-xs text-gk-text-secondary">
            derived from facts hash <span className="gk-mono">{process.variants[audience].derivedFromFactsHash}</span>
          </div>
        </div>
      )}

      {stage === "Check" && process.findings && (
        <div className="space-y-3">
          <AudienceTabs audience={audience} setAudience={setAudience} />
          <FindingsList findings={process.findings[audience]} />
        </div>
      )}
    </div>
  );
}

function AudienceTabs({
  audience,
  setAudience,
}: {
  audience: VariantAudience;
  setAudience: (a: VariantAudience) => void;
}) {
  return (
    <div className="flex gap-1">
      {(Object.keys(AUDIENCE_LABEL) as VariantAudience[]).map((a) => (
        <button
          key={a}
          onClick={() => setAudience(a)}
          className={`rounded px-2.5 py-1 text-xs ${
            audience === a ? "bg-gk-surface-raised text-gk-text" : "text-gk-text-secondary hover:text-gk-text"
          }`}
        >
          {AUDIENCE_LABEL[a]}
        </button>
      ))}
    </div>
  );
}

function StageMeta({ label, value, block }: { label: string; value: string; block?: boolean }) {
  return (
    <div className={block ? "rounded border border-gk-border bg-gk-surface p-3" : ""}>
      <div className="text-xs text-gk-text-secondary">{label}</div>
      <div className="text-sm text-gk-text">{value}</div>
    </div>
  );
}

function RawJson({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-gk-accent">
        {open ? "Hide raw JSON" : "Show raw JSON"}
      </button>
      {open && (
        <pre className="gk-mono mt-2 max-h-96 overflow-auto rounded border border-gk-border bg-gk-bg p-3 text-xs text-gk-text-secondary">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
