import goldenSet from "./golden-set.json";
import { checkPolicy } from "@/lib/pipeline/policy-check";
import { runDeterministicRedactors } from "@/lib/pipeline/redactors";
import { runJudgmentPass } from "@/lib/pipeline/sanitize";
import { loadCurrentPolicy } from "@/lib/policy/load";
import type { Variant, VariantAudience } from "@/lib/schemas";

interface PolicyExample {
  id: string;
  kind: "policy";
  category: "core" | "adversarial" | "negative_control";
  ruleId?: string;
  audience: VariantAudience;
  messageType: string;
  text: string;
  expectDetect: boolean;
}

interface SanitizationExample {
  id: string;
  kind: "sanitization";
  category: "sanitization";
  field: string;
  text: string;
  expectedCategories: string[];
}

type GoldenExample = PolicyExample | SanitizationExample;

export interface ExampleResult {
  id: string;
  category: string;
  pass: boolean;
  detail: string;
}

export interface RuleStat {
  ruleId: string;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
}

export interface EvalReport {
  results: ExampleResult[];
  ruleStats: RuleStat[];
  blockRecall: number;
  sanitizationRecall: number;
  gatePassed: boolean;
}

const BLOCK_RECALL_GATE = 0.98;
const SANITIZATION_RECALL_GATE = 1.0;

export function runEvals(): EvalReport {
  const examples = goldenSet as GoldenExample[];
  const { policy } = loadCurrentPolicy();

  const results: ExampleResult[] = [];
  const ruleFires: Record<string, { tp: number; fp: number; fn: number }> = {};
  const bump = (ruleId: string, key: "tp" | "fp" | "fn") => {
    ruleFires[ruleId] ??= { tp: 0, fp: 0, fn: 0 };
    ruleFires[ruleId][key] += 1;
  };

  let blockExpected = 0;
  let blockDetected = 0;
  let sanitizationExpected = 0;
  let sanitizationDetected = 0;

  for (const ex of examples) {
    if (ex.kind === "policy") {
      const variant: Variant = {
        audience: ex.audience,
        body: ex.text,
        derivedFromFactsHash: "eval",
        isStale: false,
        edits: [],
      };
      const findings = checkPolicy(variant, ex.messageType, policy);
      const firedRuleIds = new Set(findings.map((f) => f.ruleId));

      if (ex.ruleId) {
        const detected = firedRuleIds.has(ex.ruleId);
        const pass = ex.expectDetect === detected;
        results.push({
          id: ex.id,
          category: ex.category,
          pass,
          detail: pass ? "" : detected ? `${ex.ruleId} fired but should not have` : `${ex.ruleId} did not fire`,
        });
        if (ex.expectDetect) {
          if (detected) bump(ex.ruleId, "tp");
          else bump(ex.ruleId, "fn");

          const rule = policy.rules.find((r) => r.id === ex.ruleId);
          const isBlock = rule?.severity === "block" || findings.some((f) => f.ruleId === ex.ruleId && f.severity === "block");
          if (isBlock) {
            blockExpected += 1;
            if (detected) blockDetected += 1;
          }
        } else if (detected) {
          bump(ex.ruleId, "fp");
        }
      } else {
        // negative control: nothing should fire
        const pass = findings.length === 0;
        results.push({
          id: ex.id,
          category: ex.category,
          pass,
          detail: pass ? "" : `Unexpected findings: ${[...firedRuleIds].join(", ")}`,
        });
        for (const ruleId of firedRuleIds) bump(ruleId, "fp");
      }
    } else {
      const det = runDeterministicRedactors(ex.text, ex.field);
      const judg = runJudgmentPass(det.text, ex.field);
      const categories = new Set([...det.hits, ...judg.hits].map((h) => h.category));
      const missing = ex.expectedCategories.filter((c) => !categories.has(c));
      const pass = missing.length === 0;
      results.push({
        id: ex.id,
        category: ex.category,
        pass,
        detail: pass ? "" : `Missing redaction categories: ${missing.join(", ")}`,
      });
      sanitizationExpected += ex.expectedCategories.length;
      sanitizationDetected += ex.expectedCategories.length - missing.length;
    }
  }

  const ruleStats: RuleStat[] = Object.entries(ruleFires).map(([ruleId, counts]) => ({
    ruleId,
    ...counts,
    precision: counts.tp + counts.fp === 0 ? 1 : counts.tp / (counts.tp + counts.fp),
    recall: counts.tp + counts.fn === 0 ? 1 : counts.tp / (counts.tp + counts.fn),
  }));

  const blockRecall = blockExpected === 0 ? 1 : blockDetected / blockExpected;
  const sanitizationRecall = sanitizationExpected === 0 ? 1 : sanitizationDetected / sanitizationExpected;

  return {
    results,
    ruleStats,
    blockRecall,
    sanitizationRecall,
    gatePassed: blockRecall >= BLOCK_RECALL_GATE && sanitizationRecall >= SANITIZATION_RECALL_GATE,
  };
}

export const GATES = { BLOCK_RECALL_GATE, SANITIZATION_RECALL_GATE };
