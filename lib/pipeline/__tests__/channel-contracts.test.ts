import { describe, it, expect } from "vitest";
import { checkChannelContract, wordCount } from "@/lib/pipeline/channel-contracts";

describe("channel contracts", () => {
  it("flags an in_app message that exceeds the word limit", () => {
    const longBody = new Array(70).fill("word").join(" ");
    const { ok, violations } = checkChannelContract("in_app", longBody);
    expect(ok).toBe(false);
    expect(violations[0]).toMatch(/60-word limit/);
  });

  it("passes a compliant customer_email", () => {
    const body = [
      "What changed: We shipped a fix.",
      "Customer impact: Nothing to do.",
      "Action required: None.",
      "Questions? Reach out to your account team.",
    ].join("\n\n");
    const { ok } = checkChannelContract("customer_email", body);
    expect(ok).toBe(true);
  });

  it("flags a customer_email missing a required section", () => {
    const body = "What changed: We shipped a fix. Questions? Reach out to your account team.";
    const { ok, violations } = checkChannelContract("customer_email", body);
    expect(ok).toBe(false);
    expect(violations.some((v) => v.includes("Customer impact"))).toBe(true);
  });

  it("counts words correctly", () => {
    expect(wordCount("one two three")).toBe(3);
  });
});
