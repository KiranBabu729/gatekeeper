import type { VariantAudience } from "@/lib/schemas";

export interface ChannelContract {
  maxWords: number;
  maxSentences?: number;
  requiredSections: string[];
  forbidden: string[];
  requiresFooter?: boolean;
  requiresSubstantiationNoteForSuperlatives?: boolean;
}

export const CHANNEL_CONTRACTS: Record<VariantAudience, ChannelContract> = {
  internal_brief: {
    maxWords: 800,
    requiredSections: ["Summary", "Customer impact", "Known issues", "Support talking points", "Escalation path"],
    forbidden: [],
  },
  customer_email: {
    maxWords: 300,
    requiredSections: ["What changed", "Customer impact", "Action required"],
    forbidden: ["ticket_ids", "engineer_names", "root_cause_detail"],
    requiresFooter: true,
  },
  marketing: {
    maxWords: 200,
    requiredSections: ["Headline", "Benefit"],
    forbidden: ["ticket_ids", "engineer_names", "root_cause_detail"],
    requiresSubstantiationNoteForSuperlatives: true,
  },
  in_app: {
    maxWords: 60,
    maxSentences: 4,
    requiredSections: [],
    forbidden: ["ticket_ids", "engineer_names", "root_cause_detail"],
  },
};

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function sentenceCount(text: string): number {
  return (text.match(/[.!?]+(?:\s|$)/g) || []).length || 1;
}

export function checkChannelContractWithSpec(
  contract: ChannelContract,
  body: string
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];

  const words = wordCount(body);
  if (words > contract.maxWords) {
    violations.push(`Exceeds ${contract.maxWords}-word limit (${words} words).`);
  }
  if (contract.maxSentences) {
    const sentences = sentenceCount(body);
    if (sentences > contract.maxSentences) {
      violations.push(`Exceeds ${contract.maxSentences}-sentence limit (${sentences} sentences).`);
    }
  }
  const normalizedBody = body.toLowerCase().replace(/[_-]/g, " ");
  for (const section of contract.requiredSections) {
    const normalizedSection = section.toLowerCase().replace(/[_-]/g, " ");
    if (!normalizedBody.includes(normalizedSection)) {
      violations.push(`Missing required section: "${section}".`);
    }
  }
  if (contract.requiresFooter && !/unsubscribe|questions\?|reach out|contact/i.test(body)) {
    violations.push("Missing required footer.");
  }

  return { ok: violations.length === 0, violations };
}

export function checkChannelContract(
  audience: VariantAudience,
  body: string
): { ok: boolean; violations: string[] } {
  return checkChannelContractWithSpec(CHANNEL_CONTRACTS[audience], body);
}
