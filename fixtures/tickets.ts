import type { SourceArtifact } from "@/lib/schemas";
import { stableHash } from "@/lib/hash";

function mk(t: Omit<SourceArtifact, "rawHash" | "ingestedAt">): SourceArtifact {
  return { ...t, rawHash: stableHash(t), ingestedAt: "2026-09-01T09:00:00.000Z" };
}

export const FIXTURE_TICKETS: SourceArtifact[] = [
  mk({
    id: "fx-1",
    sourceType: "jira",
    issueType: "feature",
    key: "GK-101",
    summary: "Add CSV export to the reporting dashboard",
    description:
      "Customers on the Growth and Enterprise plans can now export any dashboard report to CSV directly from the report toolbar. This was the #1 requested feature from Northwind Traders and several other accounts. No action required — the export button appears automatically for eligible accounts starting with release 4.12.0.",
    comments: [
      { author: "@priya.eng", body: "QA signed off, see GK-101 for the test matrix. Contact priya@ourcompany.com with questions.", createdAt: "2026-08-28T10:00:00.000Z" },
    ],
    labels: ["public"],
    components: ["Reporting"],
    fixVersion: "4.12.0",
  }),
  mk({
    id: "fx-2",
    sourceType: "jira",
    issueType: "bugfix",
    key: "GK-142",
    summary: "Fix incorrect timezone conversion in scheduled report delivery",
    description:
      "Scheduled reports delivered to customers in UTC+ timezones were arriving with timestamps offset by one hour due to a daylight-saving bug in the scheduler introduced in 4.10.0. Root cause was a hardcoded UTC offset in the cron abstraction (caused by a bad assumption engineer @sam.k made during the timezone refactor). Fix ships in 4.13.0. No customer action required; historical report timestamps are unaffected.",
    comments: [
      { author: "@sam.k", body: "Confirmed fix in staging, ACC-88213 no longer shows the offset.", createdAt: "2026-08-29T14:00:00.000Z" },
    ],
    labels: [],
    components: ["Scheduling"],
    fixVersion: "4.13.0",
  }),
  mk({
    id: "fx-3",
    sourceType: "jira",
    issueType: "incident",
    key: "GK-P1-004",
    summary: "P1: API gateway returned elevated 502s for 38 minutes",
    description:
      "Between 14:02 and 14:40 UTC, the API gateway returned elevated 502 errors to roughly 6% of requests across all regions, affecting Meridian Financial and Cortex Labs most heavily based on request volume. Root cause was a misconfigured connection pool limit pushed in a routine gateway config change; the pool exhausted under peak load and new connections were rejected. Sev-1 was declared internally at 14:11. The on-call engineer @devon.r rolled back the config at 14:38 and error rates recovered by 14:40. A permanent fix (raising the pool ceiling and adding an alert) ships this week.",
    comments: [
      { author: "@devon.r", body: "Incident channel: https://internal.ourcompany.com/incidents/GK-P1-004", createdAt: "2026-08-30T15:00:00.000Z" },
      { author: "@priya.eng", body: "Customer CUST-5521 opened a support ticket asking if they'll be credited.", createdAt: "2026-08-30T15:20:00.000Z" },
    ],
    labels: ["legal-review"],
    components: ["API Gateway"],
    fixVersion: null,
  }),
  mk({
    id: "fx-4",
    sourceType: "jira",
    issueType: "security_advisory",
    key: "GK-SEC-009",
    summary: "Patch for session-fixation vulnerability in SSO login flow",
    description:
      "A session-fixation vulnerability in the SSO login flow allowed a session identifier issued before authentication to remain valid after login, under a narrow set of conditions requiring network-level access to the customer's identity provider redirect. No evidence of exploitation was found in a review of the last 90 days of access logs. The vulnerability is patched in 4.13.2. All active sessions were force-invalidated at patch deployment; affected customers should confirm SSO users can re-authenticate without issues. Reported via responsible disclosure; see our security policy for the disclosure process.",
    comments: [
      { author: "@security-team", body: "CVSS 6.8 (medium). Ashgrove Manufacturing flagged this during their pen test.", createdAt: "2026-08-31T09:00:00.000Z" },
    ],
    labels: ["legal-review"],
    components: ["Auth", "SSO"],
    fixVersion: "4.13.2",
  }),
  mk({
    id: "fx-5",
    sourceType: "jira",
    issueType: "deprecation",
    key: "GK-220",
    summary: "Deprecate the v1 Reports API in favor of v2",
    description:
      "The v1 Reports API (/api/v1/reports/*) is deprecated and will be removed on 2027-01-15. All functionality is available in the v2 Reports API, which adds pagination and field filtering. Customers with integrations calling v1 endpoints should migrate to v2 before the removal date; v1 will return deprecation warning headers starting 4.13.0 to help identify remaining callers.",
    comments: [
      { author: "@platform-team", body: "Solstice Retail is our largest known v1 consumer, per usage telemetry.", createdAt: "2026-08-27T11:00:00.000Z" },
    ],
    labels: ["public"],
    components: ["Reports API"],
    fixVersion: "4.13.0",
  }),
  mk({
    id: "fx-6",
    sourceType: "jira",
    issueType: "breaking_change",
    key: "GK-231",
    summary: "Webhook payload signature header renamed for consistency",
    description:
      "Starting with release 4.14.0, the webhook signature header sent with every outbound webhook changes from X-Signature to X-Gatekeeper-Signature to match our other product lines' naming convention. The signing algorithm (HMAC-SHA256) is unchanged. Customers with webhook consumers that read the X-Signature header must update to read the new header name before upgrading, or webhook verification will silently fail. Effective date: 2026-10-01.",
    comments: [
      { author: "@api-team", body: "Talus Health's integration team already asked about this in ACC-77012.", createdAt: "2026-08-26T16:00:00.000Z" },
    ],
    labels: ["public"],
    components: ["Webhooks"],
    fixVersion: "4.14.0",
  }),
  mk({
    id: "fx-7",
    sourceType: "jira",
    issueType: "maintenance",
    key: "GK-244",
    summary: "Scheduled database maintenance window for read-replica upgrade",
    description:
      "A scheduled maintenance window is planned for 2026-09-20 from 02:00 to 04:00 UTC to upgrade read-replica database instances to a new hardware generation. During this window, reporting dashboards and scheduled report delivery may experience brief read latency increases or delivery delays of up to 15 minutes; the primary write path (data ingestion, live dashboards) is unaffected. No customer action required.",
    comments: [
      { author: "@infra-team", body: "Coordinating with ACC-90210 since they have a board meeting that week — do not mention this in the customer message.", createdAt: "2026-09-01T08:00:00.000Z" },
    ],
    labels: ["public"],
    components: ["Infrastructure"],
    fixVersion: null,
  }),
  mk({
    id: "fx-8",
    sourceType: "jira",
    issueType: "feature",
    key: "GK-260",
    summary: "Improve thing",
    description:
      "Made some improvements based on customer feedback. Should be better now. Will follow up with more details later.",
    comments: [{ author: "@pm-team", body: "Need more detail before this can go out — flagging for follow-up.", createdAt: "2026-09-02T09:00:00.000Z" }],
    labels: [],
    components: [],
    fixVersion: null,
  }),
];
