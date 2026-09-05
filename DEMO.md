# Gatekeeper — 90-second walkthrough

1. **Pick the incident ticket.** On `/`, click `GK-P1-004` ("P1: API gateway returned elevated 502s for 38 minutes"). It runs the full pipeline in one call.
2. **Show the redaction log.** On `/process/[id]`, open the **Sanitize** tab. 8 items were stripped before any drafting model saw this ticket: an engineer handle, two customer names, an internal incident-channel URL, an account ID, the pre-RCA root-cause sentence, and the internal severity label — each tagged `deterministic` or `llm` by method.
3. **Show the audience-scoped policy check.** Switch to the ticket picker and run `GK-101` (the CSV export feature) instead — its customer-facing variants include a forward-looking "expected by Q4 2026" line. On `/process/[id]/review`:
   - **Customer email**: `FWD-01` fires as a **block** — dated forward-looking commitments aren't allowed in front of customers.
   - **Internal brief**: the same sentence is fine internally — `FWD-01` only fires as **advise** there, because the policy is scoped by audience, not a single global filter.
   - **Marketing**: a `SUP-01` **warn** for an unsubstantiated superlative.
4. **Fix or override.** Edit the customer-email body directly in the middle pane, or add a written justification to the blocking finding and override it. Either path is captured.
5. **Approve.** As the Author, this one self-approves (`standard` risk tier). Switch to `GK-SEC-009` (security advisory) instead to see the `requires_legal` tier reject an Author approval until you switch to the Legal Reviewer user.
6. **Show the audit record.** `/audit/[id]` — the frozen policy version, model, facts hash, every override with its justification, and the exact approved text for all four variants.
7. **Show the eval gate.** `/evals` — 24/24 golden-set examples pass, 100% block-severity recall, 100% sanitization recall. This is the page that makes the rest of it credible.

## What to say out loud

- "The drafting model gets `SanitizedFacts`, never the ticket. That's not a prompt instruction — it's a type the raw ticket doesn't fit, backed by a lint rule and a test that greps for the identifier."
- "The same rule reads differently depending on who's receiving the message — that's `FWD-01` scoped by audience, not a blanket filter."
- "There's a recall gate on the eval page, not just a pass/fail label — 98% on anything block-severity, 100% on sanitization, or the page renders red."
