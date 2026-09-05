"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Variant, VariantAudience, Finding, TriageResult, AuditRecord } from "@/lib/schemas";
import { HighlightedText } from "@/components/HighlightedText";
import { SeverityBadge } from "@/components/Badge";
import { wordDiff } from "@/lib/diff";
import { useCurrentUser } from "@/components/UserContext";

const AUDIENCE_LABEL: Record<VariantAudience, string> = {
  internal_brief: "Internal brief",
  customer_email: "Customer email",
  marketing: "Marketing",
  in_app: "In-app",
};

interface ProcessData {
  id: string;
  status: string;
  triageResult: TriageResult;
  variants: Record<VariantAudience, Variant>;
  findings: Record<VariantAudience, Finding[]>;
  auditRecord: AuditRecord | null;
}

export function ReviewPanel({ process: initial }: { process: ProcessData }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [process, setProcess] = useState(initial);
  const [audience, setAudience] = useState<VariantAudience>("customer_email");
  const [draftBody, setDraftBody] = useState(process.variants[audience].body);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [exported, setExported] = useState(process.status === "exported");

  function switchAudience(a: VariantAudience) {
    setAudience(a);
    setDraftBody(process.variants[a].body);
  }

  const variant = process.variants[audience];
  const findings = process.findings[audience] ?? [];
  const original = variant.edits.length > 0 ? variant.edits[0].before : variant.body;
  const blockFindings = findings.filter((f) => f.severity === "block");
  const warnFindings = findings.filter((f) => f.severity === "warn");
  const anyStale = Object.values(process.variants).some((v) => v.isStale);

  async function saveEdit() {
    setSaving(true);
    const res = await fetch(`/api/process/${process.id}/edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, body: draftBody }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) setProcess(data);
  }

  async function resync() {
    const res = await fetch(`/api/process/${process.id}/resync`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setProcess(data);
      setDraftBody(data.variants[audience].body);
    }
  }

  async function approve() {
    setApproveError(null);
    const overrideList = Object.entries(overrides)
      .filter(([, justification]) => justification.trim().length > 0)
      .map(([key, justification]) => {
        const [aud, ruleId] = key.split("::");
        return { audience: aud as VariantAudience, ruleId, justification };
      });

    const res = await fetch(`/api/process/${process.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ by: user.name, role: user.role, overrides: overrideList }),
    });
    const data = await res.json();
    if (res.ok) {
      setProcess(data);
      router.refresh();
    } else {
      setApproveError(data.error + (data.unresolvedBlocks ? `: ${data.unresolvedBlocks.join(", ")}` : ""));
    }
  }

  async function doExport() {
    const res = await fetch(`/api/process/${process.id}/export`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setProcess(data);
      setExported(true);
    }
  }

  const requiresLegal = process.triageResult.riskTier === "requires_legal";
  const canApprove = !requiresLegal || user.role === "legal_reviewer";
  const allBlocksResolved = blockFindings.every((f) => overrides[`${audience}::${f.ruleId}`]?.trim());
  const isApproved = process.status === "approved" || process.status === "exported";

  return (
    <div className="space-y-6">
      <div className="flex gap-1">
        {(Object.keys(AUDIENCE_LABEL) as VariantAudience[]).map((a) => (
          <button
            key={a}
            onClick={() => switchAudience(a)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ${
              audience === a ? "bg-gk-surface-raised text-gk-text" : "text-gk-text-secondary hover:text-gk-text"
            }`}
          >
            {AUDIENCE_LABEL[a]}
            {process.variants[a].isStale && <span className="h-1.5 w-1.5 rounded-full bg-gk-warning" />}
            {(process.findings[a] ?? []).some((f) => f.severity === "block") && (
              <span className="h-1.5 w-1.5 rounded-full bg-gk-danger" />
            )}
          </button>
        ))}
      </div>

      {variant.isStale && (
        <div className="flex items-center justify-between rounded border border-gk-warning/40 bg-gk-warning/10 px-3 py-2 text-sm">
          <span className="text-gk-warning">A sibling variant was edited — this one may be out of sync with the facts.</span>
          <button onClick={resync} className="rounded border border-gk-border px-2 py-1 text-xs text-gk-text">
            Re-sync unedited siblings
          </button>
        </div>
      )}
      {!variant.isStale && anyStale && (
        <button onClick={resync} className="rounded border border-gk-border px-2 py-1 text-xs text-gk-text-secondary">
          Re-sync unedited siblings
        </button>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Pane title="Original draft">
          <pre className="whitespace-pre-wrap text-sm text-gk-text-secondary">{original}</pre>
        </Pane>
        <Pane title="Current (editable)">
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={12}
            className="w-full resize-none bg-transparent text-sm text-gk-text outline-none"
          />
          {draftBody !== variant.body && (
            <button
              onClick={saveEdit}
              disabled={saving}
              className="mt-2 rounded bg-gk-accent px-2.5 py-1 text-xs font-medium text-white"
            >
              {saving ? "Saving…" : "Save edit"}
            </button>
          )}
        </Pane>
        <Pane title="Diff">
          <div className="whitespace-pre-wrap text-sm">
            {wordDiff(original, variant.body).map((t, i) =>
              t.type === "equal" ? (
                <span key={i} className="text-gk-text-secondary">
                  {t.text}
                </span>
              ) : t.type === "add" ? (
                <span key={i} className="bg-gk-success/20 text-gk-text">
                  {t.text}
                </span>
              ) : (
                <span key={i} className="bg-gk-danger/20 text-gk-text-secondary line-through">
                  {t.text}
                </span>
              )
            )}
          </div>
        </Pane>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gk-text">Message with findings highlighted</h3>
        <div className="rounded border border-gk-border bg-gk-surface p-4 text-sm text-gk-text whitespace-pre-wrap">
          <HighlightedText text={variant.body} findings={findings} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-gk-danger">Blocking findings ({blockFindings.length})</h3>
          <div className="space-y-2">
            {blockFindings.map((f, i) => (
              <div key={i} className="rounded border border-gk-danger/40 bg-gk-danger/5 p-3">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={f.severity} />
                  <span className="gk-mono text-xs text-gk-text-secondary">{f.ruleId}</span>
                </div>
                <div className="mt-1 text-xs text-gk-text-secondary">{f.rationale}</div>
                <input
                  value={overrides[`${audience}::${f.ruleId}`] ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, [`${audience}::${f.ruleId}`]: e.target.value }))}
                  placeholder="Written justification required to override"
                  className="mt-2 w-full rounded border border-gk-border bg-gk-bg px-2 py-1 text-xs text-gk-text"
                />
              </div>
            ))}
            {blockFindings.length === 0 && <div className="text-sm text-gk-text-secondary">None.</div>}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-gk-warning">Warnings ({warnFindings.length})</h3>
          <div className="space-y-2">
            {warnFindings.map((f, i) => (
              <div key={i} className="rounded border border-gk-warning/40 bg-gk-warning/5 p-3">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={f.severity} />
                  <span className="gk-mono text-xs text-gk-text-secondary">{f.ruleId}</span>
                </div>
                <div className="mt-1 text-xs text-gk-text-secondary">{f.rationale}</div>
                <input
                  value={overrides[`${audience}::${f.ruleId}`] ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, [`${audience}::${f.ruleId}`]: e.target.value }))}
                  placeholder="Optional justification to override"
                  className="mt-2 w-full rounded border border-gk-border bg-gk-bg px-2 py-1 text-xs text-gk-text"
                />
              </div>
            ))}
            {warnFindings.length === 0 && <div className="text-sm text-gk-text-secondary">None.</div>}
          </div>
        </div>
      </div>

      <div className="rounded border border-gk-border bg-gk-surface p-4">
        {isApproved ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gk-success">Approved. Immutable audit record created.</span>
            {!exported && (
              <button onClick={doExport} className="rounded bg-gk-accent px-3 py-1.5 text-sm font-medium text-white">
                Export
              </button>
            )}
            {exported && <span className="text-sm text-gk-text-secondary">Exported.</span>}
          </div>
        ) : (
          <>
            <div className="mb-2 text-sm text-gk-text-secondary">
              Risk tier: <span className="text-gk-text">{process.triageResult.riskTier}</span>
              {requiresLegal && " — requires approval from the Legal Reviewer role."}
            </div>
            {!allBlocksResolved && blockFindings.length > 0 && (
              <div className="mb-2 text-xs text-gk-danger">
                All blocking findings across every audience need a justification before you can approve.
              </div>
            )}
            {!canApprove && (
              <div className="mb-2 text-xs text-gk-danger">Switch to the Legal Reviewer user to approve this message.</div>
            )}
            {approveError && <div className="mb-2 text-xs text-gk-danger">{approveError}</div>}
            <button
              onClick={approve}
              disabled={!canApprove}
              className="rounded bg-gk-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Approve as {user.name}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Pane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-gk-border bg-gk-surface p-3">
      <div className="mb-2 text-xs font-medium text-gk-text-secondary">{title}</div>
      {children}
    </div>
  );
}
