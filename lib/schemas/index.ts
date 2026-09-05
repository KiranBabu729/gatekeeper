import { z } from "zod";

/**
 * Stage boundary schemas. `SanitizedFacts` is the only type the draft() and
 * checkPolicy() functions accept — there is no field on it that carries raw
 * ticket text, and no function anywhere converts a `SourceArtifact` into one
 * except `sanitize()`. See lib/pipeline/boundary.ts for the enforcement.
 */

export const SourceArtifactSchema = z.object({
  id: z.string(),
  sourceType: z.enum(["jira", "linear", "pasted"]),
  issueType: z.enum([
    "feature",
    "bugfix",
    "incident",
    "security_advisory",
    "deprecation",
    "breaking_change",
    "maintenance",
  ]),
  key: z.string(),
  summary: z.string(),
  description: z.string(),
  comments: z.array(
    z.object({ author: z.string(), body: z.string(), createdAt: z.string() })
  ),
  labels: z.array(z.string()),
  components: z.array(z.string()),
  fixVersion: z.string().nullable(),
  rawHash: z.string(),
  ingestedAt: z.string(),
});
export type SourceArtifact = z.infer<typeof SourceArtifactSchema>;

export const TriageResultSchema = z.object({
  announceability: z.enum(["none", "internal_only", "customer_facing", "public"]),
  messageType: z.enum([
    "feature",
    "bugfix",
    "incident",
    "security_advisory",
    "deprecation",
    "breaking_change",
    "maintenance",
  ]),
  impactScope: z.string(),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  riskTier: z.enum(["standard", "requires_legal"]),
  sufficiencyScore: z.number().min(0).max(1),
  sufficiencyAxes: z.object({
    whatChanged: z.number().min(0).max(1),
    whoAffected: z.number().min(0).max(1),
    actionRequired: z.number().min(0).max(1),
    whenEffective: z.number().min(0).max(1),
  }),
  openQuestions: z.array(z.string()),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

export const RedactionEntrySchema = z.object({
  field: z.string(),
  category: z.string(),
  originalSnippet: z.string(),
  replacement: z.string(),
  method: z.enum(["deterministic", "llm"]),
});
export type RedactionEntry = z.infer<typeof RedactionEntrySchema>;

export const SanitizedFactsSchema = z.object({
  whatChanged: z.string(),
  customerImpact: z.string(),
  actionRequired: z.string(),
  effectiveDate: z.string(),
  affectedScope: z.string(),
  knownLimitations: z.array(z.string()),
  redactionLog: z.array(RedactionEntrySchema),
  factsHash: z.string(),
});
export type SanitizedFacts = z.infer<typeof SanitizedFactsSchema>;

export const VariantAudienceSchema = z.enum([
  "internal_brief",
  "customer_email",
  "marketing",
  "in_app",
]);
export type VariantAudience = z.infer<typeof VariantAudienceSchema>;

export const VariantSchema = z.object({
  audience: VariantAudienceSchema,
  body: z.string(),
  derivedFromFactsHash: z.string(),
  isStale: z.boolean(),
  edits: z.array(
    z.object({ at: z.string(), before: z.string(), after: z.string() })
  ),
});
export type Variant = z.infer<typeof VariantSchema>;

export const FindingSchema = z.object({
  ruleId: z.string(),
  severity: z.enum(["block", "warn", "advise"]),
  span: z.tuple([z.number(), z.number()]),
  text: z.string(),
  rationale: z.string(),
  suggestedFix: z.string(),
  autoFixAvailable: z.boolean(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const AuditRecordSchema = z.object({
  messageId: z.string(),
  sourceIds: z.array(z.string()),
  policyVersion: z.string(),
  model: z.string(),
  factsHash: z.string(),
  generatedAt: z.string(),
  edits: z.array(z.any()),
  findingsAtApproval: z.record(z.string(), z.array(FindingSchema)),
  overrides: z.array(
    z.object({ ruleId: z.string(), audience: z.string(), justification: z.string(), by: z.string(), at: z.string() })
  ),
  approvals: z.array(
    z.object({ by: z.string(), role: z.enum(["author", "legal_reviewer"]), at: z.string() })
  ),
  exportedAt: z.string().nullable(),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;
