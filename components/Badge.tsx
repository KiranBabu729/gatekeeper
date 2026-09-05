const SEVERITY_STYLES: Record<string, string> = {
  block: "bg-gk-danger/15 text-gk-danger border-gk-danger/40",
  warn: "bg-gk-warning/15 text-gk-warning border-gk-warning/40",
  advise: "bg-gk-text-secondary/15 text-gk-text-secondary border-gk-text-secondary/40",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[severity] ?? ""}`}>
      {severity}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  checked: "bg-gk-surface-raised text-gk-text-secondary border-gk-border",
  sufficiency_failed: "bg-gk-danger/15 text-gk-danger border-gk-danger/40",
  approved: "bg-gk-success/15 text-gk-success border-gk-success/40",
  exported: "bg-gk-accent/15 text-gk-accent border-gk-accent/40",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "border-gk-border text-gk-text-secondary"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
