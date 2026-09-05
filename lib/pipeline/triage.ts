import type { SourceArtifact, TriageResult } from "@/lib/schemas";
import { TriageResultSchema } from "@/lib/schemas";
import { callStructuredLLM } from "@/lib/llm";

const SUFFICIENCY_THRESHOLD = 0.6;

function scoreAxis(present: boolean, strong: boolean): number {
  if (strong) return 1;
  if (present) return 0.5;
  return 0;
}

function stubTriage(source: SourceArtifact): TriageResult {
  const text = `${source.summary} ${source.description}`.toLowerCase();
  const wordCount = source.description.split(/\s+/).filter(Boolean).length;

  const whatChanged = scoreAxis(wordCount > 8, wordCount > 25);

  const whoAffectedPresent =
    /(all customers|customers on|users on|affect|impact|percent|%)/.test(text) || source.components.length > 0;
  const whoAffectedStrong =
    /(all (?:customers|regions|accounts)|\d+% of (?:requests|customers|users)|customers on|users on)/.test(text) ||
    (source.components.length > 0 && /(affect|impact)/.test(text));
  const whoAffected = scoreAxis(whoAffectedPresent, whoAffectedStrong);

  const actionRequiredPresent = /(no action|action required|must|should|need to|migrate|update your|resolved|restored|patched|fixed)/.test(
    text
  );
  const actionRequiredStrong = /(no (?:customer )?action (?:is )?required|action required:|must migrate|must update|no action required)/.test(
    text
  );
  const actionRequired = scoreAxis(actionRequiredPresent, actionRequiredStrong);

  const whenEffectivePresent =
    !!source.fixVersion ||
    /(effective|starting|as of|beginning|scheduled for|between \d|\d{4}-\d{2}-\d{2}|ships (?:this|in|with)|shipped)/.test(text);
  const whenEffectiveStrong = !!source.fixVersion || /(\d{4}-\d{2}-\d{2}|between \d{1,2}:\d{2})/.test(text);
  const whenEffective = scoreAxis(whenEffectivePresent, whenEffectiveStrong);

  const sufficiencyScore = (whatChanged + whoAffected + actionRequired + whenEffective) / 4;

  const openQuestions: string[] = [];
  if (whatChanged < 1) openQuestions.push("What exactly changed, in customer-facing terms?");
  if (whoAffected < 1) openQuestions.push("Which customers or segments are affected?");
  if (actionRequired < 1) openQuestions.push("Is any customer action required, and what is it?");
  if (whenEffective < 1) openQuestions.push("When does this take effect?");

  const messageTypeMap: Record<SourceArtifact["issueType"], TriageResult["messageType"]> = {
    feature: "feature",
    bugfix: "bugfix",
    incident: "incident",
    security_advisory: "security_advisory",
    deprecation: "deprecation",
    breaking_change: "breaking_change",
    maintenance: "maintenance",
  };

  let announceability: TriageResult["announceability"] = "internal_only";
  if (sufficiencyScore >= SUFFICIENCY_THRESHOLD) {
    if (source.issueType === "security_advisory" || source.issueType === "incident") {
      announceability = "customer_facing";
    } else if (source.labels.includes("public") || source.issueType === "feature") {
      announceability = "public";
    } else {
      announceability = "customer_facing";
    }
  }

  const riskTier: TriageResult["riskTier"] =
    source.issueType === "security_advisory" ||
    source.issueType === "incident" ||
    source.issueType === "breaking_change" ||
    source.labels.includes("legal-review")
      ? "requires_legal"
      : "standard";

  const urgency: TriageResult["urgency"] =
    source.issueType === "incident" || source.issueType === "security_advisory"
      ? "critical"
      : source.issueType === "breaking_change"
      ? "high"
      : source.issueType === "deprecation"
      ? "medium"
      : "low";

  return {
    announceability: sufficiencyScore < SUFFICIENCY_THRESHOLD ? "internal_only" : announceability,
    messageType: messageTypeMap[source.issueType],
    impactScope: source.components.join(", ") || "unspecified",
    urgency,
    riskTier,
    sufficiencyScore,
    sufficiencyAxes: {
      whatChanged,
      whoAffected,
      actionRequired,
      whenEffective,
    },
    openQuestions,
  };
}

export async function triage(source: SourceArtifact): Promise<TriageResult> {
  return callStructuredLLM({
    system:
      "You classify an internal engineering ticket for external-communication readiness. Be conservative: when ambiguous, prefer internal_only.",
    prompt: `Ticket ${source.key} (${source.issueType}): ${source.summary}\n\n${source.description}`,
    schema: TriageResultSchema,
    stubResponse: () => stubTriage(source),
  });
}

export const SUFFICIENCY_GATE = SUFFICIENCY_THRESHOLD;
