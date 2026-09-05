import { z } from "zod";

export const SeveritySchema = z.enum(["block", "warn", "advise"]);

export const PolicyRuleSchema = z.object({
  id: z.string(),
  class: z.string(),
  severity: SeveritySchema,
  scope: z.object({
    audiences: z.array(z.string()),
    types: z.array(z.string()),
    audience_overrides: z
      .array(z.object({ audience: z.string(), severity: SeveritySchema }))
      .optional(),
  }),
  description: z.string(),
  remediation: z.string(),
  tests: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string()),
  }),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

export const ChannelContractPolicySchema = z.object({
  max_words: z.number(),
  max_sentences: z.number().optional(),
  required_sections: z.array(z.string()),
  forbidden: z.array(z.string()),
});

export const PolicySchema = z.object({
  policy_version: z.string(),
  effective_from: z.string(),
  owners: z.record(z.string(), z.string()),
  changelog: z.string(),
  voice: z.object({ register: z.string(), person: z.string() }),
  lexicon: z.object({
    banned: z.array(
      z.object({
        term: z.string(),
        replacement: z.string(),
        severity: SeveritySchema,
        rationale: z.string(),
      })
    ),
  }),
  rules: z.array(PolicyRuleSchema),
  channels: z.record(z.string(), ChannelContractPolicySchema),
});
export type Policy = z.infer<typeof PolicySchema>;

export function ruleSeverityForAudience(rule: PolicyRule, audience: string): PolicyRule["severity"] | null {
  if (!rule.scope.audiences.includes(audience)) return null;
  const override = rule.scope.audience_overrides?.find((o) => o.audience === audience);
  return override ? override.severity : rule.severity;
}
