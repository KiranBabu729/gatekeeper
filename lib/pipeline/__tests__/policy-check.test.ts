import { describe, it, expect } from "vitest";
import { checkPolicy } from "@/lib/pipeline/policy-check";
import { loadCurrentPolicy } from "@/lib/policy/load";
import type { Variant } from "@/lib/schemas";

const { policy } = loadCurrentPolicy();

function variant(audience: Variant["audience"], body: string): Variant {
  return { audience, body, derivedFromFactsHash: "test", isStale: false, edits: [] };
}

describe("checkPolicy", () => {
  it("blocks an absolute security guarantee on customer_email", () => {
    const findings = checkPolicy(variant("customer_email", "Your data is fully secure."), "feature", policy);
    expect(findings.some((f) => f.ruleId === "GUAR-02" && f.severity === "block")).toBe(true);
  });

  it("downgrades FWD-01 to advise on internal_brief but blocks it on customer_email", () => {
    const text = "Summary: This ships by Q3 2026. Customer impact: none. Known issues: none. Support talking points: none. Escalation path: none.";
    const internal = checkPolicy(variant("internal_brief", text), "feature", policy);
    const customer = checkPolicy(variant("customer_email", "This ships by Q3 2026."), "feature", policy);
    expect(internal.find((f) => f.ruleId === "FWD-01")?.severity).toBe("advise");
    expect(customer.find((f) => f.ruleId === "FWD-01")?.severity).toBe("block");
  });

  it("flags lexicon-banned terms with a suggested replacement", () => {
    const findings = checkPolicy(variant("marketing", "Our platform is bulletproof."), "feature", policy);
    const hit = findings.find((f) => f.ruleId === "LEXICON:bulletproof");
    expect(hit?.suggestedFix).toBe("resilient");
  });

  it("flags a missing required channel section as a block finding", () => {
    const findings = checkPolicy(variant("customer_email", "What changed: a fix."), "feature", policy);
    expect(findings.some((f) => f.ruleId === "CHANNEL_CONTRACT" && f.severity === "block")).toBe(true);
  });
});
