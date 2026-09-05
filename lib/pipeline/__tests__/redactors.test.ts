import { describe, it, expect } from "vitest";
import { runDeterministicRedactors } from "@/lib/pipeline/redactors";

describe("runDeterministicRedactors", () => {
  it("redacts emails", () => {
    const { text, hits } = runDeterministicRedactors("Contact sam@ourcompany.com now.", "description");
    expect(text).toBe("Contact [email redacted] now.");
    expect(hits[0].category).toBe("email_address");
  });

  it("redacts account IDs", () => {
    const { hits } = runDeterministicRedactors("See ACC-88213 and CUST-100.", "description");
    expect(hits.map((h) => h.category)).toEqual(["account_id", "account_id"]);
  });

  it("redacts ticket keys", () => {
    const { text } = runDeterministicRedactors("Filed as GK-244.", "description");
    expect(text).toContain("[ticket ID redacted]");
  });

  it("redacts seeded customer names", () => {
    const { hits } = runDeterministicRedactors("Northwind Traders reported this.", "description");
    expect(hits.some((h) => h.category === "customer_name")).toBe(true);
  });

  it("leaves clean text untouched", () => {
    const { text, hits } = runDeterministicRedactors("This is a clean sentence.", "description");
    expect(text).toBe("This is a clean sentence.");
    expect(hits).toHaveLength(0);
  });
});
